package mux

import (
	"database/sql"
	"net/http"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/util"
)

var (
	db            *sql.DB
	dbSyncClosing atomic.Bool // 标记数据库是否正在同步关闭中

	// 请求队列相关
	requestQueue      []requestTask
	requestQueueMu    sync.Mutex
	requestWaitGroup  sync.WaitGroup
	requestProcessing atomic.Bool
)

// requestTask 表示一个请求任务
type requestTask struct {
	execFunc func()        // 请求执行函数
	done     chan struct{} // 完成信号
}

// addToRequestQueue 添加请求任务到队列
func addToRequestQueue(execFunc func()) chan struct{} {
	requestQueueMu.Lock()
	defer requestQueueMu.Unlock()

	done := make(chan struct{})
	task := requestTask{
		execFunc: execFunc,
		done:     done,
	}

	requestQueue = append(requestQueue, task)
	logging.LogInfof("added task to queue, queue length: %d", len(requestQueue))

	// 确保请求处理器正在运行
	if !requestProcessing.Load() {
		logging.LogInfof("starting queue processor")
		requestProcessing.Store(true)
		go processRequestQueue()
	}

	return done
}

// processRequestQueue 处理请求队列中的任务
func processRequestQueue() {
	defer func() {
		if r := recover(); r != nil {
			logging.LogErrorf("processRequestQueue panic: %v", r)
			// 重置处理状态，允许下次请求重新启动处理器
			requestProcessing.Store(false)
		}
	}()

	retryCount := 0
	maxRetry := 10

	for {
		// 等待数据库可用
		if !waitForDBAvailable() {
			retryCount++
			if retryCount > maxRetry {
				logging.LogWarnf("processRequestQueue: max retry reached (%d), will retry when new requests arrive", maxRetry)
				requestQueueMu.Lock()
				hasRequests := len(requestQueue) > 0
				requestQueueMu.Unlock()

				if !hasRequests {
					// 如果没有请求，退出处理器
					requestProcessing.Store(false)
					return
				}
			}
			// 数据库不可用，等待一段时间后重试
			time.Sleep(500 * time.Millisecond)
			continue
		}

		// 数据库可用，重置重试计数
		retryCount = 0

		requestQueueMu.Lock()
		if len(requestQueue) == 0 {
			// 队列为空，退出处理器
			requestProcessing.Store(false)
			requestQueueMu.Unlock()
			return
		}

		// 取出队列中的第一个任务
		task := requestQueue[0]
		requestQueue = requestQueue[1:]
		requestQueueMu.Unlock()

		// 执行任务前标记请求正在处理
		requestWaitGroup.Add(1)

		// 执行任务（添加错误处理）
		func() {
			defer requestWaitGroup.Done() // 确保在任何情况下都会减少计数
			defer func() {
				if r := recover(); r != nil {
					logging.LogErrorf("task execution panic: %v", r)
				}
			}()

			task.execFunc()
		}()

		// 通知任务完成
		close(task.done)

		// 日志记录队列状态
		requestQueueMu.Lock()
		remainingTasks := len(requestQueue)
		requestQueueMu.Unlock()
		if remainingTasks > 0 {
			logging.LogInfof("processRequestQueue: %d tasks remaining in queue", remainingTasks)
		}
	}
}

// SQLRequest 定义 SQL 请求结构
type SQLRequest struct {
	Stmt string        `json:"stmt"` // SQL 语句
	Args []interface{} `json:"args"` // SQL 参数
}

// SQLResponse 定义 SQL 响应结构
type SQLResponse struct {
	Code int         `json:"code"` // 状态码
	Msg  string      `json:"msg"`  // 状态信息
	Data interface{} `json:"data"` // 响应数据
}

// InitPluginDatabase 初始化插件数据库
func InitPluginDatabase() error {
	dbPath := filepath.Join(util.DataDir, "storage", "extra.db")
	var err error
	db, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		return err
	}

	// 设置连接池
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)

	// 启用 WAL 模式以提高性能
	if _, err = db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return err
	}

	// 初始化时重置同步关闭标志和请求队列
	dbSyncClosing.Store(false)
	requestQueueMu.Lock()
	requestQueue = []requestTask{}
	requestQueueMu.Unlock()
	requestProcessing.Store(false)

	return nil
}

// ClosePluginDatabase 关闭插件数据库
func ClosePluginDatabase() {
	if db != nil {
		db.Close()
	}
}

// waitForDBAvailable 等待数据库可用
func waitForDBAvailable() bool {
	maxWaitTime := 60 * time.Second
	waitInterval := 100 * time.Millisecond
	startTime := time.Now()

	for dbSyncClosing.Load() {
		if time.Since(startTime) > maxWaitTime {
			logging.LogWarnf("waitForDBAvailable timeout after %v", maxWaitTime)
			return false // 超时
		}
		time.Sleep(waitInterval)
	}

	// 确保数据库连接已经就绪
	for i := 0; i < 50; i++ { // 尝试最多5秒
		if db != nil {
			// 简单测试连接是否有效
			if _, err := db.Exec("SELECT 1"); err == nil {
				return true
			}
		}

		if time.Since(startTime) > maxWaitTime {
			logging.LogWarnf("waitForDBAvailable timeout after %v", maxWaitTime)
			return false // 总超时
		}

		time.Sleep(100 * time.Millisecond)
	}

	logging.LogWarnf("waitForDBAvailable failed: database connection is not ready")
	return false
}

// HandleQuery 处理查询请求
func HandleQuery(c *gin.Context) {
	var req SQLRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, SQLResponse{
			Code: 1,
			Msg:  "Invalid request format",
		})
		return
	}

	// 检查数据库状态和队列状态
	requestQueueMu.Lock()
	hasQueue := len(requestQueue) > 0
	requestQueueMu.Unlock()

	// 如果数据库正在同步中或有请求队列，将请求添加到队列中
	if dbSyncClosing.Load() || hasQueue {
		var result SQLResponse

		// 定义请求执行函数
		execFunc := func() {
			// 检查数据库是否可用
			if db == nil {
				result = SQLResponse{
					Code: 1,
					Msg:  "Database connection is not available",
				}
				return
			}

			// 执行查询
			rows, err := db.Query(req.Stmt, req.Args...)
			if err != nil {
				result = SQLResponse{
					Code: 1,
					Msg:  err.Error(),
				}
				return
			}
			defer rows.Close()

			// 获取列名
			columns, err := rows.Columns()
			if err != nil {
				result = SQLResponse{
					Code: 1,
					Msg:  err.Error(),
				}
				return
			}

			// 准备结果集
			var queryResult []map[string]interface{}
			for rows.Next() {
				// 创建值切片
				values := make([]interface{}, len(columns))
				valuePtrs := make([]interface{}, len(columns))
				for i := range values {
					valuePtrs[i] = &values[i]
				}

				// 扫描行数据
				if err := rows.Scan(valuePtrs...); err != nil {
					result = SQLResponse{
						Code: 1,
						Msg:  err.Error(),
					}
					return
				}

				// 构建行数据
				row := make(map[string]interface{})
				for i, col := range columns {
					val := values[i]
					if b, ok := val.([]byte); ok {
						row[col] = string(b)
					} else {
						row[col] = val
					}
				}
				queryResult = append(queryResult, row)
			}

			// 检查是否有错误
			if err = rows.Err(); err != nil {
				result = SQLResponse{
					Code: 1,
					Msg:  err.Error(),
				}
				return
			}

			result = SQLResponse{
				Code: 0,
				Msg:  "success",
				Data: queryResult,
			}
		}

		// 添加到请求队列
		done := addToRequestQueue(execFunc)

		// 等待请求执行完成
		<-done

		// 返回结果
		if result.Code == 0 {
			c.JSON(http.StatusOK, result)
		} else {
			c.JSON(http.StatusInternalServerError, result)
		}
		return
	}

	// 数据库可用且没有队列，直接执行请求
	if db == nil {
		c.JSON(http.StatusServiceUnavailable, SQLResponse{
			Code: 1,
			Msg:  "Database connection is not available",
		})
		return
	}

	// 执行查询
	rows, err := db.Query(req.Stmt, req.Args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, SQLResponse{
			Code: 1,
			Msg:  err.Error(),
		})
		return
	}
	defer rows.Close()

	// 获取列名
	columns, err := rows.Columns()
	if err != nil {
		c.JSON(http.StatusInternalServerError, SQLResponse{
			Code: 1,
			Msg:  err.Error(),
		})
		return
	}

	// 准备结果集
	var result []map[string]interface{}
	for rows.Next() {
		// 创建值切片
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		// 扫描行数据
		if err := rows.Scan(valuePtrs...); err != nil {
			c.JSON(http.StatusInternalServerError, SQLResponse{
				Code: 1,
				Msg:  err.Error(),
			})
			return
		}

		// 构建行数据
		row := make(map[string]interface{})
		for i, col := range columns {
			val := values[i]
			if b, ok := val.([]byte); ok {
				row[col] = string(b)
			} else {
				row[col] = val
			}
		}
		result = append(result, row)
	}

	// 检查是否有错误
	if err = rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, SQLResponse{
			Code: 1,
			Msg:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SQLResponse{
		Code: 0,
		Msg:  "success",
		Data: result,
	})
}

// HandleExec 处理执行请求
func HandleExec(c *gin.Context) {
	var req SQLRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, SQLResponse{
			Code: 1,
			Msg:  "Invalid request format",
		})
		return
	}

	// 检查数据库状态和队列状态
	requestQueueMu.Lock()
	hasQueue := len(requestQueue) > 0
	requestQueueMu.Unlock()

	// 如果数据库正在同步中或有请求队列，将请求添加到队列中
	if dbSyncClosing.Load() || hasQueue {
		var result SQLResponse

		// 定义请求执行函数
		execFunc := func() {
			// 检查数据库是否可用
			if db == nil {
				result = SQLResponse{
					Code: 1,
					Msg:  "Database connection is not available",
				}
				return
			}

			// 执行 SQL 语句
			execResult, err := db.Exec(req.Stmt, req.Args...)
			if err != nil {
				result = SQLResponse{
					Code: 1,
					Msg:  err.Error(),
				}
				return
			}

			// 获取影响的行数
			affected, err := execResult.RowsAffected()
			if err != nil {
				result = SQLResponse{
					Code: 1,
					Msg:  err.Error(),
				}
				return
			}

			result = SQLResponse{
				Code: 0,
				Msg:  "success",
				Data: map[string]int64{
					"affected": affected,
				},
			}
		}

		// 添加到请求队列
		done := addToRequestQueue(execFunc)

		// 等待请求执行完成
		<-done

		// 返回结果
		if result.Code == 0 {
			c.JSON(http.StatusOK, result)
		} else {
			c.JSON(http.StatusInternalServerError, result)
		}
		return
	}

	// 数据库可用且没有队列，直接执行请求
	if db == nil {
		c.JSON(http.StatusServiceUnavailable, SQLResponse{
			Code: 1,
			Msg:  "Database connection is not available",
		})
		return
	}

	// 执行 SQL 语句
	result, err := db.Exec(req.Stmt, req.Args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, SQLResponse{
			Code: 1,
			Msg:  err.Error(),
		})
		return
	}

	// 获取影响的行数
	affected, err := result.RowsAffected()
	if err != nil {
		c.JSON(http.StatusInternalServerError, SQLResponse{
			Code: 1,
			Msg:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SQLResponse{
		Code: 0,
		Msg:  "success",
		Data: map[string]int64{
			"affected": affected,
		},
	})
}

// ClosePluginDatabaseForSync 在同步前关闭插件数据库连接
// 防止在同步过程中数据库文件被锁定，导致同步不完整
func ClosePluginDatabaseForSync() {
	// 先设置标志，让新请求进入队列
	logging.LogInfof("close plugin database for sync")
	dbSyncClosing.Store(true)

	// 等待所有当前正在处理的请求完成
	requestWaitGroup.Wait()

	// 关闭数据库连接
	if db != nil {
		db.Close()
		db = nil
	}
}

// ReopenPluginDatabaseAfterSync 在同步后重新打开插件数据库连接
func ReopenPluginDatabaseAfterSync() error {
	var err error
	logging.LogInfof("reopen plugin database after sync")
	if db == nil {
		err = InitPluginDatabase()
	}
	// 无论是否成功，都重置标志
	dbSyncClosing.Store(false)

	// 确保在数据库重新打开后处理队列中的请求
	requestQueueMu.Lock()
	hasRequests := len(requestQueue) > 0
	requestQueueMu.Unlock()

	if hasRequests && !requestProcessing.Load() {
		requestProcessing.Store(true)
		go processRequestQueue()
	}

	if err != nil {
		logging.LogErrorf("reopen plugin database after sync failed: %s", err)
	}
	return err
}

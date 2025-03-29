package mux

import (
	"database/sql"
	"net/http"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/util"
)

var (
	db *sql.DB
)

// SQLRequest 定义 SQL 请求结构
type SQLRequest struct {
	Stmt string `json:"stmt"` // SQL 语句
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

	return nil
}

// ClosePluginDatabase 关闭插件数据库
func ClosePluginDatabase() {
	if db != nil {
		db.Close()
	}
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

	// 执行查询
	rows, err := db.Query(req.Stmt)
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

	// 执行 SQL 语句
	result, err := db.Exec(req.Stmt)
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

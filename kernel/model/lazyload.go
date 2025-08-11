package model

import (
	"fmt"
	"net/url"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/siyuan-note/dejavu"
	"github.com/siyuan-note/eventbus"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// 懒加载状态
const (
	LazyLoadStatusIdle      = "idle"
	LazyLoadStatusLoading   = "loading"
	LazyLoadStatusCompleted = "completed"
	LazyLoadStatusFailed    = "failed"
)

// 懒加载文件信息
type LazyLoadFileInfo struct {
	FilePath   string
	Status     string
	Error      error
	LoadTimeMs int64
	StartTime  time.Time
}

var (
	// 全局仓库实例缓存，避免重复创建
	globalRepo *dejavu.Repo
	repoMutex  sync.RWMutex

	// 维护懒加载状态池
	lazyLoadStatusPool = make(map[string]*LazyLoadFileInfo)
	statusPoolMutex    sync.RWMutex

	// 懒加载超时配置，单位毫秒
	lazyLoadTimeout = 5000 // 默认5秒
)

// SetLazyLoadTimeout 设置懒加载超时时间
func SetLazyLoadTimeout(timeout int) {
	if timeout > 0 {
		lazyLoadTimeout = timeout
	}
}

// getOrCreateRepo 获取或创建全局仓库实例
func getOrCreateRepo() (*dejavu.Repo, error) {
	repoMutex.RLock()
	if globalRepo != nil {
		repo := globalRepo
		repoMutex.RUnlock()
		return repo, nil
	}
	repoMutex.RUnlock()

	repoMutex.Lock()
	defer repoMutex.Unlock()

	// 双重检查
	if globalRepo != nil {
		return globalRepo, nil
	}

	var err error
	globalRepo, err = newRepository()
	return globalRepo, err
}

// LazyLoadResult 表示懒加载结果
type LazyLoadResult struct {
	Success    bool
	FilePath   string
	Error      error
	LoadTimeMs int64
}

// TryLazyLoad 在资源文件未命中时尝试懒加载，返回是否加载成功
func TryLazyLoad(relativePath string) bool {
	// 必须启用了数据仓库密钥才有懒加载环境
	if len(Conf.Repo.Key) == 0 {
		logging.LogWarnf("lazy load skipped: data repo key is empty")
		return false
	}

	// 检查状态池，避免重复加载
	statusPoolMutex.RLock()
	fileInfo, exists := lazyLoadStatusPool[relativePath]
	statusPoolMutex.RUnlock()

	// 如果文件正在加载中，则等待其完成
	if exists && fileInfo.Status == LazyLoadStatusLoading {
		return waitForLazyLoadCompletion(relativePath)
	}

	// 如果文件已加载完成，则检查是否成功
	if exists && (fileInfo.Status == LazyLoadStatusCompleted || fileInfo.Status == LazyLoadStatusFailed) {
		return fileInfo.Status == LazyLoadStatusCompleted
	}

	// 解码URL编码的路径
	decodedPath, err := url.QueryUnescape(relativePath)
	if err != nil {
		logging.LogWarnf("decode relative path failed: %s", err)
		decodedPath = relativePath
	}

	// 标准化路径格式（去除开头的斜杠，如果存在）
	if len(decodedPath) > 0 && decodedPath[0] == '/' {
		decodedPath = decodedPath[1:]
	}

	// 创建新的加载任务
	statusPoolMutex.Lock()
	// 双重检查，防止竞态条件
	if fileInfo, exists := lazyLoadStatusPool[decodedPath]; exists {
		statusPoolMutex.Unlock()
		if fileInfo.Status == LazyLoadStatusLoading {
			return waitForLazyLoadCompletion(decodedPath)
		}
		return fileInfo.Status == LazyLoadStatusCompleted
	}

	// 初始化文件信息
	fileInfo = &LazyLoadFileInfo{
		FilePath:  decodedPath,
		Status:    LazyLoadStatusLoading,
		StartTime: time.Now(),
	}
	lazyLoadStatusPool[decodedPath] = fileInfo
	statusPoolMutex.Unlock()

	// 异步执行懒加载
	go func() {
		defer func() {
			statusPoolMutex.Lock()
			defer statusPoolMutex.Unlock()

			// 任务完成后立即从状态池中移除，避免重复加载
			statusPoolMutex.Lock()
			delete(lazyLoadStatusPool, relativePath)
			statusPoolMutex.Unlock()
		}()

		startTime := time.Now()

		repo, err := getOrCreateRepo()
		if err != nil {
			logging.LogErrorf("init repository for lazy load failed: %s", err)
			updateLazyLoadStatus(relativePath, LazyLoadStatusFailed, err)
			return
		}

		absPath := filepath.Join(repo.DataPath, decodedPath)
		// 推送前端提示
		msgId := util.PushMsg(fmt.Sprintf("正在下载懒加载文件: %s", decodedPath), 5000)

		ctx := map[string]interface{}{
			eventbus.CtxPushMsg: eventbus.CtxPushMsgToStatusBar,
			"filePath":          decodedPath,
		}
		if err := repo.LazyLoadFile(absPath, ctx); err != nil {
			// 确保使用正确的绝对路径变量 absPath
			util.PushClearMsg(msgId)
			logging.LogWarnf("lazy load file [%s] failed: %s", decodedPath, err)

			// 如果错误是文件未在最新索引中找到，输出索引列表
			if errMsg := err.Error(); strings.Contains(errMsg, "not found in latest index") {
				// 获取最新索引
				latest, idxErr := repo.Latest()
				if idxErr != nil {
					logging.LogErrorf("get latest index failed: %s", idxErr)
				} else {
					// 获取索引中的文件列表
					latestFiles, filesErr := repo.GetFiles(latest)
					if filesErr != nil {
						logging.LogErrorf("get latest files failed: %s", filesErr)
					} else {
						logging.LogWarnf("latest index contains %d files:", len(latestFiles))
						for _, file := range latestFiles {
							logging.LogWarnf("  - %s", file.Path)
						}
					}
				}
			}

			// 向前端推送详细错误信息
			util.PushErrMsg(fmt.Sprintf("懒加载文件失败: %s", err), 3000)
			updateLazyLoadStatus(decodedPath, LazyLoadStatusFailed, err)
			return
		}

		elapsed := time.Since(startTime).Milliseconds()
		util.PushUpdateMsg(msgId, fmt.Sprintf("懒加载文件成功: %s (耗时 %.2f 秒)", decodedPath, float64(elapsed)/1000), 2000)
		logging.LogInfof("lazy load file [%s] completed in %dms", decodedPath, elapsed)

		updateLazyLoadStatus(decodedPath, LazyLoadStatusCompleted, nil)
	}()

	// 等待懒加载完成后再返回结果
	return waitForLazyLoadCompletion(relativePath)
}

// waitForLazyLoadCompletion 等待懒加载完成
func waitForLazyLoadCompletion(relativePath string) bool {
	timeout := time.Duration(lazyLoadTimeout) * time.Millisecond
	startTime := time.Now()

	for time.Since(startTime) < timeout {
		time.Sleep(100 * time.Millisecond)

		statusPoolMutex.RLock()
		fileInfo, exists := lazyLoadStatusPool[relativePath]
		statusPoolMutex.RUnlock()

		if !exists {
			// 文件信息已被清理，假定加载失败
			return false
		}

		if fileInfo.Status == LazyLoadStatusCompleted {
			return true
		}

		if fileInfo.Status == LazyLoadStatusFailed {
			return false
		}
	}

	logging.LogWarnf("lazy load timed out waiting for file: %s", relativePath)
	return false
}

// updateLazyLoadStatus 更新懒加载状态
func updateLazyLoadStatus(relativePath string, status string, err error) {
	statusPoolMutex.Lock()
	defer statusPoolMutex.Unlock()

	fileInfo, exists := lazyLoadStatusPool[relativePath]
	if !exists {
		return
	}

	fileInfo.Status = status
	fileInfo.Error = err
	fileInfo.LoadTimeMs = time.Since(fileInfo.StartTime).Milliseconds()
}

// GetRepository 获取仓库实例，供 API 调用
func GetRepository() (*dejavu.Repo, error) {
	return getOrCreateRepo()
}

// GetLazyLoadingStats 获取懒加载统计信息
func GetLazyLoadingStats() map[string]interface{} {
	statusPoolMutex.RLock()
	defer statusPoolMutex.RUnlock()

	// 统计各状态的文件数量
	idleCount := 0
	loadingCount := 0
	completedCount := 0
	failedCount := 0

	// 收集加载中的文件信息
	loadingFiles := make(map[string]interface{})
	completedFiles := make(map[string]interface{})
	failedFiles := make(map[string]interface{})

	for path, info := range lazyLoadStatusPool {
		switch info.Status {
		case LazyLoadStatusIdle:
			idleCount++
		case LazyLoadStatusLoading:
			loadingCount++
			loadingFiles[path] = map[string]interface{}{
				"status":    info.Status,
				"elapsedMs": time.Since(info.StartTime).Milliseconds(),
			}
		case LazyLoadStatusCompleted:
			completedCount++
			completedFiles[path] = map[string]interface{}{
				"status":     info.Status,
				"loadTimeMs": info.LoadTimeMs,
			}
		case LazyLoadStatusFailed:
			failedCount++
			failedFiles[path] = map[string]interface{}{
				"status":     info.Status,
				"error":      info.Error.Error(),
				"loadTimeMs": info.LoadTimeMs,
			}
		}
	}

	return map[string]interface{}{
		"totalCount":     len(lazyLoadStatusPool),
		"idleCount":      idleCount,
		"loadingCount":   loadingCount,
		"completedCount": completedCount,
		"failedCount":    failedCount,
		"timeoutMs":      lazyLoadTimeout,
		"loadingFiles":   loadingFiles,
		"completedFiles": completedFiles,
		"failedFiles":    failedFiles,
	}
}

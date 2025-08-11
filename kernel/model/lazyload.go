package model

import (
	"fmt"
	"net/url"
	"path/filepath"
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
	lazyLoadTimeout = 60000 // 默认60秒
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
		logging.LogWarnf("[Lazy Load] skipped: data repo key is empty")
		return false
	}

	// 解码URL编码的路径
	decodedPath, err := url.QueryUnescape(relativePath)
	if err != nil {
		logging.LogWarnf("[Lazy Load] decode relative path failed: %s", err)
		decodedPath = relativePath
	}

	// 标准化路径格式（去除开头的斜杠，如果存在）
	if len(decodedPath) > 0 && decodedPath[0] == '/' {
		decodedPath = decodedPath[1:]
	}

	// 检查状态池，避免重复加载
	statusPoolMutex.RLock()
	fileInfo, exists := lazyLoadStatusPool[decodedPath]
	statusPoolMutex.RUnlock()

	// 如果文件正在加载中，则等待其完成
	if exists && fileInfo.Status == LazyLoadStatusLoading {
		return waitForLazyLoadCompletion(decodedPath)
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

		startTime := time.Now()

		repo, err := getOrCreateRepo()
		if err != nil {
			logging.LogErrorf("[Lazy Load] init repository failed: %s", err)
			updateLazyLoadStatus(decodedPath, LazyLoadStatusFailed, err)
			return
		}

		absPath := filepath.Join(repo.DataPath, decodedPath)

		ctx := map[string]interface{}{
			eventbus.CtxPushMsg: eventbus.CtxPushMsgToStatusBar,
			"filePath":          decodedPath,
		}
		if err := repo.LazyLoadFile(absPath, ctx); err != nil {
			logging.LogWarnf("[Lazy Load] file [%s] failed: %s", decodedPath, err)

			// 向前端推送详细错误信息
			util.PushErrMsg(fmt.Sprintf("懒加载文件失败: %s", err), 3000)
			updateLazyLoadStatus(decodedPath, LazyLoadStatusFailed, err)
			return
		}

		elapsed := time.Since(startTime).Milliseconds()
		util.PushMsg(fmt.Sprintf("Lazy load file [%s] completed in %.2f seconds", decodedPath, float64(elapsed)/1000), 2000)
		logging.LogInfof("[Lazy Load] file [%s] completed in %dms", decodedPath, elapsed)

		updateLazyLoadStatus(decodedPath, LazyLoadStatusCompleted, nil)

		// 延迟清理状态，避免等待方在完成瞬间取不到状态导致误判
		go scheduleLazyStatusCleanup(decodedPath, 5*time.Second)
	}()

	// 等待懒加载完成后再返回结果
	return waitForLazyLoadCompletion(decodedPath)
}

// waitForLazyLoadCompletion 等待懒加载完成
func waitForLazyLoadCompletion(decodedPath string) bool {
	timeout := time.Duration(lazyLoadTimeout) * time.Millisecond
	startTime := time.Now()
	lastCheckTime := startTime

	// 指数退避策略，初始检查间隔为100ms
	checkInterval := 100 * time.Millisecond
	maxCheckInterval := 1 * time.Second

	for time.Since(startTime) < timeout {
		time.Sleep(checkInterval)

		statusPoolMutex.RLock()
		fileInfo, exists := lazyLoadStatusPool[decodedPath]
		statusPoolMutex.RUnlock()

		if exists {
			if fileInfo.Status == LazyLoadStatusCompleted {
				return true
			}
			if fileInfo.Status == LazyLoadStatusFailed {
				logging.LogWarnf("[Lazy Load] failed for file: %s, error: %v", decodedPath, fileInfo.Error)
				return false
			}
		}

		// 动态调整检查间隔，避免频繁检查
		if time.Since(lastCheckTime) > checkInterval*2 {
			checkInterval = min(checkInterval*2, maxCheckInterval)
			lastCheckTime = time.Now()
		}
	}

	logging.LogWarnf("[Lazy Load] timed out waiting for file: %s", decodedPath)
	return false
}

// min 返回两个时间的较小值
func min(a, b time.Duration) time.Duration {
	if a < b {
		return a
	}
	return b
}

// updateLazyLoadStatus 更新懒加载状态
func updateLazyLoadStatus(decodedPath string, status string, err error) {
	statusPoolMutex.Lock()
	defer statusPoolMutex.Unlock()

	fileInfo, exists := lazyLoadStatusPool[decodedPath]
	if !exists {
		return
	}

	fileInfo.Status = status
	fileInfo.Error = err
	fileInfo.LoadTimeMs = time.Since(fileInfo.StartTime).Milliseconds()
}

// scheduleLazyStatusCleanup 延迟清理状态
func scheduleLazyStatusCleanup(decodedPath string, delay time.Duration) {
	time.Sleep(delay)
	statusPoolMutex.Lock()
	delete(lazyLoadStatusPool, decodedPath)
	statusPoolMutex.Unlock()
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

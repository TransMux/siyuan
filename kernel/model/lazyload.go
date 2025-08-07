package model

import (
	"fmt"
	"path/filepath"
	"sync"
	"time"

	"github.com/88250/gulu"
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
	FilePath    string
	Status      string
	Error       error
	LoadTimeMs  int64
	StartTime   time.Time
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
	Success     bool
	FilePath    string
	Error       error
	LoadTimeMs  int64
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

	// 创建新的加载任务
	statusPoolMutex.Lock()
	// 双重检查，防止竞态条件
	if fileInfo, exists := lazyLoadStatusPool[relativePath]; exists {
		statusPoolMutex.Unlock()
		if fileInfo.Status == LazyLoadStatusLoading {
			return waitForLazyLoadCompletion(relativePath)
		}
		return fileInfo.Status == LazyLoadStatusCompleted
	}

	// 初始化文件信息
	fileInfo = &LazyLoadFileInfo{
		FilePath:  relativePath,
		Status:    LazyLoadStatusLoading,
		StartTime: time.Now(),
	}
	lazyLoadStatusPool[relativePath] = fileInfo
	statusPoolMutex.Unlock()

	// 异步执行懒加载
	go func() {
		defer func() {
			statusPoolMutex.Lock()
			defer statusPoolMutex.Unlock()

			// 清理长时间完成的任务，防止内存泄漏
			go func() {
				time.Sleep(5 * time.Minute)
				statusPoolMutex.Lock()
				delete(lazyLoadStatusPool, relativePath)
				statusPoolMutex.Unlock()
			}()
		}()

		startTime := time.Now()

		repo, err := getOrCreateRepo()
		if err != nil {
			logging.LogErrorf("init repository for lazy load failed: %s", err)
			updateLazyLoadStatus(relativePath, LazyLoadStatusFailed, err)
			return
		}

		absPath := filepath.Join(repo.DataPath, relativePath)
		// 推送前端提示
		msgId := util.PushMsg(fmt.Sprintf("正在下载懒加载文件: %s", relativePath), 5000)

		ctx := map[string]interface{}{
			eventbus.CtxPushMsg: eventbus.CtxPushMsgToStatusBar,
			eventbus.CtxFilePath: relativePath,
		}
		if err := repo.LazyLoadFile(absPath, ctx); err != nil {
			util.PushClearMsg(msgId)
			logging.LogWarnf("lazy load file [%s] failed: %s", relativePath, err)
			// 向前端推送详细错误信息
			util.PushErrMsg(fmt.Sprintf("懒加载文件失败: %s", err), 3000)
			updateLazyLoadStatus(relativePath, LazyLoadStatusFailed, err)
			return
		}

		elapsed := time.Since(startTime).Milliseconds()
		util.PushUpdateMsg(msgId, fmt.Sprintf("懒加载文件成功 (耗时 %.2f 秒)", float64(elapsed)/1000), 2000)
		logging.LogInfof("lazy load file [%s] completed in %dms", relativePath, elapsed)

		updateLazyLoadStatus(relativePath, LazyLoadStatusCompleted, nil)
	}()

	// 立即返回，让调用者知道加载已开始
	// 实际加载结果将通过状态池异步更新
	return true
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
				"status":    info.Status,
				"loadTimeMs": info.LoadTimeMs,
			}
		case LazyLoadStatusFailed:
			failedCount++
			failedFiles[path] = map[string]interface{}{
				"status":    info.Status,
				"error":     info.Error.Error(),
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

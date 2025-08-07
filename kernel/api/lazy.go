package api

import (
	"net/http"
	"time"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func lazyLoadFile(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	filePath := arg["filePath"].(string)
	if "" == filePath {
		ret.Code = -1
		ret.Msg = "filePath is empty"
		return
	}

	startTime := time.Now()
	success := model.TryLazyLoad(filePath)
	elapsed := time.Since(startTime).Milliseconds()

	if success {
		ret.Data = map[string]interface{}{
			"success":    success,
			"filePath":   filePath,
			"loadTimeMs": elapsed,
		}
	} else {
		ret.Code = -1
		ret.Msg = "lazy load failed"
		ret.Data = map[string]interface{}{
			"success":    success,
			"filePath":   filePath,
			"loadTimeMs": elapsed,
		}
	}
}

func getLazyLoadingFiles(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	if 1 > len(model.Conf.Repo.Key) {
		ret.Code = -1
		ret.Msg = model.Conf.Language(26) // 数据仓库密钥为空
		return
	}

	repo, err := model.GetRepository()
	if err != nil {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}

	files, err := repo.GetLazyLoadingFiles()
	if err != nil {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}

	ret.Data = map[string]interface{}{
		"files": files,
	}
}

// setLazyLoadTimeout 设置懒加载超时时间
func setLazyLoadTimeout(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	timeout, ok := arg["timeout"].(float64)
	if !ok {
		ret.Code = -1
		ret.Msg = "invalid timeout parameter"
		return
	}

	model.SetLazyLoadTimeout(int(timeout))
	ret.Data = map[string]interface{}{
		"timeout": int(timeout),
	}
}

// getLazyLoadingStats 获取懒加载统计信息
func getLazyLoadingStats(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	stats := model.GetLazyLoadingStats()
	ret.Data = stats
}

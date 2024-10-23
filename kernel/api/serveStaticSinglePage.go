package api

import (
	"net/http"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/model"
)

func serveStaticSinglePage(c *gin.Context) {
	ret := gulu.Ret.NewResult()

	id := c.Param("block_id")
	if "" == id {
		ret.Code = -1
		ret.Msg = "block ID is required"
		c.JSON(http.StatusOK, ret)
		return
	}

	index := 0
	var query string
	var queryMethod int
	var queryTypes map[string]bool
	mode := 0
	size := 102400 // 默认最大加载块数
	startID := ""
	endID := ""
	isBacklink := false

	_, content, _, _, _, _, _, _, _, _, _, err := model.GetDoc(startID, endID, id, index, query, queryTypes, queryMethod, mode, size, isBacklink)
	if model.ErrBlockNotFound == err {
		ret.Code = 3
		c.JSON(http.StatusOK, ret)
		return
	}

	if err != nil {
		ret.Code = 1
		ret.Msg = err.Error()
		c.JSON(http.StatusOK, ret)
		return
	}

	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, content)
}

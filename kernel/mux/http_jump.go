package mux

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func Jump(c *gin.Context) {
	// 获取 block_id 参数
	blockID := c.Param("block_id")

	// 构建跳转 URL
	redirectURL := "siyuan://blocks/" + blockID + "?focus=1"

	// 让客户端跳转到指定的 URL
	c.Redirect(http.StatusFound, redirectURL)

	// 让客户端跳转之后直接关闭页面
	c.Writer.WriteString("<script>window.close();</script>")
}

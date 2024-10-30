package mux

import (
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

func Jump(c *gin.Context) {
	// 获取请求的所有信息
	request := c.Request

	// 获取block_id参数
	blockID := c.Param("block_id")

	// 构建HTML响应
	htmlResponse := `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<title>Request Information</title>
		</head>
		<body>
			<h1>Request Information</h1>
			<h2>Block ID</h2>
			<p>` + blockID + `</p>
			<h2>Headers</h2>
			<ul>
	`

	// 遍历请求头信息并添加到HTML响应中
	for key, values := range request.Header {
		for _, value := range values {
			htmlResponse += `<li>` + key + `: ` + value + `</li>`
		}
	}

	htmlResponse += `
			</ul>
			<h2>Query Parameters</h2>
			<ul>
	`

	// 遍历查询参数并添加到HTML响应中
	for key, values := range request.URL.Query() {
		for _, value := range values {
			htmlResponse += `<li>` + key + `: ` + value + `</li>`
		}
	}

	htmlResponse += `
			</ul>
			<h2>Form Data</h2>
			<ul>
	`

	// 解析表单数据
	if err := request.ParseForm(); err == nil {
		for key, values := range request.PostForm {
			for _, value := range values {
				htmlResponse += `<li>` + key + `: ` + value + `</li>`
			}
		}
	}

	htmlResponse += `
			</ul>
			<h2>Body</h2>
			<pre>
	`

	// 读取请求体
	bodyBytes, err := io.ReadAll(request.Body)
	if err == nil {
		htmlResponse += string(bodyBytes)
	}

	htmlResponse += `
			</pre>
		</body>
		</html>
	`

	// 设置响应头并返回HTML响应
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(htmlResponse))
}

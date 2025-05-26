// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package api

import (
	"net/http"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func netAssets2LocalAssets(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	id := arg["id"].(string)
	// Launch asset conversion asynchronously
	go func(rootID string) {
		if err := model.NetAssets2LocalAssets(rootID, false, ""); err != nil {
			logging.LogErrorf("async NetAssets2LocalAssets failed: %s", err)
			// Push error message via WebSocket
			util.PushErrMsg(err.Error(), 5000)
		}
	}(id)
	// Immediately respond; front end should listen for WebSocket progress
	ret.Msg = "已开始后台下载资源"
	ret.Data = map[string]interface{}{"closeTimeout": 1000}
}

func netImg2LocalAssets(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	id := arg["id"].(string)
	var url string
	if urlArg := arg["url"]; nil != urlArg {
		url = urlArg.(string)
	}

	// Launch image conversion asynchronously
	go func(rootID, originalURL string) {
		if err := model.NetAssets2LocalAssets(rootID, true, originalURL); err != nil {
			logging.LogErrorf("async NetImg2LocalAssets failed: %s", err)
			// Push error message via WebSocket
			util.PushErrMsg(err.Error(), 5000)
		}
	}(id, url)

	// Immediately respond; front end should listen for WebSocket progress
	ret.Msg = "已开始后台下载图片"
	ret.Data = map[string]interface{}{"closeTimeout": 1000}
}

func autoSpace(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	id := arg["id"].(string)
	err := model.AutoSpace(id)
	if err != nil {
		ret.Code = -1
		ret.Msg = err.Error()
		ret.Data = map[string]interface{}{"closeTimeout": 5000}
		return
	}
}

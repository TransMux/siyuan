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
	"github.com/siyuan-note/siyuan/kernel/model"
)

func serveStaticSinglePage(c *gin.Context) {
	// func getDoc(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	id := c.Param("block_id")
	if "" == id {
		ret.Code = -1
		ret.Msg = "block ID is required"
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

	blockCount, content, parentID, parent2ID, rootID, typ, eof, scroll, boxID, docPath, isBacklinkExpand, err := model.GetDoc(startID, endID, id, index, query, queryTypes, queryMethod, mode, size, isBacklink)
	if model.ErrBlockNotFound == err {
		ret.Code = 3
		return
	}

	if err != nil {
		ret.Code = 1
		ret.Msg = err.Error()
		return
	}

	ret.Data = map[string]interface{}{
		"id":               id,
		"mode":             mode,
		"parentID":         parentID,
		"parent2ID":        parent2ID,
		"rootID":           rootID,
		"type":             typ,
		"content":          content,
		"blockCount":       blockCount,
		"eof":              eof,
		"scroll":           scroll,
		"box":              boxID,
		"path":             docPath,
		"isBacklinkExpand": isBacklinkExpand,
	}
}

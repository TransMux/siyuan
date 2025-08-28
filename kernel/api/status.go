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
    "sync"
    "time"

    "github.com/88250/gulu"
    "github.com/gin-gonic/gin"
)

type statusEntry struct {
    Value string `json:"value"`
    Time  int64  `json:"time"` // unix millis
}

var (
    statusMu    sync.RWMutex
    statusStore = map[string]statusEntry{}
)

// POST /api/status
// Body: {"key":"value"}
func statusPost(c *gin.Context) {
    ret := gulu.Ret.NewResult()
    defer c.JSON(http.StatusOK, ret)

    var body map[string]string
    if err := c.ShouldBindJSON(&body); err != nil {
        ret.Code = -1
        ret.Msg = "invalid json body"
        return
    }
    // Only record the first kv pair
    var k, v string
    for key, val := range body {
        k = key
        v = val
        break
    }
    if k == "" {
        ret.Code = -1
        ret.Msg = "empty key"
        return
    }
    statusMu.Lock()
    statusStore[k] = statusEntry{Value: v, Time: time.Now().UnixMilli()}
    statusMu.Unlock()
}

// GET /api/status?key=foo&key=bar
// Returns: { data: { "foo": {"value":"...","time":123}, "bar": {...} } }
func statusGet(c *gin.Context) {
    ret := gulu.Ret.NewResult()
    defer c.JSON(http.StatusOK, ret)

    keys := c.QueryArray("key")
    // If no explicit keys provided, treat all query param names as keys
    if len(keys) == 0 {
        for k := range c.Request.URL.Query() {
            if k == "key" {
                continue
            }
            keys = append(keys, k)
        }
    }

    result := map[string]statusEntry{}
    statusMu.RLock()
    for _, k := range keys {
        if k == "" {
            continue
        }
        if v, ok := statusStore[k]; ok {
            result[k] = v
        }
    }
    statusMu.RUnlock()
    ret.Data = result
}

// helpers for other handlers in this package
func loadStatus(key string) (val string, ts int64, ok bool) {
    statusMu.RLock()
    entry, exists := statusStore[key]
    statusMu.RUnlock()
    if !exists {
        return "", 0, false
    }
    return entry.Value, entry.Time, true
}

func saveStatus(key, value string) {
    statusMu.Lock()
    statusStore[key] = statusEntry{Value: value, Time: time.Now().UnixMilli()}
    statusMu.Unlock()
}


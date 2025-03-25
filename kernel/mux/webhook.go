package mux

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/siyuan-note/logging"
)

// WebhookPayload 定义 webhook 请求的数据结构
type WebhookPayload struct {
	Timestamp int64       `json:"timestamp"`
	Event     string      `json:"event"`
	Data      interface{} `json:"data"`
}

// SendWebhook 发送 webhook 请求到指定的 URL https://x.transmux.top/j/20250325160653-iwgbfsp
func SendWebhook(event string, data interface{}) error {
	defer func() {
		if r := recover(); r != nil {
			logging.LogErrorf("send webhook 发送失败: %v", r)
		}
	}()

	payload := WebhookPayload{
		Event: event,
		Data:  data,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		logging.LogErrorf("send webhook json 序列化失败: %v", err)
		return err
	}

	req, err := http.NewRequest("POST", "https://gateway.transmux.top/forward/v7it4frby9khl58mc1oa", bytes.NewBuffer(jsonData))
	if err != nil {
		logging.LogErrorf("send webhook 创建请求失败: %v", err)
		return err
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		logging.LogErrorf("send webhook 请求发送失败: %v", err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		err = fmt.Errorf("send webhook 请求失败，状态码：%d", resp.StatusCode)
		logging.LogErrorf(err.Error())
		return err
	}

	return nil
}

# WebSocket 管理器使用指南

## 概述

WebSocketManager 是 DocumentStyler 插件中专门用于处理思源 WebSocket 连接的模块。它提供了一个统一的接口来监听文档变更事件，实现实时更新功能。

## 主要特性

- **统一的 WebSocket 连接管理**：只需要连接一次，就可以获取所有文档的更新
- **事件过滤**：支持自定义过滤器，只监听感兴趣的事件
- **Promise 基础**：提供基于 Promise 的异步 API
- **生命周期管理**：自动处理连接、断开和资源清理
- **防抖更新**：内置防抖机制，避免频繁更新
- **错误处理**：完善的错误处理和超时机制

## 核心 API

### 初始化和销毁

```typescript
// 初始化
await webSocketManager.init();

// 销毁
webSocketManager.destroy();
```

### 监听块保存事件

```typescript
// 基本用法
const result = await webSocketManager.whenBlockSaved();

// 使用过滤器
const filter = (msg) => msg.cmd === 'transactions' && 
    msg.data?.some(t => t.doOperations?.some(op => 
        op.data?.includes('data-type="NodeHeading"')
    ));

const result = await webSocketManager.whenBlockSaved(filter, 10000);
```

### 通用事件监听

```typescript
// 监听特定事件
const result = await webSocketManager.listen({
    filter: (msg) => msg.cmd === 'transactions',
    timeout: 5000
});

// 监听一次性事件
const result = await webSocketManager.listen({
    filter: (msg) => msg.cmd === 'specific-event',
    once: true
});
```

## 事件过滤器

事件过滤器是一个函数，用于决定是否处理特定的 WebSocket 消息：

```typescript
interface IWebSocketFilter {
    (msg: any): boolean;
}
```

### 常用过滤器示例

```typescript
// 监听所有 transaction 事件
const allTransactions = (msg) => msg.cmd === 'transactions';

// 监听标题变更
const headingChanges = (msg) => 
    msg.cmd === 'transactions' && 
    msg.data?.some(t => t.doOperations?.some(op => 
        op.data?.includes('data-type="NodeHeading"')
    ));

// 监听特定文档
const specificDoc = (docId) => (msg) =>
    msg.cmd === 'transactions' && 
    msg.data?.some(t => t.doOperations?.some(op => 
        op.data?.includes(`data-root-id="${docId}"`)
    ));

// 监听特定操作类型
const specificAction = (action) => (msg) =>
    msg.cmd === 'transactions' && 
    msg.data?.some(t => t.doOperations?.some(op => 
        op.action === action
    ));
```

## 实时更新实现

WebSocketManager 内置了实时更新逻辑，当检测到相关变更时会自动触发更新：

```typescript
// 在 handleTransactionMessage 方法中
private async handleTransactionMessage(msg: any): Promise<void> {
    // 检查设置
    const settings = this.settingsManager.getSettings();
    if (!settings.realTimeUpdate) return;

    // 分析事件
    const analysisResult = TransactionAnalyzer.analyzeTransactionEvent(msg);

    // 触发更新
    if (analysisResult.needUpdateHeadings) {
        this.debouncedUpdateHeadings(docId);
    }
}
```

## 与 TransactionAnalyzer 集成

WebSocketManager 使用 TransactionAnalyzer 来分析 WebSocket 消息：

```typescript
import { TransactionAnalyzer } from '../utils/transactionAnalyzer';

// 分析消息
const analysisResult = TransactionAnalyzer.analyzeTransactionEvent(msg);

// 检查是否需要更新
if (TransactionAnalyzer.needsUpdate(analysisResult)) {
    // 执行更新逻辑
}
```

## 错误处理

### 连接错误

```typescript
try {
    await webSocketManager.init();
} catch (error) {
    console.error('WebSocket 连接失败:', error);
}
```

### 监听超时

```typescript
try {
    const result = await webSocketManager.listen({
        timeout: 5000
    });
} catch (error) {
    if (error.message.includes('监听超时')) {
        console.log('没有在指定时间内接收到事件');
    }
}
```

### 连接状态检查

```typescript
if (webSocketManager.isWebSocketConnected()) {
    // WebSocket 已连接
} else {
    // WebSocket 未连接
}
```

## 性能优化

### 防抖机制

WebSocketManager 内置了防抖机制，避免频繁更新：

```typescript
// 防抖更新函数
private debouncedUpdateHeadings = debounce(this.updateHeadingsForDoc.bind(this), 1000);
```

### 资源清理

```typescript
// 自动清理超时的监听器
private clearAllListeners(): void {
    for (const [id, listener] of this.activeListeners) {
        if (listener.timeout) {
            clearTimeout(listener.timeout);
        }
        listener.reject(new Error('WebSocketManager 已销毁'));
    }
    this.activeListeners.clear();
}
```

## 调试和监控

### 获取状态信息

```typescript
// 检查连接状态
const isConnected = webSocketManager.isWebSocketConnected();

// 获取活跃监听器数量
const listenerCount = webSocketManager.getActiveListenerCount();
```

### 调试日志

在开发模式下，WebSocketManager 会输出详细的调试信息：

```typescript
if (process.env.NODE_ENV === 'development') {
    console.log('WebSocketManager: Transaction分析结果:', 
        TransactionAnalyzer.createDebugInfo(analysisResult));
}
```

## 最佳实践

1. **合理使用过滤器**：只监听需要的事件，避免不必要的处理
2. **设置适当的超时**：根据实际需求设置合理的超时时间
3. **错误处理**：始终包含错误处理逻辑
4. **资源清理**：确保在不需要时正确清理监听器
5. **性能监控**：定期检查活跃监听器数量，避免内存泄漏

## 与旧版本的区别

相比于使用事件总线的旧方式，WebSocketManager 提供了：

- **更直接的 WebSocket 访问**：直接使用思源的 WebSocket 实例
- **更精确的事件过滤**：可以精确控制要监听的事件类型
- **更好的生命周期管理**：统一的连接和清理逻辑
- **更强的类型安全**：完整的 TypeScript 类型定义

## 示例代码

完整的使用示例请参考 `examples/webSocketUsage.ts` 文件。

## 注意事项

1. WebSocketManager 依赖于思源的 `window.siyuan.ws.ws` 实例
2. 确保在思源环境中使用，否则会连接失败
3. 监听器会在 WebSocketManager 销毁时自动清理
4. 使用防抖机制时，更新可能会有延迟（默认1秒）

# WebSocket 架构重构说明

## 重构目标

将 WebSocketManager 从一个包含业务逻辑的复杂组件重构为一个纯粹的消息分发器，遵循单一职责原则。

## 重构前的问题

### 1. 职责混乱
```typescript
// ❌ 重构前：WebSocketManager 包含太多职责
class WebSocketManager {
    private async handleTransactionMessage(msg: any): Promise<void> {
        // 1. WebSocket 消息处理
        // 2. 业务逻辑分析
        const analysisResult = TransactionAnalyzer.analyzeTransactionEvent(msg);
        
        // 3. 文档状态检查
        const isCurrentDocAffected = this.documentManager.isCurrentDocumentAffected(msg);
        
        // 4. 设置验证
        if (!this.settingsManager.isDocumentEnabled(currentDocId)) return;
        
        // 5. 具体的更新逻辑
        if (analysisResult.needUpdateHeadings) {
            this.debouncedUpdateHeadings(currentDocId);
        }
    }
}
```

### 2. 依赖过多
- 依赖 `TransactionAnalyzer` 进行事件分析
- 依赖 `DocumentManager` 进行文档状态检查
- 依赖 `SettingsManager` 进行配置验证
- 包含防抖更新逻辑

### 3. 难以测试和维护
- 单个方法承担多个职责
- 修改业务逻辑需要修改 WebSocket 处理代码
- 测试时需要 mock 大量依赖

## 重构后的架构

### 1. WebSocketManager：纯消息分发器
```typescript
// ✅ 重构后：WebSocketManager 只负责消息分发
class WebSocketManager {
    private async handleTransactionMessage(msg: any): Promise<void> {
        // 只检查基本设置
        const settings = this.settingsManager.getSettings();
        if (!settings.realTimeUpdate) return;

        // 直接分发给各个管理器
        if (settings.headingNumbering) {
            await this.headingNumbering.handleTransactionMessage(msg);
        }

        if (settings.crossReference) {
            await this.crossReference.handleTransactionMessage(msg);
        }
    }
}
```

### 2. HeadingNumbering：自主处理标题相关消息
```typescript
class HeadingNumbering {
    async handleTransactionMessage(msg: any): Promise<void> {
        // 1. 检查当前文档是否受影响
        if (!this.documentManager.isCurrentDocumentAffected(msg)) {
            return;
        }

        // 2. 检查文档是否启用编号
        const currentDocId = this.documentManager.getCurrentDocId();
        if (!this.settingsManager.isDocumentEnabled(currentDocId)) return;

        // 3. 分析是否需要更新标题编号
        if (this.needsHeadingUpdate(msg)) {
            await this.updateNumberingForDoc(currentDocId);
        }
    }

    private needsHeadingUpdate(msg: any): boolean {
        // 专门的标题更新检测逻辑
        return msg.data.some(transaction => 
            transaction.doOperations?.some(operation => 
                operation.data?.includes('data-type="NodeHeading"')
            )
        );
    }
}
```

### 3. CrossReference：自主处理图片表格相关消息
```typescript
class CrossReference {
    async handleTransactionMessage(msg: any): Promise<void> {
        // 1. 检查当前文档是否受影响
        if (!this.documentManager.isCurrentDocumentAffected(msg)) {
            return;
        }

        // 2. 分析是否需要更新图片表格索引
        if (this.needsFigureUpdate(msg)) {
            const currentProtyle = this.documentManager.getCurrentProtyle();
            if (currentProtyle) {
                await this.applyCrossReference(currentProtyle);
            }
        }
    }

    private needsFigureUpdate(msg: any): boolean {
        // 专门的图片表格更新检测逻辑
        return msg.data.some(transaction => 
            transaction.doOperations?.some(operation => 
                operation.data?.includes('data-type="NodeTable"') ||
                operation.data?.includes('<img')
            )
        );
    }
}
```

## 重构优势

### 1. 单一职责原则
- **WebSocketManager**：只负责 WebSocket 连接和消息分发
- **HeadingNumbering**：只负责标题编号相关的业务逻辑
- **CrossReference**：只负责图片表格索引相关的业务逻辑

### 2. 降低耦合度
- WebSocketManager 不再依赖具体的业务逻辑
- 各个管理器可以独立演化
- 添加新功能不需要修改 WebSocketManager

### 3. 提高可测试性
```typescript
// 可以独立测试每个组件
test('HeadingNumbering handles transaction messages', () => {
    const headingNumbering = new HeadingNumbering(mockDeps);
    const mockMessage = createMockTransactionMessage();
    
    await headingNumbering.handleTransactionMessage(mockMessage);
    
    expect(mockDeps.updateNumberingForDoc).toHaveBeenCalled();
});
```

### 4. 更好的扩展性
```typescript
// 添加新的管理器很简单
class NewFeatureManager {
    async handleTransactionMessage(msg: any): Promise<void> {
        // 自己的处理逻辑
    }
}

// 在 WebSocketManager 中添加分发
if (settings.newFeature) {
    await this.newFeatureManager.handleTransactionMessage(msg);
}
```

## 数据流对比

### 重构前
```
WebSocket Message
    ↓
WebSocketManager
    ├── TransactionAnalyzer.analyzeTransactionEvent()
    ├── DocumentManager.isCurrentDocumentAffected()
    ├── SettingsManager.isDocumentEnabled()
    ├── 业务逻辑判断
    └── 直接调用更新方法
```

### 重构后
```
WebSocket Message
    ↓
WebSocketManager (纯分发器)
    ├── HeadingNumbering.handleTransactionMessage()
    │   ├── 自己检查是否需要处理
    │   ├── 自己的业务逻辑分析
    │   └── 自己的更新逻辑
    └── CrossReference.handleTransactionMessage()
        ├── 自己检查是否需要处理
        ├── 自己的业务逻辑分析
        └── 自己的更新逻辑
```

## 性能优化

### 1. 早期退出
每个管理器都会首先检查消息是否与自己相关：
```typescript
// 如果当前文档不受影响，立即返回
if (!this.documentManager.isCurrentDocumentAffected(msg)) {
    return;
}
```

### 2. 专门的检测逻辑
每个管理器都有自己专门的检测逻辑，避免不必要的处理：
```typescript
// HeadingNumbering 只关心标题相关的变更
private needsHeadingUpdate(msg: any): boolean {
    return operation.data?.includes('data-type="NodeHeading"');
}

// CrossReference 只关心图片表格相关的变更
private needsFigureUpdate(msg: any): boolean {
    return operation.data?.includes('data-type="NodeTable"') ||
           operation.data?.includes('<img');
}
```

## 未来扩展

这种架构使得添加新功能变得非常简单：

1. **创建新的管理器**
2. **实现 `handleTransactionMessage` 方法**
3. **在 WebSocketManager 中添加分发逻辑**

例如，如果要添加代码块自动格式化功能：

```typescript
class CodeBlockFormatter {
    async handleTransactionMessage(msg: any): Promise<void> {
        if (!this.documentManager.isCurrentDocumentAffected(msg)) {
            return;
        }

        if (this.needsCodeBlockUpdate(msg)) {
            await this.formatCodeBlocks();
        }
    }

    private needsCodeBlockUpdate(msg: any): boolean {
        return operation.data?.includes('data-type="NodeCodeBlock"');
    }
}
```

这种设计确保了系统的可维护性和可扩展性，同时保持了清晰的职责分离。

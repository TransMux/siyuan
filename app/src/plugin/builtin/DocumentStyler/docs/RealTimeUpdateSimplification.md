# 实时更新简化重构说明

## 重构目标

移除所有实时更新设置相关的逻辑，让实时更新直接开启，简化代码结构和用户体验。

## 移除的功能

### 1. 设置字段
从 `IDocumentStylerSettings` 中移除：
- `realTimeUpdate: boolean` - 实时更新开关
- `docEnableStatus: Record<string, boolean>` - 文档启用状态映射

### 2. SettingsManager 方法
移除以下方法：
- `isDocumentEnabled(docId: string): boolean` - 检查文档是否启用编号
- `setDocumentEnabled(docId: string, enabled: boolean): Promise<void>` - 设置文档启用状态

### 3. WebSocketManager 检查
移除实时更新状态检查：
```typescript
// ❌ 移除前
const settings = this.settingsManager.getSettings();
if (!settings.realTimeUpdate) return;

// ✅ 移除后
// 直接处理消息，不检查实时更新状态
```

### 4. HeadingNumbering 检查
移除文档启用状态检查：
```typescript
// ❌ 移除前
if (!this.settingsManager.isDocumentEnabled(currentDocId)) return;

// ✅ 移除后
// 直接处理，不检查文档启用状态
```

### 5. EventHandler 方法
移除以下方法和相关逻辑：
- `enableRealTimeUpdate()` - 启用实时更新
- `disableRealTimeUpdate()` - 禁用实时更新
- `handleRealTimeUpdateChange(enabled: boolean)` - 处理实时更新设置变更
- `onEdited()` - 编辑事件处理（已由 WebSocketManager 替代）
- `updateHeadingsForDoc()` - 更新指定文档标题编号
- `updateFiguresForDoc()` - 更新指定文档图片表格索引

## 简化后的架构

### 1. 设置结构
```typescript
interface IDocumentStylerSettings {
    headingNumbering: boolean;
    crossReference: boolean;
    numberingFormats: string[];
    useChineseNumbers: boolean[];
    defaultEnabled: boolean;
    // ❌ 移除：realTimeUpdate: boolean;
    // ❌ 移除：docEnableStatus: Record<string, boolean>;
}
```

### 2. WebSocket 消息处理
```typescript
// 简化的消息处理流程
private async handleTransactionMessage(msg: any): Promise<void> {
    const settings = this.settingsManager.getSettings();
    
    // 直接分发给各管理器，不检查实时更新状态
    if (settings.headingNumbering) {
        await this.headingNumbering.handleTransactionMessage(msg);
    }
    
    if (settings.crossReference) {
        await this.crossReference.handleTransactionMessage(msg);
    }
}
```

### 3. 标题编号处理
```typescript
// 简化的标题编号处理
async handleTransactionMessage(msg: any): Promise<void> {
    // 检查当前文档是否受影响
    if (!this.documentManager.isCurrentDocumentAffected(msg)) {
        return;
    }

    const currentDocId = this.documentManager.getCurrentDocId();
    if (!currentDocId) return;

    // ❌ 移除：文档启用状态检查
    // if (!this.settingsManager.isDocumentEnabled(currentDocId)) return;

    // 直接处理标题更新
    if (this.needsHeadingUpdate(msg)) {
        await this.updateNumberingForDoc(currentDocId);
    }
}
```

## 重构优势

### 1. 简化用户体验
- **无需配置**：用户不需要手动开启实时更新
- **即开即用**：插件启用后立即生效
- **减少困惑**：不再有复杂的文档级别开关

### 2. 简化代码结构
- **减少分支**：移除大量的条件判断逻辑
- **降低复杂度**：不再需要维护文档启用状态
- **提高可读性**：代码流程更加直观

### 3. 提高性能
- **减少检查**：不再需要检查实时更新状态和文档启用状态
- **简化逻辑**：消息处理流程更加直接
- **减少存储**：不再需要存储文档启用状态映射

### 4. 降低维护成本
- **减少设置项**：不需要维护实时更新相关的设置
- **简化测试**：减少需要测试的分支和场景
- **减少 Bug**：移除复杂的状态管理逻辑

## 行为变化

### 重构前
1. 用户需要手动开启实时更新
2. 可以为每个文档单独设置是否启用编号
3. 复杂的设置界面和状态管理

### 重构后
1. 实时更新总是开启
2. 所有文档都会应用编号（如果功能启用）
3. 简化的设置界面，只保留核心功能开关

## 迁移说明

### 对现有用户的影响
- **设置迁移**：旧的 `realTimeUpdate` 和 `docEnableStatus` 设置会被忽略
- **行为变化**：所有文档都会自动应用编号（如果功能启用）
- **无需操作**：用户不需要手动迁移，插件会自动适应

### 开发者注意事项
- **API 变化**：移除了文档启用状态相关的 API
- **事件处理**：实时更新现在完全由 WebSocketManager 处理
- **测试更新**：相关的测试用例已经更新或移除

## 未来考虑

如果将来需要更细粒度的控制，可以考虑：

1. **文档级别开关**：通过文档属性或标签控制
2. **智能检测**：根据文档内容自动决定是否应用编号
3. **用户偏好**：提供全局的编号样式偏好设置

但目前的简化版本已经能够满足大多数用户的需求，同时保持了代码的简洁性和可维护性。

## 总结

这次重构大幅简化了插件的设置和代码结构，提供了更好的用户体验：

- ✅ **即开即用**：无需复杂配置
- ✅ **性能提升**：减少不必要的检查
- ✅ **代码简化**：移除复杂的状态管理
- ✅ **维护性**：降低代码复杂度

实时更新现在是插件的核心特性，总是保持开启状态，为用户提供最佳的编辑体验。

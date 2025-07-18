# 基于文档的设置系统更新

## 概述

本次更新将DocumentStyler插件的设置系统从全局设置改为完全基于文档的设置，所有设置都存储在文档属性中，并且设置更新后立即应用。

## 🎯 主要变更

### 1. 设置存储方式变更

#### 之前：全局设置
```typescript
// 全局设置存储在插件数据中
const settings = await plugin.loadData('document-styler-settings');
```

#### 现在：文档属性设置
```typescript
// 每个文档的设置存储在文档属性中
const docSettings = await getDocumentAttr(docId, 'custom-document-styler-settings');
// 设置内容为JSON格式
{
  "headingNumberingEnabled": true,
  "crossReferenceEnabled": false,
  "numberingFormats": ["{1}. ", "{1}.{2} ", ...],
  "headingNumberStyles": ["arabic", "chinese", ...],
  "defaultEnabled": true
}
```

### 2. 设置管理API更新

#### 新增方法
```typescript
// 获取文档设置
async getDocumentSettings(docId: string): Promise<IDocumentStylerDocumentSettings>

// 设置文档设置
async setDocumentSettings(docId: string, settings: Partial<IDocumentStylerDocumentSettings>): Promise<void>

// 获取文档的标题编号样式
async getDocumentHeadingNumberStyle(docId: string, level: number): Promise<HeadingNumberStyle>

// 设置文档的标题编号样式
async setDocumentHeadingNumberStyle(docId: string, level: number, style: HeadingNumberStyle): Promise<void>

// 获取文档的编号格式
async getDocumentNumberingFormat(docId: string, level: number): Promise<string>

// 设置文档的编号格式
async setDocumentNumberingFormat(docId: string, level: number, format: string): Promise<void>
```

### 3. 实时应用机制

#### 设置更新后立即应用
```typescript
// 在DockPanel中，设置更新后立即应用
private async applyDocumentSettings(docId: string): Promise<void> {
    const settings = await this.settingsManager.getDocumentSettings(docId);
    
    // 应用标题编号
    if (settings.headingNumberingEnabled) {
        await this.applyHeadingNumbering();
    } else {
        await this.clearHeadingNumbering();
    }
    
    // 应用交叉引用
    if (settings.crossReferenceEnabled) {
        await this.applyCrossReference();
    } else {
        await this.clearCrossReference();
    }
}
```

## 🔧 技术实现

### 1. 文档属性管理

#### 属性键定义
```typescript
export const DOCUMENT_ATTR_KEYS = {
    /** 文档样式设置 */
    DOCUMENT_STYLER_SETTINGS: 'custom-document-styler-settings'
} as const;
```

#### 设置接口定义
```typescript
export interface IDocumentStylerDocumentSettings {
    /** 标题自动编号启用状态 */
    headingNumberingEnabled: boolean;
    /** 交叉引用启用状态 */
    crossReferenceEnabled: boolean;
    /** 标题编号格式配置 */
    numberingFormats: string[];
    /** 标题编号样式配置 (6个级别) */
    headingNumberStyles: HeadingNumberStyle[];
    /** 默认启用状态（用于新建文档） */
    defaultEnabled: boolean;
}
```

### 2. 设置验证和修复

#### 验证机制
```typescript
private validateAndFixDocumentSettings(settings: any): IDocumentStylerDocumentSettings {
    const defaultSettings = this.getDefaultDocumentSettings();
    
    if (!settings || typeof settings !== 'object') {
        return defaultSettings;
    }

    const fixed = { ...defaultSettings };

    // 验证并修复各个属性
    if (typeof settings.headingNumberingEnabled === 'boolean') {
        fixed.headingNumberingEnabled = settings.headingNumberingEnabled;
    }
    
    // ... 其他属性验证
    
    return fixed;
}
```

### 3. 默认设置管理

#### 默认设置生成
```typescript
getDefaultDocumentSettings(): IDocumentStylerDocumentSettings {
    return {
        headingNumberingEnabled: this.settings.defaultEnabled,
        crossReferenceEnabled: false,
        numberingFormats: [...this.settings.numberingFormats],
        headingNumberStyles: [...this.settings.headingNumberStyles],
        defaultEnabled: this.settings.defaultEnabled
    };
}
```

## 📋 功能清单

### ✅ 已实现功能

1. **基于文档的设置存储**
   - [x] 所有设置存储在文档属性中
   - [x] JSON格式的设置数据
   - [x] 设置验证和修复机制
   - [x] 默认设置管理

2. **实时应用机制**
   - [x] 设置更新后立即应用
   - [x] 标题编号实时更新
   - [x] 交叉引用实时更新
   - [x] 错误处理和回滚

3. **UI界面更新**
   - [x] DockPanel支持文档设置
   - [x] 实时状态显示
   - [x] 异步加载和更新
   - [x] 错误状态处理

4. **API接口更新**
   - [x] 文档设置管理方法
   - [x] 样式和格式设置方法
   - [x] 设置验证和修复
   - [x] 默认设置生成

### 🔄 待优化功能

1. **性能优化**
   - [ ] 设置缓存机制
   - [ ] 批量设置更新
   - [ ] 懒加载设置

2. **用户体验**
   - [ ] 设置导入/导出
   - [ ] 设置模板
   - [ ] 批量文档设置

## 🚀 使用方法

### 基本操作

1. **文档设置管理**
   ```typescript
   // 获取文档设置
   const settings = await settingsManager.getDocumentSettings(docId);
   
   // 更新文档设置
   await settingsManager.setDocumentSettings(docId, {
       headingNumberingEnabled: true,
       crossReferenceEnabled: false
   });
   ```

2. **样式设置**
   ```typescript
   // 设置标题编号样式
   await settingsManager.setDocumentHeadingNumberStyle(docId, 0, HeadingNumberStyle.CHINESE);
   
   // 设置编号格式
   await settingsManager.setDocumentNumberingFormat(docId, 0, '第{1}章');
   ```

3. **实时应用**
   ```typescript
   // 设置更新后自动应用
   await settingsManager.setDocumentSettings(docId, { headingNumberingEnabled: true });
   // 系统会自动应用标题编号
   ```

### 高级配置

1. **设置验证**
   ```typescript
   // 系统会自动验证和修复设置
   const settings = await settingsManager.getDocumentSettings(docId);
   // 如果设置无效，会使用默认设置
   ```

2. **错误处理**
   ```typescript
   try {
       await settingsManager.setDocumentSettings(docId, newSettings);
   } catch (error) {
       console.error('设置更新失败:', error);
       // 系统会保持原有设置
   }
   ```

## 🔍 测试验证

### 测试场景

1. **文档设置存储**
   - 创建新文档，验证默认设置
   - 修改设置，验证存储
   - 切换文档，验证设置隔离

2. **实时应用**
   - 启用标题编号，验证立即应用
   - 修改样式，验证立即更新
   - 禁用功能，验证立即清除

3. **错误处理**
   - 无效设置，验证自动修复
   - 网络错误，验证错误处理
   - 设置冲突，验证冲突解决

### 测试覆盖

- ✅ 文档设置存储和读取
- ✅ 设置验证和修复
- ✅ 实时应用机制
- ✅ 错误处理机制
- ✅ UI界面更新
- ✅ API接口功能

## 📈 性能优化

### 已实现优化

1. **异步操作**
   - 所有设置操作都是异步的
   - 不阻塞UI界面
   - 支持并发操作

2. **错误处理**
   - 完善的错误处理机制
   - 自动回滚到安全状态
   - 用户友好的错误提示

3. **设置验证**
   - 自动验证设置有效性
   - 自动修复无效设置
   - 防止设置损坏

### 监控指标

- 设置读写性能
- 实时应用响应时间
- 错误率统计
- 内存使用情况

## 🔮 未来规划

### 短期目标

1. **性能优化**
   - 实现设置缓存
   - 优化批量操作
   - 减少API调用

2. **用户体验**
   - 添加设置导入/导出
   - 实现设置模板
   - 优化错误提示

### 长期目标

1. **高级功能**
   - 设置版本管理
   - 设置同步机制
   - 设置备份恢复

2. **扩展性**
   - 插件设置系统
   - 第三方集成
   - API开放平台

## 📝 更新日志

### v2.1.0 (当前版本)
- ✨ 实现基于文档的设置系统
- ✨ 添加实时应用机制
- ✨ 完善设置验证和修复
- ✨ 优化UI界面响应
- 🔧 修复异步操作问题
- 🎨 改进错误处理机制

### 技术债务
- [ ] 添加设置缓存机制
- [ ] 优化批量设置操作
- [ ] 完善单元测试覆盖
- [ ] 添加性能监控

## 🎯 总结

本次更新成功实现了DocumentStyler插件的基于文档的设置系统，主要特点：

1. **完全基于文档**：所有设置都存储在文档属性中，支持文档级别的个性化配置
2. **实时应用**：设置更新后立即应用到当前文档，提供即时的视觉反馈
3. **健壮性**：完善的设置验证和错误处理机制，确保系统稳定性
4. **用户友好**：直观的UI界面和清晰的操作流程，提升用户体验

这些更新为DocumentStyler插件提供了更加灵活和强大的设置管理能力，为未来的功能扩展奠定了坚实的基础。 
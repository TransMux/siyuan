# DocumentStyler 文件功能清单

## 核心模块 (core/)

### DocumentManager.ts
**功能**: 文档管理器，管理当前文档状态
**主要函数**:
- `getCurrentDocId()`: 获取当前文档ID
- `getCurrentProtyle()`: 获取当前编辑器实例
- `updateCurrentDocument()`: 更新当前文档信息

### SettingsManager.ts
**功能**: 设置管理器，管理插件配置
**主要函数**:
- `getSettings()`: 获取插件设置
- `isDocumentEnabled()`: 检查文档是否启用编号
- `setDocumentEnabled()`: 设置文档编号状态

### OutlineManager.ts
**功能**: 大纲管理器，获取和缓存文档大纲数据
**主要函数**:
- `getOutline()`: 获取文档大纲数据
- `getHeadingNumberMap()`: 获取标题编号映射
- `hasHeadings()`: 检查文档是否包含标题
- `refreshOutline()`: 刷新大纲缓存

### HeadingNumbering.ts
**功能**: 标题编号管理器，基于API和CSS的新实现
**主要函数**:
- `updateNumbering()`: 更新标题编号
- `clearNumbering()`: 清除标题编号
- `updateNumberingForDoc()`: 更新指定文档的编号
- `hasNumbering()`: 检查是否已应用编号

### CrossReference.ts
**功能**: 交叉引用管理器，处理图片表格引用
**主要函数**:
- `applyCrossReference()`: 应用交叉引用
- `clearCrossReference()`: 清除交叉引用
- `getFiguresList()`: 获取图片表格列表

## UI模块 (ui/)

### StyleManager.ts
**功能**: 样式管理器，管理插件样式和动态CSS
**主要函数**:
- `applyHeadingNumbering()`: 应用标题编号样式
- `clearHeadingNumbering()`: 清除标题编号样式
- `batchUpdateNumbering()`: 批量更新编号样式
- `getNumberingStats()`: 获取编号统计信息

### EventHandler.ts
**功能**: 事件处理器，处理文档切换和编辑事件
**主要函数**:
- `onDocumentSwitch()`: 文档切换事件处理（已优化同文档检查）
- `onDocumentLoaded()`: 文档加载事件处理
- `onEdited()`: 编辑事件处理（使用transaction分析）
- `updateHeadingsForDoc()`: 更新指定文档标题

### DockPanel.ts
**功能**: 侧边栏面板，提供用户界面
**主要函数**:
- `updatePanel()`: 更新面板内容
- `renderFiguresList()`: 渲染图片表格列表

## 工具模块 (utils/)

### apiUtils.ts
**功能**: API调用工具
**主要函数**:
- `getDocumentOutline()`: 获取文档大纲API调用
- `queryDocumentFigures()`: 查询文档图片表格
- `safeApiCall()`: 安全API调用包装

### outlineUtils.ts
**功能**: 大纲解析工具
**主要函数**:
- `parseOutlineToNumberMap()`: 解析大纲生成编号映射（已修复子标题编号逻辑）
- `collectExistingLevels()`: 收集存在的标题级别
- `getHeadingLevelFromSubType()`: 从子类型获取标题级别
- `hasHeadingsInOutline()`: 检查大纲是否包含标题

### cssGenerator.ts
**功能**: CSS动态生成器
**主要函数**:
- `generateHeadingNumberCSS()`: 生成标题编号CSS
- `applyCSS()`: 应用CSS到页面
- `removeCSS()`: 移除CSS样式
- `generateCompleteCSS()`: 生成完整样式CSS

### transactionAnalyzer.ts
**功能**: WebSocket事件分析器
**主要函数**:
- `analyzeTransactionEvent()`: 分析transaction事件
- `needsUpdate()`: 检查是否需要更新
- `getAffectedDocuments()`: 获取受影响的文档

### domUtils.ts
**功能**: DOM操作工具（已清理，仅保留必要函数）
**主要函数**:
- `scrollToElementAndHighlight()`: 滚动并高亮元素
- `debounce()`: 防抖函数

### numberUtils.ts
**功能**: 数字处理工具（已清理，仅保留必要函数）
**主要函数**:
- `num2Chinese()`: 数字转中文数字

## 测试模块 (test/)

### integration.test.ts
**功能**: 集成测试
**主要函数**:
- `testOutlineParsing()`: 测试大纲解析
- `testCSSGeneration()`: 测试CSS生成
- `testTransactionAnalysis()`: 测试事件分析
- `testPerformance()`: 性能测试

## 主要改进

### 1. 代码清理
- 删除了所有未使用的函数
- 简化了工具模块，只保留实际使用的函数
- 修复了导入依赖问题

### 2. 文档切换优化
- 在`EventHandler.onDocumentSwitch()`中添加了同文档检查
- 避免不必要的重复更新

### 3. 自动编号逻辑修复
- 修复了`outlineUtils.ts`中`generateHeaderNumber`函数的占位符处理逻辑
- 确保子标题能正确生成编号（如1.1, 1.2.1等）
- 更新了测试数据以验证多层级标题编号

### 4. 架构优化
- 基于API获取大纲，避免DOM依赖
- 使用CSS动态生成编号，提升性能
- 智能事件分析，精确更新

## 文件依赖关系

```
index.ts (主插件)
├── core/
│   ├── DocumentManager.ts
│   ├── SettingsManager.ts
│   ├── OutlineManager.ts → utils/apiUtils.ts, utils/outlineUtils.ts
│   ├── HeadingNumbering.ts → OutlineManager, StyleManager
│   └── CrossReference.ts → utils/apiUtils.ts
├── ui/
│   ├── StyleManager.ts → utils/cssGenerator.ts
│   ├── EventHandler.ts → utils/transactionAnalyzer.ts, utils/domUtils.ts
│   └── DockPanel.ts → utils/domUtils.ts
└── utils/
    ├── apiUtils.ts
    ├── outlineUtils.ts → numberUtils.ts
    ├── cssGenerator.ts
    ├── transactionAnalyzer.ts
    ├── domUtils.ts
    └── numberUtils.ts
```

所有文件功能明确，依赖关系清晰，未使用的函数已清理完毕。

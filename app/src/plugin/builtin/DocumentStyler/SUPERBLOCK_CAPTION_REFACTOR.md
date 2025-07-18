# 超级块自动标题识别重构

## 概述

本次重构彻底改进了交叉引用系统，新增了对超级块中图片/表格自动标题识别的支持。当开启交叉引用功能时，系统会自动检测竖直布局的超级块，如果其中包含一个图片/表格和一个文本段落，则将文本段落自动识别为该图片/表格的标题。

## 功能特性

### 1. 智能超级块识别
- **布局检测**: 只处理竖直布局（`data-sb-layout="col"`）的超级块
- **元素数量**: 必须恰好包含两个子元素
- **类型匹配**: 一个图片/表格元素 + 一个纯文本段落

### 2. 自动标题关联
- **图片支持**: 识别包含图片的段落元素
- **表格支持**: 识别表格元素
- **文本提取**: 从相邻段落中提取纯文本作为标题
- **位置灵活**: 标题可以在图片/表格的上方或下方

### 3. 样式自动应用
- **自定义标题**: 使用提取的文本作为标题，而非自动编号
- **原段落隐藏**: 自动隐藏作为标题的原始文本段落
- **样式一致**: 保持与原有交叉引用样式的一致性

### 4. 实时更新机制
- **结构监听**: 监听超级块结构的变化
- **智能更新**: 当超级块内容发生变化时自动重新评估
- **性能优化**: 使用延迟更新避免频繁重绘

## 技术实现

### 核心算法

```typescript
// 1. 解析超级块结构
private parseSuperBlockFigures(protyle: any): ISuperBlockFigure[]

// 2. 分析单个超级块
private analyzeSuperBlock(superBlockElement: Element): ISuperBlockInfo | null

// 3. 识别图片/表格元素
private identifyFigureElement(element: Element): { type: 'image' | 'table' } | null

// 4. 查找对应标题
private findCaptionForFigure(children: Element[], figureIndex: number): Element | null
```

### CSS样式策略

```css
/* 为超级块中的图片/表格生成自定义标题 */
.protyle-wysiwyg [data-node-id="图片ID"] [data-type="img"]::after {
    content: "提取的标题文本";
    /* 标题样式 */
}

/* 隐藏原始标题段落 */
.protyle-wysiwyg [data-node-id="标题段落ID"] {
    display: none !important;
}
```

## 使用示例

### 支持的超级块结构

#### 示例1: 图片在上，标题在下
```html
<div data-type="NodeSuperBlock" data-sb-layout="col">
    <div data-type="NodeParagraph">
        <span data-type="img">
            <img src="assets/image.png" alt="">
        </span>
    </div>
    <div data-type="NodeParagraph">
        <div contenteditable="true">这是图片的标题</div>
    </div>
</div>
```

#### 示例2: 标题在上，表格在下
```html
<div data-type="NodeSuperBlock" data-sb-layout="col">
    <div data-type="NodeParagraph">
        <div contenteditable="true">数据统计表</div>
    </div>
    <div data-type="NodeTable">
        <table>...</table>
    </div>
</div>
```

### 不支持的情况

- **水平布局**: `data-sb-layout="row"` 的超级块
- **元素数量不匹配**: 超过或少于两个子元素
- **类型不匹配**: 两个图片、两个表格、或两个纯文本段落
- **复杂段落**: 包含图片的段落不能作为标题

## 向后兼容性

- **现有功能保持不变**: 非超级块中的图片/表格仍使用自动编号
- **CSS选择器优化**: 使用 `:not(.sb [data-type="img"])` 避免冲突
- **渐进增强**: 新功能不影响现有文档的显示

## 测试覆盖

### 测试用例
1. ✅ 竖直布局超级块中的图片-标题识别
2. ✅ 竖直布局超级块中的表格-标题识别  
3. ✅ 水平布局超级块应该被忽略
4. ✅ 超过两个子元素的超级块应该被忽略
5. ✅ 两个图片段落的超级块应该被忽略

### 运行测试
```typescript
// 在浏览器控制台中运行
window.runDocumentStylerTests();
```

## 性能考虑

- **按需解析**: 只在开启交叉引用时解析超级块
- **缓存机制**: 避免重复解析相同的DOM结构
- **延迟更新**: 使用100ms延迟确保DOM更新完成
- **选择器优化**: 使用高效的CSS选择器减少重绘

## 未来扩展

- **多语言支持**: 支持不同语言的标题前缀
- **自定义样式**: 允许用户自定义标题样式
- **编号混合**: 支持自定义标题与自动编号的混合使用
- **更多布局**: 支持更复杂的超级块布局模式

## 注意事项

1. **DOM结构依赖**: 功能依赖于思源笔记的特定DOM结构
2. **实时性**: 结构变化后可能有短暂延迟才能看到效果
3. **样式优先级**: 自定义样式可能被用户CSS覆盖
4. **浏览器兼容**: 使用了现代CSS特性，需要较新的浏览器支持

## 总结

这次重构成功实现了超级块中图片/表格的自动标题识别功能，大大提升了用户体验。通过智能的DOM解析和CSS样式生成，用户可以更方便地为图片和表格添加标题，而无需手动编写交叉引用代码。同时，完善的测试覆盖和向后兼容性确保了功能的稳定性和可靠性。

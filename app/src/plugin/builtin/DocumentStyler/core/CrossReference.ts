/**
 * 交叉引用管理器
 * 负责图片和表格的交叉引用功能
 */

import { ICrossReference, IFigureInfo } from "../types";
import { DocumentManager } from "./DocumentManager";
import { queryDocumentFigures } from "../utils/apiUtils";

/**
 * 超级块中的图片/表格信息
 */
interface ISuperBlockFigure {
    id: string;
    type: 'image' | 'table';
    element: Element;
    captionElement: Element | null;
    captionText: string;
}

/**
 * 超级块解析结果
 */
interface ISuperBlockInfo {
    element: Element;
    layout: 'row' | 'col';
    children: Element[];
    figures: ISuperBlockFigure[];
}

export class CrossReference implements ICrossReference {
    private documentManager: DocumentManager;

    constructor(documentManager: DocumentManager) {
        this.documentManager = documentManager;
    }

    async init(): Promise<void> {
        // 初始化时加载样式
        this.loadCrossReferenceStyles();
    }

    destroy(): void {
        this.removeCrossReferenceStyles();
    }

    async applyCrossReference(protyle: any): Promise<void> {
        if (!protyle) return;

        try {
            // 通过CSS样式实现图片和表格的自动编号和超级块自定义标题
            this.loadCrossReferenceStyles(protyle);
        } catch (error) {
            console.error('应用交叉引用失败:', error);
            throw error;
        }
    }

    async clearCrossReference(protyle: any): Promise<void> {
        if (!protyle) return;

        try {
            // 移除CSS样式
            this.removeCrossReferenceStyles();
        } catch (error) {
            console.error('清除交叉引用失败:', error);
            throw error;
        }
    }

    async getFiguresList(docId: string): Promise<IFigureInfo[]> {
        if (!docId) return [];

        try {
            const figures = await queryDocumentFigures(docId);
            return this.processFiguresData(figures);
        } catch (error) {
            console.error('获取图片表格列表失败:', error);
            return [];
        }
    }

    scrollToFigure(figureId: string): void {
        const protyle = this.documentManager.getCurrentProtyle();
        if (!protyle) {
            console.warn('没有找到活跃的编辑器');
            return;
        }

        // 在当前编辑器中查找对应的块
        const element = protyle.wysiwyg.element.querySelector(`[data-node-id="${figureId}"]`);
        if (element) {
            // 滚动到元素并高亮
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // 添加高亮效果
            element.style.transition = 'background-color 0.3s ease';
            element.style.backgroundColor = 'var(--b3-theme-primary-lighter)';

            // 2秒后移除高亮
            setTimeout(() => {
                element.style.backgroundColor = '';
            }, 2000);
        } else {
            console.warn(`未找到ID为 ${figureId} 的元素`);
        }
    }

    /**
     * 解析protyle中的所有超级块，识别符合条件的图片/表格-标题组合
     * @param protyle 编辑器实例
     * @returns 超级块中的图片/表格信息数组
     */
    private parseSuperBlockFigures(protyle: any): ISuperBlockFigure[] {
        debugger
        if (!protyle?.wysiwyg?.element) return [];

        const figures: ISuperBlockFigure[] = [];
        const superBlocks = protyle.wysiwyg.element.querySelectorAll('[data-type="NodeSuperBlock"]');

        for (const sb of superBlocks) {
            const sbInfo = this.analyzeSuperBlock(sb);
            if (sbInfo) {
                figures.push(...sbInfo.figures);
            }
        }

        return figures;
    }

    /**
     * 分析单个超级块的结构
     * @param superBlockElement 超级块DOM元素
     * @returns 超级块信息，如果不符合条件则返回null
     */
    private analyzeSuperBlock(superBlockElement: Element): ISuperBlockInfo | null {
        const layout = superBlockElement.getAttribute('data-sb-layout') as 'row' | 'col';

        // 只处理竖直布局的超级块
        if (layout !== 'row') return null;

        // 获取所有直接子元素（排除属性元素）
        const children = Array.from(superBlockElement.children).filter(child =>
            !child.classList.contains('protyle-attr')
        );

        // 必须恰好有两个子元素
        if (children.length !== 2) return null;

        const figures = this.identifyFiguresInSuperBlock(children);

        // 如果没有找到符合条件的图片/表格-标题组合，返回null
        if (figures.length === 0) return null;

        return {
            element: superBlockElement,
            layout,
            children,
            figures
        };
    }

    /**
     * 在超级块的子元素中识别图片/表格和对应的标题
     * @param children 子元素数组
     * @returns 识别出的图片/表格信息数组
     */
    private identifyFiguresInSuperBlock(children: Element[]): ISuperBlockFigure[] {
        const figures: ISuperBlockFigure[] = [];

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const figureInfo = this.identifyFigureElement(child);

            if (figureInfo) {
                // 寻找对应的标题元素
                const captionElement = this.findCaptionForFigure(children, i);
                const captionText = captionElement ? this.extractTextFromElement(captionElement) : '';

                figures.push({
                    id: child.getAttribute('data-node-id') || '',
                    type: figureInfo.type,
                    element: child,
                    captionElement,
                    captionText
                });
            }
        }

        return figures;
    }

    /**
     * 识别元素是否为图片或表格
     * @param element DOM元素
     * @returns 图片/表格信息，如果不是则返回null
     */
    private identifyFigureElement(element: Element): { type: 'image' | 'table' } | null {
        const nodeType = element.getAttribute('data-type');

        if (nodeType === 'NodeParagraph') {
            // 检查段落中是否包含图片
            const imgElement = element.querySelector('[data-type="img"]');
            if (imgElement) {
                return { type: 'image' };
            }
        } else if (nodeType === 'NodeTable') {
            return { type: 'table' };
        }

        return null;
    }

    /**
     * 为图片/表格寻找对应的标题元素
     * @param children 所有子元素
     * @param figureIndex 图片/表格元素的索引
     * @returns 标题元素，如果没有找到则返回null
     */
    private findCaptionForFigure(children: Element[], figureIndex: number): Element | null {
        // 在两个元素的超级块中，另一个元素就是潜在的标题
        const otherIndex = figureIndex === 0 ? 1 : 0;
        const otherElement = children[otherIndex];

        // 检查另一个元素是否为文本段落
        if (otherElement && otherElement.getAttribute('data-type') === 'NodeParagraph') {
            // 确保这个段落不包含图片（避免两个都是图片段落的情况）
            const hasImg = otherElement.querySelector('[data-type="img"]');
            if (!hasImg) {
                return otherElement;
            }
        }

        return null;
    }

    /**
     * 从元素中提取纯文本内容
     * @param element DOM元素
     * @returns 文本内容
     */
    private extractTextFromElement(element: Element): string {
        // 获取可编辑div中的文本内容
        const editableDiv = element.querySelector('[contenteditable="true"]');
        if (editableDiv) {
            return editableDiv.textContent?.trim() || '';
        }
        return element.textContent?.trim() || '';
    }

    /**
     * 生成超级块中图片/表格的标题样式
     * 直接给文本块添加样式，让它成为图表的标题，并添加自动编号
     * @param figures 超级块中的图片/表格信息
     * @returns CSS样式字符串
     */
    private generateSuperBlockCaptionStyles(figures: ISuperBlockFigure[]): string {
        let styles = '';

        for (const figure of figures) {
            if (figure.captionElement && figure.captionText) {
                const captionId = figure.captionElement.getAttribute('data-node-id');

                if (figure.type === 'image') {
                    // 给图片标题文本块添加样式和自动编号
                    styles += `
                        .protyle-wysiwyg [data-node-id="${captionId}"] {
                            text-align: center;
                            font-size: 0.9em;
                            color: var(--b3-theme-on-surface-light);
                            font-style: italic;
                            font-weight: 500;
                            padding: 8px 16px;
                            background-color: var(--b3-theme-surface-lightest);
                            border-radius: var(--b3-border-radius-b);
                            margin: 8px 0;
                            counter-increment: figure;
                        }

                        .protyle-wysiwyg [data-node-id="${captionId}"] [contenteditable="true"]::before {
                            content: "图 " counter(figure) ": ";
                            font-weight: 600;
                            color: var(--b3-theme-primary);
                        }
                    `;
                } else if (figure.type === 'table') {
                    // 给表格标题文本块添加样式和自动编号
                    styles += `
                        .protyle-wysiwyg [data-node-id="${captionId}"] {
                            text-align: center;
                            font-size: 0.9em;
                            color: var(--b3-theme-on-surface-light);
                            font-style: italic;
                            font-weight: 500;
                            padding: 8px 16px;
                            background-color: var(--b3-theme-surface-lightest);
                            border-radius: var(--b3-border-radius-b);
                            margin: 8px 0;
                            counter-increment: table;
                        }

                        .protyle-wysiwyg [data-node-id="${captionId}"] [contenteditable="true"]::before {
                            content: "表 " counter(table) ": ";
                            font-weight: 600;
                            color: var(--b3-theme-primary);
                        }
                    `;
                }
            }
        }

        return styles;
    }

    /**
     * 加载交叉引用样式
     * 基于思源原有的图片和表格结构，通过CSS实现自动编号和自定义标题
     */
    private loadCrossReferenceStyles(protyle?: any): void {
        // 解析超级块中的图片/表格
        debugger
        const superBlockFigures = protyle ? this.parseSuperBlockFigures(protyle) : [];

        const css = `
            /* 图片和表格计数器 */
            .protyle-wysiwyg {
                counter-reset: figure table;
            }

            /* 超级块中的图片/表格自定义标题样式 */
            ${this.generateSuperBlockCaptionStyles(superBlockFigures)}

            /* 交叉引用链接样式 */
            .protyle-wysiwyg a[href^="#figure-"],
            .protyle-wysiwyg a[href^="#table-"] {
                color: var(--b3-theme-primary);
                text-decoration: none;
                font-weight: 500;
                padding: 2px 6px;
                border-radius: 4px;
                background-color: var(--b3-theme-primary-lightest);
                border: 1px solid var(--b3-theme-primary-lighter);
                transition: all 0.2s ease;
                font-size: 0.9em;
            }

            .protyle-wysiwyg a[href^="#figure-"]:hover,
            .protyle-wysiwyg a[href^="#table-"]:hover {
                background-color: var(--b3-theme-primary-light);
                color: var(--b3-theme-on-primary);
                transform: translateY(-1px);
                box-shadow: 0 2px 4px var(--b3-theme-surface-light);
            }
        `;

        let styleElement = document.getElementById('document-styler-cross-reference') as HTMLStyleElement;
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = 'document-styler-cross-reference';
            document.head.appendChild(styleElement);
        }
        styleElement.textContent = css;
    }

    /**
     * 处理图片表格数据
     * @param figures 原始数据
     * @returns 处理后的数据
     */
    private processFiguresData(figures: any[]): IFigureInfo[] {
        const result: IFigureInfo[] = [];
        let imageCount = 0;
        let tableCount = 0;

        // 按照在文档中的顺序排序
        figures.sort((a, b) => {
            // 如果有sort字段，按sort排序，否则按id排序
            if (a.sort && b.sort) {
                return a.sort - b.sort;
            }
            return a.id.localeCompare(b.id);
        });

        for (const figure of figures) {
            if (figure.figureType === 'image') {
                imageCount++;
                result.push({
                    id: figure.id,
                    type: 'image',
                    content: this.extractImageAlt(figure.content || figure.markdown || ''),
                    caption: this.extractImageCaption(figure.content || figure.markdown || ''),
                    number: imageCount
                });
            } else if (figure.figureType === 'table') {
                tableCount++;
                result.push({
                    id: figure.id,
                    type: 'table',
                    content: this.extractTableSummary(figure.content || ''),
                    caption: this.extractTableCaption(figure.content || ''),
                    number: tableCount
                });
            }
        }

        return result;
    }

    /**
     * 提取图片的alt文本
     * @param content markdown内容
     * @returns alt文本
     */
    private extractImageAlt(content: string): string {
        // 匹配 ![alt](url) 格式
        const match = content.match(/!\[([^\]]*)\]/);
        return match ? match[1] || '图片' : '图片';
    }

    /**
     * 提取图片标题（从HTML或markdown中）
     * @param content 内容
     * @returns 标题文本
     */
    private extractImageCaption(content: string): string {
        // 尝试从HTML title属性中提取
        const titleMatch = content.match(/title="([^"]*)"/);
        if (titleMatch && titleMatch[1]) {
            return titleMatch[1];
        }

        // 尝试从markdown alt文本中提取
        const altMatch = content.match(/!\[([^\]]*)\]/);
        if (altMatch && altMatch[1]) {
            return altMatch[1];
        }

        return '';
    }

    /**
     * 提取表格摘要
     * @param content 表格内容
     * @returns 摘要文本
     */
    private extractTableSummary(content: string): string {
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length > 0) {
            // 取第一行作为表格描述，移除markdown表格语法
            const firstLine = lines[0].replace(/\|/g, ' ').replace(/[-:]/g, '').trim();
            return firstLine || '表格';
        }
        return '表格';
    }

    /**
     * 提取表格标题（从HTML属性或内容中）
     * @param content 内容
     * @returns 标题文本
     */
    private extractTableCaption(content: string): string {
        // 尝试从HTML data-table-title属性中提取
        const titleMatch = content.match(/data-table-title="([^"]*)"/);
        if (titleMatch && titleMatch[1]) {
            return titleMatch[1];
        }

        // 尝试从表格第一行提取（如果看起来像标题）
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length > 0) {
            const firstLine = lines[0].replace(/\|/g, '').trim();
            // 如果第一行不包含分隔符，可能是标题
            if (firstLine && !firstLine.includes('---') && !firstLine.includes(':::')) {
                return firstLine;
            }
        }

        return '';
    }

    /**
     * 移除交叉引用样式
     */
    private removeCrossReferenceStyles(): void {
        const styleElement = document.getElementById('document-styler-cross-reference');
        if (styleElement) {
            styleElement.remove();
        }
    }



    /**
     * 处理 WebSocket transaction 消息
     * @param msg WebSocket 消息
     */
    async handleTransactionMessage(msg: any): Promise<void> {
        try {
            // 检查当前文档是否受影响
            if (!this.documentManager.isCurrentDocumentAffected(msg)) {
                return;
            }

            // 分析是否需要更新图片表格索引或超级块结构
            const needsUpdate = this.needsFigureUpdate(msg) || this.isSuperBlockStructureChange(msg);

            if (needsUpdate) {
                const currentProtyle = this.documentManager.getCurrentProtyle();
                if (currentProtyle) {
                    // 延迟一小段时间以确保DOM更新完成
                    setTimeout(async () => {
                        try {
                            await this.applyCrossReference(currentProtyle);
                        } catch (error) {
                            console.error('CrossReference: 延迟更新失败:', error);
                        }
                    }, 100);
                }
            }
        } catch (error) {
            console.error('CrossReference: 处理 transaction 消息失败:', error);
        }
    }

    /**
     * 检查消息是否需要更新图片表格索引
     * @param msg WebSocket 消息
     * @returns 是否需要更新
     */
    private needsFigureUpdate(msg: any): boolean {
        if (!msg.data || !Array.isArray(msg.data)) {
            return false;
        }

        // 检查是否包含图片、表格或超级块相关的操作
        return msg.data.some((transaction: any) => {
            if (!transaction.doOperations || !Array.isArray(transaction.doOperations)) {
                return false;
            }

            return transaction.doOperations.some((operation: any) => {
                // 检查操作数据中是否包含相关节点类型
                if (operation.data && typeof operation.data === 'string') {
                    return operation.data.includes('data-type="NodeTable"') ||
                           operation.data.includes('<img') ||
                           operation.data.includes('data-type="NodeParagraph"') ||
                           operation.data.includes('data-type="NodeSuperBlock"') ||
                           operation.data.includes('data-sb-layout'); // 超级块布局变化
                }

                // 检查操作类型是否涉及超级块
                if (operation.action) {
                    return operation.action === 'insert' ||
                           operation.action === 'update' ||
                           operation.action === 'delete' ||
                           operation.action === 'move'; // 移动操作可能影响超级块结构
                }

                return false;
            });
        });
    }

    /**
     * 检查是否为超级块结构变化
     * @param msg WebSocket 消息
     * @returns 是否为超级块结构变化
     */
    private isSuperBlockStructureChange(msg: any): boolean {
        if (!msg.data || !Array.isArray(msg.data)) {
            return false;
        }

        return msg.data.some((transaction: any) => {
            if (!transaction.doOperations || !Array.isArray(transaction.doOperations)) {
                return false;
            }

            return transaction.doOperations.some((operation: any) => {
                // 检查是否涉及超级块的创建、删除或修改
                if (operation.data && typeof operation.data === 'string') {
                    return operation.data.includes('data-type="NodeSuperBlock"') ||
                           operation.data.includes('data-sb-layout');
                }

                // 检查是否为影响超级块子元素的操作
                if (operation.action === 'move' || operation.action === 'insert' || operation.action === 'delete') {
                    return true;
                }

                return false;
            });
        });
    }
}

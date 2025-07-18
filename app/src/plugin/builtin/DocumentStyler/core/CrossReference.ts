/**
 * 交叉引用管理器
 * 负责图片和表格的交叉引用功能
 */

import { ICrossReference, IFigureInfo } from "../types";
import { DocumentManager } from "./DocumentManager";
import { scrollToElementAndHighlight } from "../utils/domUtils";
import { queryDocumentFigures } from "../utils/apiUtils";

export class CrossReference implements ICrossReference {
    private documentManager: DocumentManager;
    private figureCounter: number = 0;
    private tableCounter: number = 0;

    constructor(documentManager: DocumentManager) {
        this.documentManager = documentManager;
    }

    async init(): Promise<void> {
        // 初始化时加载样式
        this.loadCrossReferenceStyles();
    }

    destroy(): void {
        this.removeCrossReferenceStyles();
        this.figureCounter = 0;
        this.tableCounter = 0;
    }

    async applyCrossReference(protyle: any): Promise<void> {
        if (!protyle) return;

        try {
            // 通过CSS样式实现图片和表格的自动编号
            this.loadCrossReferenceStyles();
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
            scrollToElementAndHighlight(element, 2000);
        } else {
            console.warn(`未找到ID为 ${figureId} 的元素`);
        }
    }

    /**
     * 加载交叉引用样式
     * 基于思源原有的图片和表格结构，通过CSS实现自动编号
     */
    private loadCrossReferenceStyles(): void {
        const css = `
            /* 图片和表格计数器 */
            .protyle-wysiwyg {
                counter-reset: figure table;
            }

            /* 图片自动编号 */
            .protyle-wysiwyg [data-type="img"] {
                counter-increment: figure;
                position: relative;
            }

            /* 表格自动编号 */
            .protyle-wysiwyg [data-type="table"] {
                counter-increment: table;
                position: relative;
            }

            /* 图片标题样式 - 在图片下方添加标题 */
            .protyle-wysiwyg [data-type="img"]::after {
                content: "Figure " counter(figure);
                display: block;
                text-align: center;
                font-size: 0.9em;
                color: var(--b3-theme-on-surface-light);
                margin-top: 8px;
                font-style: italic;
                font-weight: 500;
                padding: 4px 16px;
                background-color: var(--b3-theme-surface-lightest);
                border-radius: var(--b3-border-radius-b);
            }

            /* 表格标题样式 - 在表格上方添加标题 */
            .protyle-wysiwyg [data-type="table"]::before {
                content: "Table " counter(table);
                display: block;
                text-align: center;
                font-size: 0.9em;
                color: var(--b3-theme-on-surface-light);
                margin-bottom: 8px;
                font-style: italic;
                font-weight: 500;
                padding: 4px 16px;
                background-color: var(--b3-theme-surface-lightest);
                border-radius: var(--b3-border-radius-b);
            }

            /* 增强图片容器样式 */
            .protyle-wysiwyg [data-type="img"] {
                margin: 16px 0;
                padding: 8px;
                border: 1px solid var(--b3-theme-surface-lighter);
                border-radius: var(--b3-border-radius);
                transition: all 0.2s ease;
                background-color: var(--b3-theme-surface-lightest);
            }

            .protyle-wysiwyg [data-type="img"]:hover {
                border-color: var(--b3-theme-primary-lighter);
                box-shadow: 0 2px 8px var(--b3-theme-surface-light);
            }

            /* 增强表格容器样式 */
            .protyle-wysiwyg [data-type="table"] {
                margin: 16px 0;
                padding: 8px;
                border: 1px solid var(--b3-theme-surface-lighter);
                border-radius: var(--b3-border-radius);
                transition: all 0.2s ease;
                background-color: var(--b3-theme-surface-lightest);
            }

            .protyle-wysiwyg [data-type="table"]:hover {
                border-color: var(--b3-theme-primary-lighter);
                box-shadow: 0 2px 8px var(--b3-theme-surface-light);
            }

            /* 图片内部样式调整 */
            .protyle-wysiwyg [data-type="img"] img {
                border-radius: var(--b3-border-radius-b);
                max-width: 100%;
                height: auto;
            }

            /* 表格内部样式调整 */
            .protyle-wysiwyg [data-type="table"] table {
                border-radius: var(--b3-border-radius-b);
                overflow: hidden;
            }

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

            /* 选中状态样式 */
            .protyle-wysiwyg [data-type="img"].protyle-wysiwyg--select,
            .protyle-wysiwyg [data-type="table"].protyle-wysiwyg--select {
                border-color: var(--b3-theme-primary);
                background-color: var(--b3-theme-primary-lightest);
                box-shadow: 0 0 0 2px var(--b3-theme-primary-lighter);
            }

            /* 响应式设计 */
            @media (max-width: 768px) {
                .protyle-wysiwyg [data-type="img"]::after,
                .protyle-wysiwyg [data-type="table"]::before {
                    font-size: 0.8em;
                    padding: 3px 12px;
                }

                .protyle-wysiwyg [data-type="img"],
                .protyle-wysiwyg [data-type="table"] {
                    margin: 12px 0;
                    padding: 6px;
                }
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
     * 截断文本
     * @param text 原始文本
     * @param maxLength 最大长度
     * @returns 截断后的文本
     */
    private truncateText(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
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

            // 分析是否需要更新图片表格索引
            if (this.needsFigureUpdate(msg)) {
                const currentProtyle = this.documentManager.getCurrentProtyle();
                if (currentProtyle) {
                    await this.applyCrossReference(currentProtyle);
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

        // 检查是否包含图片或表格相关的操作
        return msg.data.some((transaction: any) => {
            if (!transaction.doOperations || !Array.isArray(transaction.doOperations)) {
                return false;
            }

            return transaction.doOperations.some((operation: any) => {
                // 检查操作数据中是否包含图片或表格节点
                if (operation.data && typeof operation.data === 'string') {
                    return operation.data.includes('data-type="NodeTable"') ||
                           operation.data.includes('<img') ||
                           operation.data.includes('data-type="NodeParagraph"'); // 段落中可能包含图片
                }
                return false;
            });
        });
    }
}

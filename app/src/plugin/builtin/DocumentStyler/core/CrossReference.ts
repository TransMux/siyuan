/**
 * 交叉引用管理器
 * 负责图片和表格的交叉引用功能
 */

import { ICrossReference, IFigureInfo } from "../types";
import { DocumentManager } from "./DocumentManager";
import { 
    getImageElements, 
    getTableElements, 
    scrollToElementAndHighlight,
    createStyleElement,
    removeStyleElement
} from "../utils/domUtils";
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
            // 重置计数器
            this.figureCounter = 0;
            this.tableCounter = 0;

            // 处理图片
            await this.processImages(protyle);
            
            // 处理表格
            await this.processTables(protyle);
        } catch (error) {
            console.error('应用交叉引用失败:', error);
            throw error;
        }
    }

    async clearCrossReference(protyle: any): Promise<void> {
        if (!protyle) return;

        try {
            // 清除图片标题
            this.clearImageCaptions(protyle);
            
            // 清除表格标题
            this.clearTableCaptions(protyle);
            
            // 清除处理标记
            this.clearProcessedMarkers(protyle);
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
     * 处理图片元素
     * @param protyle 编辑器实例
     */
    private async processImages(protyle: any): Promise<void> {
        const images = getImageElements(protyle);
        
        for (const img of images) {
            if (img.classList.contains('figure-processed')) continue;
            
            this.figureCounter++;
            this.addFigureCaption(img as HTMLElement, 'figure', this.figureCounter);
        }
    }

    /**
     * 处理表格元素
     * @param protyle 编辑器实例
     */
    private async processTables(protyle: any): Promise<void> {
        const tables = getTableElements(protyle);
        
        for (const table of tables) {
            if (table.classList.contains('table-processed')) continue;
            
            this.tableCounter++;
            this.addTableCaption(table as HTMLElement, 'table', this.tableCounter);
        }
    }

    /**
     * 添加图片标题
     * @param element 图片元素
     * @param type 类型
     * @param number 编号
     */
    private addFigureCaption(element: HTMLElement, type: 'figure' | 'table', number: number): void {
        if (element.classList.contains(`${type}-processed`)) return;

        element.classList.add(`${type}-processed`);
        element.setAttribute(`data-${type}-id`, `${type}-${number}`);

        const captionClass = type === 'figure' ? 'figure-caption' : 'table-caption';
        const labelClass = type === 'figure' ? 'figure-label' : 'table-label';
        const labelText = type === 'figure' ? 'Figure' : 'Table';

        const caption = document.createElement('div');
        caption.className = captionClass;
        caption.innerHTML = `<span class="${labelClass}">${labelText} ${number}:</span> <span class="caption-text">Caption text</span>`;

        if (type === 'figure') {
            element.appendChild(caption);
        } else {
            element.insertBefore(caption, element.firstChild);
        }
    }

    /**
     * 添加表格标题
     * @param element 表格元素
     * @param type 类型
     * @param number 编号
     */
    private addTableCaption(element: HTMLElement, type: 'table', number: number): void {
        this.addFigureCaption(element, type, number);
    }

    /**
     * 清除图片标题
     * @param protyle 编辑器实例
     */
    private clearImageCaptions(protyle: any): void {
        if (!protyle?.wysiwyg?.element) return;

        const captions = protyle.wysiwyg.element.querySelectorAll('.figure-caption');
        captions.forEach((caption: Element) => caption.remove());

        const processedImages = protyle.wysiwyg.element.querySelectorAll('.figure-processed');
        processedImages.forEach((img: Element) => {
            img.classList.remove('figure-processed');
            img.removeAttribute('data-figure-id');
        });
    }

    /**
     * 清除表格标题
     * @param protyle 编辑器实例
     */
    private clearTableCaptions(protyle: any): void {
        if (!protyle?.wysiwyg?.element) return;

        const captions = protyle.wysiwyg.element.querySelectorAll('.table-caption');
        captions.forEach((caption: Element) => caption.remove());

        const processedTables = protyle.wysiwyg.element.querySelectorAll('.table-processed');
        processedTables.forEach((table: Element) => {
            table.classList.remove('table-processed');
            table.removeAttribute('data-table-id');
        });
    }

    /**
     * 清除处理标记
     * @param protyle 编辑器实例
     */
    private clearProcessedMarkers(protyle: any): void {
        if (!protyle?.wysiwyg?.element) return;

        const processed = protyle.wysiwyg.element.querySelectorAll('.figure-processed, .table-processed');
        processed.forEach((element: Element) => {
            element.classList.remove('figure-processed', 'table-processed');
            element.removeAttribute('data-figure-id');
            element.removeAttribute('data-table-id');
        });
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

        for (const figure of figures) {
            if (figure.figureType === 'image') {
                imageCount++;
                result.push({
                    id: figure.id,
                    type: 'image',
                    content: this.extractImageAlt(figure.content),
                    number: imageCount
                });
            } else if (figure.figureType === 'table') {
                tableCount++;
                result.push({
                    id: figure.id,
                    type: 'table',
                    content: this.extractTableSummary(figure.content),
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
        const match = content.match(/!\[([^\]]*)\]/);
        return match ? match[1] || '图片' : '图片';
    }

    /**
     * 提取表格摘要
     * @param content 表格内容
     * @returns 摘要文本
     */
    private extractTableSummary(content: string): string {
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length > 0) {
            const firstLine = lines[0].replace(/\|/g, ' ').trim();
            return firstLine || '表格';
        }
        return '表格';
    }

    /**
     * 加载交叉引用样式
     */
    private loadCrossReferenceStyles(): void {
        const css = `
            .protyle-wysiwyg {
                counter-reset: figure table;
            }
            
            .protyle-wysiwyg [data-type="img"]:not(.figure-processed) {
                counter-increment: figure;
            }
            
            .protyle-wysiwyg [data-type="table"]:not(.table-processed) {
                counter-increment: table;
            }
            
            .figure-caption {
                text-align: center;
                font-size: 0.9em;
                color: var(--b3-theme-on-surface-light);
                margin-top: 8px;
                font-style: italic;
            }
            
            .figure-caption .figure-label {
                font-weight: bold;
                color: var(--b3-theme-on-surface);
            }
            
            .table-caption {
                text-align: center;
                font-size: 0.9em;
                color: var(--b3-theme-on-surface-light);
                margin-bottom: 8px;
                font-style: italic;
            }
            
            .table-caption .table-label {
                font-weight: bold;
                color: var(--b3-theme-on-surface);
            }
        `;

        createStyleElement('document-styler-figure-captions', css);
    }

    /**
     * 移除交叉引用样式
     */
    private removeCrossReferenceStyles(): void {
        removeStyleElement('document-styler-figure-captions');
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
}

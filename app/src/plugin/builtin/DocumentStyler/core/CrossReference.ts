/**
 * 交叉引用管理器
 * 负责图片和表格的交叉引用功能
 */

import { ICrossReference, IFigureInfo } from "../types";
import { DocumentManager } from "./DocumentManager";
import { queryDocumentFigures } from "../utils/apiUtils";



export class CrossReference implements ICrossReference {
    private documentManager: DocumentManager;

    constructor(documentManager: DocumentManager) {
        this.documentManager = documentManager;
    }

    async init(): Promise<void> {
        // 初始化时加载样式
        await this.loadCrossReferenceStyles();

        // 注册@符号交叉引用功能
        this.registerCrossReferenceHint();

        // 注册交叉引用点击处理
        this.registerCrossReferenceClickHandler();
    }

    destroy(): void {
        this.removeCrossReferenceStyles();
        this.unregisterCrossReferenceHint();

        // 清理observer
        if ((this as any).protyleObserver) {
            (this as any).protyleObserver.disconnect();
            delete (this as any).protyleObserver;
        }
    }

    async applyCrossReference(protyle: any): Promise<void> {
        if (!protyle) return;

        try {
            // 通过CSS样式实现图片和表格的自动编号和超级块自定义标题
            await this.loadCrossReferenceStyles(protyle);
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
            return await this.processFiguresData(figures);
        } catch (error) {
            console.error('获取图片表格列表失败:', error);
            return [];
        }
    }













    /**
     * 生成图表标题样式（基于DOM解析的数据）
     * 由于图表数据已经从DOM解析并包含了标题信息，这里只需要生成基本的样式
     * 实际的标题显示已经通过DOM解析时的处理完成
     * @param figuresData 图表数据（包含标题信息和编号）
     * @returns CSS样式字符串
     */
    private generateFigureCaptionStyles(_figuresData: IFigureInfo[]): string {
        // 由于现在图表和标题的关联已经在DOM解析时处理完成
        // 这里只需要返回空字符串，或者可以添加一些通用的图表样式
        return '';
    }

    /**
     * 加载交叉引用样式
     * 基于从完整DOM结构解析出来的图表数据，通过CSS实现自动编号和自定义标题
     */
    private async loadCrossReferenceStyles(protyle?: any): Promise<void> {
        // 获取当前文档的所有图片表格数据（现在从完整DOM结构解析，包含正确编号和标题）
        let figuresData: IFigureInfo[] = [];

        if (protyle?.block?.rootID) {
            try {
                // 从完整DOM结构获取图表数据
                figuresData = await this.getFiguresList(protyle.block.rootID);

                // 由于现在图表数据已经包含了标题信息，我们可以直接使用
                // 不再需要复杂的超级块解析，因为标题信息已经在figuresData中了
            } catch (error) {
                console.error('获取图片表格数据失败:', error);
            }
        }

        const css = `
            /* 超级块中的图片/表格自定义标题样式 */
            ${this.generateFigureCaptionStyles(figuresData)}

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
     * 处理从DOM解析出来的符合条件的图表数据
     * @param figures 从DOM解析的图表数据（已经包含正确顺序和标题信息）
     * @returns 处理后的数据
     */
    private async processFiguresData(figures: any[]): Promise<IFigureInfo[]> {
        const result: IFigureInfo[] = [];
        let imageCount = 0;
        let tableCount = 0;

        // 从DOM解析的数据，按照domOrder排序
        console.log('CrossReference: 使用DOM解析的数据，按domOrder排序');
        figures.sort((a, b) => {
            if (a.domOrder !== undefined && b.domOrder !== undefined) {
                return a.domOrder - b.domOrder;
            }
            // 如果没有domOrder，回退到ID排序
            return a.id.localeCompare(b.id);
        });

        console.log('CrossReference: 排序后的图片表格:', figures.map(f => ({
            id: f.id,
            type: f.figureType,
            domOrder: f.domOrder,
            caption: f.caption
        })));

        for (const figure of figures) {
            if (figure.figureType === 'image') {
                imageCount++;
                result.push({
                    id: figure.id,
                    type: 'image',
                    // 优先使用从DOM解析出来的标题，如果没有则从内容中提取
                    content: figure.caption || this.extractImageAlt(figure.content || figure.markdown || ''),
                    caption: figure.caption || this.extractImageCaption(figure.content || figure.markdown || ''),
                    number: imageCount
                });
            } else if (figure.figureType === 'table') {
                tableCount++;
                result.push({
                    id: figure.id,
                    type: 'table',
                    // 优先使用从DOM解析出来的标题，如果没有则从内容中提取
                    content: figure.caption || this.extractTableSummary(figure.content || ''),
                    caption: figure.caption || this.extractTableCaption(figure.content || ''),
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
            if (this.needsFigureUpdate(msg)) {
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
     * 注册@符号交叉引用功能
     */
    private registerCrossReferenceHint(): void {
        // 检查是否已经有protyle实例可用
        const protyles = document.querySelectorAll('.protyle');
        protyles.forEach((protyleElement) => {
            const protyle = (protyleElement as any).protyle;
            if (protyle && protyle.options && protyle.options.hint) {
                // 添加@符号的hint扩展
                if (!protyle.options.hint.extend) {
                    protyle.options.hint.extend = [];
                }

                // 检查是否已经注册过
                const existingIndex = protyle.options.hint.extend.findIndex((item: any) => item.key === '@');
                if (existingIndex === -1) {
                    protyle.options.hint.extend.push({
                        key: '@',
                        hint: this.generateCrossReferenceHints.bind(this)
                    });
                    console.log('CrossReference: 已注册@符号交叉引用功能');
                }
            }
        });

        // 监听新的protyle创建
        this.setupProtyleListener();
    }

    /**
     * 注销@符号交叉引用功能
     */
    private unregisterCrossReferenceHint(): void {
        const protyles = document.querySelectorAll('.protyle');
        protyles.forEach((protyleElement) => {
            const protyle = (protyleElement as any).protyle;
            if (protyle && protyle.options && protyle.options.hint && protyle.options.hint.extend) {
                // 移除@符号的hint扩展
                const index = protyle.options.hint.extend.findIndex((item: any) => item.key === '@');
                if (index !== -1) {
                    protyle.options.hint.extend.splice(index, 1);
                    console.log('CrossReference: 已注销@符号交叉引用功能');
                }
            }
        });
    }

    /**
     * 设置protyle监听器，为新创建的protyle添加hint扩展
     */
    private setupProtyleListener(): void {
        // 监听DOM变化，当有新的protyle创建时自动注册hint
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as Element;
                        if (element.classList && element.classList.contains('protyle')) {
                            // 延迟一下确保protyle完全初始化
                            setTimeout(() => {
                                const protyle = (element as any).protyle;
                                if (protyle && protyle.options && protyle.options.hint) {
                                    if (!protyle.options.hint.extend) {
                                        protyle.options.hint.extend = [];
                                    }

                                    const existingIndex = protyle.options.hint.extend.findIndex((item: any) => item.key === '@');
                                    if (existingIndex === -1) {
                                        protyle.options.hint.extend.push({
                                            key: '@',
                                            hint: this.generateCrossReferenceHints.bind(this)
                                        });
                                        console.log('CrossReference: 为新protyle注册@符号交叉引用功能');
                                    }
                                }
                            }, 100);
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // 保存observer引用以便后续清理
        (this as any).protyleObserver = observer;
    }

    /**
     * 生成交叉引用提示
     * @param key 输入的关键字
     * @param protyle 编辑器实例
     * @param source 来源
     * @returns 提示数据数组
     */
    private async generateCrossReferenceHints(key: string, protyle: any): Promise<any[]> {
        if (!protyle || !protyle.block || !protyle.block.rootID) {
            return [];
        }

        try {
            const docId = protyle.block.rootID;
            const figures = await this.getFiguresList(docId);

            const hints: any[] = [];

            // 过滤匹配的图片和表格
            figures.forEach((figure) => {
                const searchText = `${figure.type === 'image' ? '图' : '表'} ${figure.number}`;
                const content = figure.content || figure.caption || '';

                if (!key || searchText.includes(key) || content.includes(key)) {
                    hints.push({
                        value: `<span data-type="cross-ref" data-figure-id="${figure.id}" data-figure-type="${figure.type}" data-figure-number="${figure.number}">${searchText}</span>`,
                        html: `<div class="b3-list-item__first">
                            <svg class="b3-list-item__graphic">
                                <use xlink:href="#icon${figure.type === 'image' ? 'Image' : 'Table'}"></use>
                            </svg>
                            <span class="b3-list-item__text">${searchText}${content ? ': ' + content : ''}</span>
                        </div>`,
                        id: figure.id,
                        focus: false
                    });
                }
            });

            return hints;
        } catch (error) {
            console.error('CrossReference: 生成交叉引用提示失败:', error);
            return [];
        }
    }

    /**
     * 注册交叉引用点击处理器
     */
    private registerCrossReferenceClickHandler(): void {
        // 使用事件委托处理交叉引用点击
        document.addEventListener('click', this.handleCrossReferenceClick.bind(this));
    }

    /**
     * 处理交叉引用点击事件
     * @param event 点击事件
     */
    private handleCrossReferenceClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        const crossRefElement = target.closest('[data-type="cross-ref"]') as HTMLElement;

        if (crossRefElement) {
            event.preventDefault();
            event.stopPropagation();

            const figureId = crossRefElement.getAttribute('data-figure-id');
            const figureType = crossRefElement.getAttribute('data-figure-type');
            const figureNumber = crossRefElement.getAttribute('data-figure-number');

            if (figureId) {
                this.scrollToFigure(figureId, figureType, figureNumber);
            }
        }
    }

    /**
     * 滚动到指定的图片或表格
     * @param figureId 图片或表格的ID
     * @param figureType 类型（image或table）
     * @param figureNumber 编号
     */
    scrollToFigure(figureId: string, figureType?: string, figureNumber?: string): void {
        const targetElement = document.querySelector(`[data-node-id="${figureId}"]`) as HTMLElement;

        if (targetElement) {
            // 滚动到目标元素
            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });

            // 高亮显示目标元素
            targetElement.style.transition = 'background-color 0.3s ease';
            targetElement.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';

            setTimeout(() => {
                targetElement.style.backgroundColor = '';
                setTimeout(() => {
                    targetElement.style.transition = '';
                }, 300);
            }, 1500);

            console.log(`CrossReference: 跳转到${figureType === 'image' ? '图片' : '表格'} ${figureNumber}`);
        } else {
            console.warn(`CrossReference: 未找到ID为 ${figureId} 的${figureType === 'image' ? '图片' : '表格'}`);
        }
    }
}

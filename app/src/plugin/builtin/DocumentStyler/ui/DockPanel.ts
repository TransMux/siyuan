/**
 * 侧边栏面板管理器
 * 负责管理插件的侧边栏面板UI
 */

import { Custom } from "../../../../layout/dock/Custom";
import { IDockPanel, IFigureInfo, HeadingNumberStyle } from "../types";
import { SettingsManager } from "../core/SettingsManager";
import { DocumentManager } from "../core/DocumentManager";
import { CrossReference } from "../core/CrossReference";
import { NumberStyleConverter } from "../utils/numberStyleConverter";

export class DockPanel implements IDockPanel {
    private settingsManager: SettingsManager;
    private documentManager: DocumentManager;
    private crossReference: CrossReference;
    private customElement: Custom | null = null;
    private panelElement: Element | null = null;
    private pluginInstance: any; // 主插件实例
    private eventsInitialized: boolean = false; // 标记事件是否已初始化
    private updateTimeout: NodeJS.Timeout | null = null; // 防抖定时器

    constructor(
        settingsManager: SettingsManager,
        documentManager: DocumentManager,
        crossReference: CrossReference,
        pluginInstance?: any
    ) {
        this.settingsManager = settingsManager;
        this.documentManager = documentManager;
        this.crossReference = crossReference;
        this.pluginInstance = pluginInstance;
    }

    async init(): Promise<void> {
        // 初始化将在主插件类中调用 initDockPanel 时完成
    }

    destroy(): void {
        // 清理事件监听器
        this.clearPanelEvents();

        // 清理防抖定时器
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = null;
        }

        this.customElement = null;
        this.panelElement = null;
        this.eventsInitialized = false;
    }

    /**
     * 初始化面板
     * @param custom 自定义面板实例
     */
    async initPanel(custom: Custom): Promise<void> {
        if (!custom || !custom.element) {
            console.error('DocumentStyler: Custom element not available');
            return;
        }

        try {
            this.customElement = custom;
            this.panelElement = custom.element;

            // 重置事件初始化状态
            this.eventsInitialized = false;

            custom.element.innerHTML = await this.generatePanelHTML();
            await this.updatePanel();
            this.bindPanelEvents();
        } catch (error) {
            console.error('DocumentStyler: Error initializing dock panel:', error);
        }
    }

    async updatePanel(): Promise<void> {
        if (!this.panelElement) return;

        try {
            await this.updateCurrentDocInfo();
            await this.updateSettingsUI();
            await this.updateFiguresList();
        } catch (error) {
            console.error('更新面板失败:', error);
        }
    }

    showPanel(): void {
        // 显示面板的逻辑由思源的dock系统处理
    }

    hidePanel(): void {
        // 隐藏面板的逻辑由思源的dock系统处理
    }

    /**
     * 防抖更新标题编号
     */
    private debounceApplyHeadingNumbering(): void {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }

        this.updateTimeout = setTimeout(async () => {
            if (this.pluginInstance) {
                try {
                    await this.pluginInstance.applyHeadingNumbering();
                } catch (error) {
                    console.error('防抖应用标题编号失败:', error);
                }
            }
        }, 300); // 300ms延迟
    }

    /**
     * 生成面板HTML
     */
    private async generatePanelHTML(): Promise<string> {
        const docId = this.documentManager.getCurrentDocId();
        let docSettings = null;

        if (docId) {
            try {
                docSettings = await this.settingsManager.getDocumentSettings(docId);
            } catch (error) {
                console.error('获取文档设置失败:', error);
            }
        }

        // 如果没有文档设置，使用默认设置
        if (!docSettings) {
            docSettings = this.settingsManager.getDefaultDocumentSettings();
        }

        return `
            <div class="document-styler-panel">
                <div class="block__icons">
                    <div class="block__logo">
                        <svg class="block__logoicon"><use xlink:href="#iconEdit"></use></svg>
                        文档样式设置
                    </div>
                </div>
                
                <div class="document-styler-content">
                    <!-- 当前文档状态 -->
                    <div class="document-styler-section">
                        <h3 class="document-styler-section-title">当前文档状态</h3>

                        <label class="fn__flex b3-label">
                            <div class="fn__flex-1">
                                标题自动编号
                                <div class="b3-label__text">启用标题编号功能</div>
                            </div>
                            <span class="fn__space"></span>
                            <input class="b3-switch fn__flex-center" id="doc-heading-enabled" type="checkbox" checked="">
                        </label>

                        <label class="fn__flex b3-label">
                            <div class="fn__flex-1">
                                交叉引用
                                <div class="b3-label__text">为图片和表格添加编号标签</div>
                            </div>
                            <span class="fn__space"></span>
                            <input class="b3-switch fn__flex-center" id="doc-crossref-enabled" type="checkbox" checked="">
                        </label>
                    </div>

                    <!-- 标题编号样式设置 -->
                    <div class="document-styler-section" id="heading-styles-section" style="${docSettings.headingNumberingEnabled ? '' : 'display: none;'}">
                        <h3 class="document-styler-section-title">标题编号样式</h3>
                        <div id="heading-styles-container">
                            ${this.generateHeadingStylesHTML(docSettings.numberingFormats, docSettings.headingNumberStyles)}
                        </div>
                    </div>

                    <!-- 当前文档信息 -->
                    <div class="document-styler-section">
                        <h3 class="document-styler-section-title">当前文档</h3>
                        <div class="document-styler-info" id="current-doc-info">
                            未选择文档
                        </div>
                    </div>

                    <!-- 图片表格列表 -->
                    <div class="document-styler-section" id="figures-section" style="${docSettings.crossReferenceEnabled ? '' : 'display: none;'}">
                        <h3 class="document-styler-section-title">文档内容</h3>
                        <div class="document-styler-figures-list" id="figures-list">
                            <!-- 动态生成的图片表格列表 -->
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 生成标题编号样式设置HTML
     */
    private generateHeadingStylesHTML(numberingFormats: string[], headingNumberStyles: HeadingNumberStyle[]): string {
        const styleOptions = NumberStyleConverter.getStyleOptions();
        let html = '';

        for (let i = 0; i < 6; i++) {
            const level = i + 1;
            const currentStyle = headingNumberStyles[i];
            const format = numberingFormats[i];

            html += `
                <div class="document-styler-option">
                    <div class="document-styler-option-header">
                        <span class="document-styler-level-label">H${level} 样式</span>
                    </div>
                    
                    <input type="text" class="b3-text-field" 
                            id="format-${i}" 
                            value="${format}" 
                            placeholder="例如: {1}. 或 第{1}章">

                    <select class="b3-select" id="heading-style-${i}">
                        ${styleOptions.map(option =>
                `<option value="${option.value}" ${option.value === currentStyle ? 'selected' : ''}>
                                ${option.example}
                            </option>`
            ).join('')}
                    </select>
                </div>
            `;
        }

        return html;
    }

    /**
     * 绑定面板事件
     */
    private bindPanelEvents(): void {
        if (!this.panelElement) return;

        // 清除之前的事件监听器
        this.clearPanelEvents();



        // 标题编号样式选择器
        for (let i = 0; i < 6; i++) {
            const styleSelect = this.panelElement.querySelector(`#heading-style-${i}`) as HTMLSelectElement;
            if (styleSelect) {
                const handler = async (e: Event) => {
                    const docId = this.documentManager.getCurrentDocId();
                    if (!docId) return;

                    const style = (e.target as HTMLSelectElement).value as HeadingNumberStyle;
                    console.log(`DocumentStyler: 标题编号样式改变 - 级别${i + 1}, 样式: ${style}`);

                    await this.settingsManager.setDocumentHeadingNumberStyle(docId, i, style);
                    this.updateStyleExample(i, style);

                    // 如果标题编号功能已启用，使用防抖更新，只应用标题编号
                    const docSettings = await this.settingsManager.getDocumentSettings(docId);
                    if (docSettings.headingNumberingEnabled) {
                        this.debounceApplyHeadingNumbering();
                    }
                };
                styleSelect.addEventListener('change', handler);
                // 存储事件处理器以便后续清理
                (styleSelect as any)._documentStylerHandler = handler;
            }
        }

        // 编号格式输入框
        for (let i = 0; i < 6; i++) {
            const formatInput = this.panelElement.querySelector(`#format-${i}`) as HTMLInputElement;
            if (formatInput) {
                const handler = async (e: Event) => {
                    const docId = this.documentManager.getCurrentDocId();
                    if (!docId) return;

                    const format = (e.target as HTMLInputElement).value;
                    console.log(`DocumentStyler: 编号格式改变 - 级别${i + 1}, 格式: ${format}`);

                    await this.settingsManager.setDocumentNumberingFormat(docId, i, format);

                    // 如果标题编号功能已启用，使用防抖更新，只应用标题编号
                    const docSettings = await this.settingsManager.getDocumentSettings(docId);
                    if (docSettings.headingNumberingEnabled) {
                        this.debounceApplyHeadingNumbering();
                    }
                };
                formatInput.addEventListener('change', handler);
                // 存储事件处理器以便后续清理
                (formatInput as any)._documentStylerHandler = handler;
            }
        }
    }

    /**
     * 清除面板事件监听器
     */
    private clearPanelEvents(): void {
        if (!this.panelElement) return;

        // 清除标题编号样式选择器事件
        for (let i = 0; i < 6; i++) {
            const styleSelect = this.panelElement.querySelector(`#heading-style-${i}`) as HTMLSelectElement;
            if (styleSelect && (styleSelect as any)._documentStylerHandler) {
                styleSelect.removeEventListener('change', (styleSelect as any)._documentStylerHandler);
                delete (styleSelect as any)._documentStylerHandler;
            }
        }

        // 清除编号格式输入框事件
        for (let i = 0; i < 6; i++) {
            const formatInput = this.panelElement.querySelector(`#format-${i}`) as HTMLInputElement;
            if (formatInput && (formatInput as any)._documentStylerHandler) {
                formatInput.removeEventListener('change', (formatInput as any)._documentStylerHandler);
                delete (formatInput as any)._documentStylerHandler;
            }
        }

        // 清除文档状态事件
        this.clearDocumentStatusEvents();
    }

    /**
     * 应用文档设置
     * @param docId 文档ID
     */
    private async applyDocumentSettings(docId: string): Promise<void> {
        try {
            const settings = await this.settingsManager.getDocumentSettings(docId);
            await this.applyHeadingNumberingSettings(docId, settings.headingNumberingEnabled);
            await this.applyCrossReferenceSettings(docId, settings.crossReferenceEnabled);
        } catch (error) {
            console.error('应用文档设置失败:', error);
        }
    }

    /**
     * 应用标题编号设置
     * @param docId 文档ID
     * @param enabled 是否启用标题编号
     */
    private async applyHeadingNumberingSettings(docId: string, enabled: boolean): Promise<void> {
        try {
            if (enabled) {
                if (this.pluginInstance) {
                    await this.pluginInstance.applyHeadingNumbering();
                } else {
                    console.warn('DocumentStyler: 插件实例不可用，无法应用标题编号');
                }
            } else {
                if (this.pluginInstance) {
                    await this.pluginInstance.clearHeadingNumbering();
                } else {
                    console.warn('DocumentStyler: 插件实例不可用，无法清除标题编号');
                }
            }
        } catch (error) {
            console.error('应用标题编号设置失败:', error);
        }
    }

    /**
     * 应用交叉引用设置
     * @param docId 文档ID
     * @param enabled 是否启用交叉引用
     */
    private async applyCrossReferenceSettings(docId: string, enabled: boolean): Promise<void> {
        try {
            if (enabled) {
                if (this.pluginInstance) {
                    await this.pluginInstance.applyCrossReference();
                } else {
                    console.warn('DocumentStyler: 插件实例不可用，无法应用交叉引用');
                }
            } else {
                if (this.pluginInstance) {
                    await this.pluginInstance.clearCrossReference();
                } else {
                    console.warn('DocumentStyler: 插件实例不可用，无法清除交叉引用');
                }
            }
        } catch (error) {
            console.error('应用交叉引用设置失败:', error);
        }
    }

    /**
     * 更新样式示例显示
     */
    private updateStyleExample(level: number, style: HeadingNumberStyle): void {
        const exampleElement = this.panelElement?.querySelector(`#heading-style-${level}`)?.parentElement?.querySelector('.document-styler-style-example');
        if (exampleElement) {
            const example = NumberStyleConverter.getExample(style);
            exampleElement.textContent = example;
            console.log(`DocumentStyler: 更新样式示例 - 级别${level + 1}, 样式: ${style}, 示例: ${example}`);
        } else {
            console.warn(`DocumentStyler: 未找到样式示例元素 - 级别${level + 1}`);
        }
    }

    /**
     * 更新当前文档信息
     */
    private async updateCurrentDocInfo(): Promise<void> {
        const infoElement = this.panelElement?.querySelector('#current-doc-info');
        if (!infoElement) return;

        const docId = this.documentManager.getCurrentDocId();
        if (!docId) {
            infoElement.textContent = '未选择文档';
            return;
        }

        try {
            const docInfo = await this.documentManager.getDocumentInfo(docId);
            if (docInfo) {
                infoElement.textContent = docInfo.title;
            } else {
                infoElement.textContent = `文档ID: ${docId.substring(0, 8)}...`;
            }
        } catch (error) {
            console.error('更新文档信息失败:', error);
            infoElement.textContent = `文档ID: ${docId.substring(0, 8)}...`;
        }
    }

    /**
     * 更新设置UI
     */
    private async updateSettingsUI(): Promise<void> {
        if (!this.panelElement) return;

        const docId = this.documentManager.getCurrentDocId();
        if (!docId) return;

        try {
            const docSettings = await this.settingsManager.getDocumentSettings(docId);

            // 更新当前文档状态显示
            await this.updateCurrentDocumentStatus(docId);

            // 更新编号格式和样式
            for (let i = 0; i < 6; i++) {
                const formatInput = this.panelElement.querySelector(`#format-${i}`) as HTMLInputElement;
                if (formatInput) formatInput.value = docSettings.numberingFormats[i];

                const styleSelect = this.panelElement.querySelector(`#heading-style-${i}`) as HTMLSelectElement;
                if (styleSelect) styleSelect.value = docSettings.headingNumberStyles[i];
            }

            // 更新节的显示状态
            this.toggleHeadingStylesSection(docSettings.headingNumberingEnabled);
            this.toggleNumberingFormatsSection(docSettings.headingNumberingEnabled);
            this.toggleFiguresSection(docSettings.crossReferenceEnabled);
        } catch (error) {
            console.error('更新设置UI失败:', error);
        }
    }

    /**
     * 更新当前文档状态显示
     */
    private async updateCurrentDocumentStatus(docId: string | null): Promise<void> {
        if (!docId) return;

        try {
            const docSettings = await this.settingsManager.getDocumentSettings(docId);
            console.log(`DocumentStyler: 更新文档状态显示 - 文档ID: ${docId}`, docSettings);

            // 更新标题编号开关
            const headingCheckbox = this.panelElement?.querySelector('#doc-heading-enabled') as HTMLInputElement;
            if (headingCheckbox) {
                headingCheckbox.checked = docSettings.headingNumberingEnabled;
            }

            // 更新交叉引用开关
            const crossRefCheckbox = this.panelElement?.querySelector('#doc-crossref-enabled') as HTMLInputElement;
            if (crossRefCheckbox) {
                crossRefCheckbox.checked = docSettings.crossReferenceEnabled;
            }

            // 只在初始化时绑定事件，避免重复绑定
            if (!this.eventsInitialized) {
                this.bindDocumentStatusEvents(docId);
                this.eventsInitialized = true;
            }
        } catch (error) {
            console.error('更新文档状态失败:', error);
        }
    }

    /**
     * 绑定文档状态事件
     */
    private bindDocumentStatusEvents(docId: string): void {
        // 先清除之前的事件监听器
        this.clearDocumentStatusEvents();

        const headingCheckbox = this.panelElement?.querySelector('#doc-heading-enabled') as HTMLInputElement;
        const crossRefCheckbox = this.panelElement?.querySelector('#doc-crossref-enabled') as HTMLInputElement;

        if (headingCheckbox) {
            const headingHandler = async (e: Event) => {
                const enabled = (e.target as HTMLInputElement).checked;
                console.log(`DocumentStyler: 标题编号开关改变 - 启用: ${enabled}`);

                await this.settingsManager.setDocumentSettings(docId, { headingNumberingEnabled: enabled });
                this.toggleHeadingStylesSection(enabled);
                this.toggleNumberingFormatsSection(enabled);

                // 只应用标题编号相关的设置，不影响交叉引用
                await this.applyHeadingNumberingSettings(docId, enabled);
            };
            headingCheckbox.addEventListener('change', headingHandler);
            (headingCheckbox as any)._documentStylerHandler = headingHandler;
        }

        if (crossRefCheckbox) {
            const crossRefHandler = async (e: Event) => {
                const enabled = (e.target as HTMLInputElement).checked;
                console.log(`DocumentStyler: 交叉引用开关改变 - 启用: ${enabled}`);

                await this.settingsManager.setDocumentSettings(docId, { crossReferenceEnabled: enabled });
                this.toggleFiguresSection(enabled);

                // 只应用交叉引用相关的设置，不影响标题编号
                await this.applyCrossReferenceSettings(docId, enabled);
            };
            crossRefCheckbox.addEventListener('change', crossRefHandler);
            (crossRefCheckbox as any)._documentStylerHandler = crossRefHandler;
        }
    }

    /**
     * 清除文档状态事件监听器
     */
    private clearDocumentStatusEvents(): void {
        if (!this.panelElement) return;

        const headingCheckbox = this.panelElement.querySelector('#doc-heading-enabled') as HTMLInputElement;
        if (headingCheckbox && (headingCheckbox as any)._documentStylerHandler) {
            headingCheckbox.removeEventListener('change', (headingCheckbox as any)._documentStylerHandler);
            delete (headingCheckbox as any)._documentStylerHandler;
        }

        const crossRefCheckbox = this.panelElement.querySelector('#doc-crossref-enabled') as HTMLInputElement;
        if (crossRefCheckbox && (crossRefCheckbox as any)._documentStylerHandler) {
            crossRefCheckbox.removeEventListener('change', (crossRefCheckbox as any)._documentStylerHandler);
            delete (crossRefCheckbox as any)._documentStylerHandler;
        }
    }

    /**
     * 更新图片表格列表
     */
    private async updateFiguresList(): Promise<void> {
        const listElement = this.panelElement?.querySelector('#figures-list');
        if (!listElement) return;

        const docId = this.documentManager.getCurrentDocId();
        if (!docId) {
            listElement.innerHTML = '<div class="b3-list--empty">未选择文档</div>';
            return;
        }

        try {
            const figures = await this.crossReference.getFiguresList(docId);
            listElement.innerHTML = this.generateFiguresListHTML(figures);
        } catch (error) {
            console.error('更新图片表格列表失败:', error);
            listElement.innerHTML = '<div class="b3-list--empty">加载失败</div>';
        }
    }

    /**
     * 生成图片表格列表HTML
     */
    private generateFiguresListHTML(figures: IFigureInfo[]): string {
        if (figures.length === 0) {
            return '<div class="b3-list--empty">当前文档中没有图片或表格</div>';
        }

        const images = figures.filter(f => f.type === 'image');
        const tables = figures.filter(f => f.type === 'table');

        let html = '';

        if (images.length > 0) {
            html += '<div class="document-styler-subsection"><h4>图片</h4>';
            images.forEach((figure) => {
                const displayText = figure.caption || figure.content || `图片 ${figure.number}`;
                html += `
                    <div class="document-styler-figure-item" data-id="${figure.id}" onclick="window.documentStylerPlugin?.scrollToFigure('${figure.id}')">
                        <span class="figure-label">Figure ${figure.number}</span>
                        <span class="figure-content">${this.truncateText(displayText, 50)}</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        if (tables.length > 0) {
            html += '<div class="document-styler-subsection"><h4>表格</h4>';
            tables.forEach((table) => {
                const displayText = table.caption || table.content || `表格 ${table.number}`;
                html += `
                    <div class="document-styler-figure-item" data-id="${table.id}" onclick="window.documentStylerPlugin?.scrollToFigure('${table.id}')">
                        <span class="table-label">Table ${table.number}</span>
                        <span class="figure-content">${this.truncateText(displayText, 50)}</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        return html;
    }

    /**
     * 切换标题编号样式节的显示
     */
    private toggleHeadingStylesSection(show: boolean): void {
        const section = this.panelElement?.querySelector('#heading-styles-section') as HTMLElement;
        if (section) {
            section.style.display = show ? '' : 'none';
        }
    }

    /**
     * 切换编号格式设置节的显示
     */
    private toggleNumberingFormatsSection(show: boolean): void {
        const section = this.panelElement?.querySelector('#numbering-formats-section') as HTMLElement;
        if (section) {
            section.style.display = show ? '' : 'none';
        }
    }

    /**
     * 切换图片表格节的显示
     */
    private toggleFiguresSection(show: boolean): void {
        const section = this.panelElement?.querySelector('#figures-section') as HTMLElement;
        if (section) {
            section.style.display = show ? '' : 'none';
        }
    }

    /**
     * 截断文本
     */
    private truncateText(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

}

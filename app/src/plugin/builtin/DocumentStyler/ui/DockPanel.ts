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

    constructor(
        settingsManager: SettingsManager,
        documentManager: DocumentManager,
        crossReference: CrossReference
    ) {
        this.settingsManager = settingsManager;
        this.documentManager = documentManager;
        this.crossReference = crossReference;
    }

    async init(): Promise<void> {
        // 初始化将在主插件类中调用 initDockPanel 时完成
    }

    destroy(): void {
        this.customElement = null;
        this.panelElement = null;
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
            
            custom.element.innerHTML = await this.generatePanelHTML();
            this.bindPanelEvents();
            this.updatePanel();
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
                        <div id="current-doc-status">
                            <div class="b3-label">加载中...</div>
                        </div>
                    </div>

                    <!-- 文档功能设置 -->
                    <div class="document-styler-section">
                        <h3 class="document-styler-section-title">文档功能</h3>
                        <div class="document-styler-option">
                            <label class="fn__flex b3-label">
                                <div class="fn__flex-1">
                                    标题自动编号
                                    <div class="b3-label__text">启用标题编号功能</div>
                                </div>
                                <span class="fn__space"></span>
                                <input class="b3-switch fn__flex-center" id="heading-numbering" type="checkbox" ${docSettings.headingNumberingEnabled ? 'checked' : ''}>
                            </label>
                        </div>
                        <div class="document-styler-option">
                            <label class="fn__flex b3-label">
                                <div class="fn__flex-1">
                                    交叉引用
                                    <div class="b3-label__text">为图片和表格添加编号标签</div>
                                </div>
                                <span class="fn__space"></span>
                                <input class="b3-switch fn__flex-center" id="cross-reference" type="checkbox" ${docSettings.crossReferenceEnabled ? 'checked' : ''}>
                            </label>
                        </div>
                        <div class="document-styler-option">
                            <label class="fn__flex b3-label">
                                <div class="fn__flex-1">
                                    默认启用
                                    <div class="b3-label__text">新建文档时默认启用编号</div>
                                </div>
                                <span class="fn__space"></span>
                                <input class="b3-switch fn__flex-center" id="default-enabled" type="checkbox" ${docSettings.defaultEnabled ? 'checked' : ''}>
                            </label>
                        </div>
                    </div>

                    <!-- 标题编号样式设置 -->
                    <div class="document-styler-section" id="heading-styles-section" style="${docSettings.headingNumberingEnabled ? '' : 'display: none;'}">
                        <h3 class="document-styler-section-title">标题编号样式</h3>
                        <div id="heading-styles-container">
                            ${this.generateHeadingStylesHTML(docSettings.headingNumberStyles)}
                        </div>
                    </div>

                    <!-- 编号格式设置 -->
                    <div class="document-styler-section" id="numbering-formats-section" style="${docSettings.headingNumberingEnabled ? '' : 'display: none;'}">
                        <h3 class="document-styler-section-title">编号格式</h3>
                        <div id="numbering-formats-container">
                            ${this.generateNumberingFormatsHTML(docSettings.numberingFormats)}
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
    private generateHeadingStylesHTML(headingNumberStyles: HeadingNumberStyle[]): string {
        const styleOptions = NumberStyleConverter.getStyleOptions();
        let html = '';

        for (let i = 0; i < 6; i++) {
            const level = i + 1;
            const currentStyle = headingNumberStyles[i];

            html += `
                <div class="document-styler-option">
                    <div class="document-styler-option-header">
                        <span class="document-styler-level-label">H${level} 样式</span>
                        <span class="document-styler-style-example">${NumberStyleConverter.getExample(currentStyle)}</span>
                    </div>
                    <select class="b3-select" id="heading-style-${i}">
                        ${styleOptions.map(option => 
                            `<option value="${option.value}" ${option.value === currentStyle ? 'selected' : ''}>
                                ${option.label} (${option.example})
                            </option>`
                        ).join('')}
                    </select>
                </div>
            `;
        }

        return html;
    }

    /**
     * 生成编号格式设置HTML
     */
    private generateNumberingFormatsHTML(numberingFormats: string[]): string {
        let html = '';

        for (let i = 0; i < 6; i++) {
            const level = i + 1;
            const format = numberingFormats[i];

            html += `
                <div class="document-styler-option">
                    <div class="document-styler-option-header">
                        <span class="document-styler-level-label">H${level} 格式</span>
                        <span class="document-styler-format-help">使用 {1}, {2} 等占位符</span>
                    </div>
                    <input type="text" class="b3-text-field" 
                            id="format-${i}" 
                            value="${format}" 
                            placeholder="例如: {1}. 或 第{1}章">
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

        const docId = this.documentManager.getCurrentDocId();
        if (!docId) return;

        // 标题编号开关
        const headingNumberingCheckbox = this.panelElement.querySelector('#heading-numbering') as HTMLInputElement;
        headingNumberingCheckbox?.addEventListener('change', async (e) => {
            const enabled = (e.target as HTMLInputElement).checked;
            await this.settingsManager.setDocumentSettings(docId, { headingNumberingEnabled: enabled });
            this.toggleHeadingStylesSection(enabled);
            this.toggleNumberingFormatsSection(enabled);
            await this.applyDocumentSettings(docId);
        });

        // 交叉引用开关
        const crossReferenceCheckbox = this.panelElement.querySelector('#cross-reference') as HTMLInputElement;
        crossReferenceCheckbox?.addEventListener('change', async (e) => {
            const enabled = (e.target as HTMLInputElement).checked;
            await this.settingsManager.setDocumentSettings(docId, { crossReferenceEnabled: enabled });
            this.toggleFiguresSection(enabled);
            await this.applyDocumentSettings(docId);
        });

        // 默认启用开关
        const defaultEnabledCheckbox = this.panelElement.querySelector('#default-enabled') as HTMLInputElement;
        defaultEnabledCheckbox?.addEventListener('change', async (e) => {
            const enabled = (e.target as HTMLInputElement).checked;
            await this.settingsManager.setDocumentSettings(docId, { defaultEnabled: enabled });
        });

        // 标题编号样式选择器
        for (let i = 0; i < 6; i++) {
            const styleSelect = this.panelElement.querySelector(`#heading-style-${i}`) as HTMLSelectElement;
            styleSelect?.addEventListener('change', async (e) => {
                const style = (e.target as HTMLSelectElement).value as HeadingNumberStyle;
                await this.settingsManager.setDocumentHeadingNumberStyle(docId, i, style);
                this.updateStyleExample(i, style);
                await this.applyDocumentSettings(docId);
            });
        }

        // 编号格式输入框
        for (let i = 0; i < 6; i++) {
            const formatInput = this.panelElement.querySelector(`#format-${i}`) as HTMLInputElement;
            formatInput?.addEventListener('change', async (e) => {
                const format = (e.target as HTMLInputElement).value;
                await this.settingsManager.setDocumentNumberingFormat(docId, i, format);
                await this.applyDocumentSettings(docId);
            });
        }
    }

    /**
     * 应用文档设置
     * @param docId 文档ID
     */
    private async applyDocumentSettings(docId: string): Promise<void> {
        try {
            const settings = await this.settingsManager.getDocumentSettings(docId);
            
            // 应用标题编号
            if (settings.headingNumberingEnabled) {
                await (window as any).documentStylerPlugin?.applyHeadingNumbering();
            } else {
                await (window as any).documentStylerPlugin?.clearHeadingNumbering();
            }
            
            // 应用交叉引用
            if (settings.crossReferenceEnabled) {
                await (window as any).documentStylerPlugin?.applyCrossReference();
            } else {
                await (window as any).documentStylerPlugin?.clearCrossReference();
            }
        } catch (error) {
            console.error('应用文档设置失败:', error);
        }
    }

    /**
     * 更新样式示例显示
     */
    private updateStyleExample(level: number, style: HeadingNumberStyle): void {
        const exampleElement = this.panelElement?.querySelector(`#heading-style-${level}`)?.parentElement?.querySelector('.document-styler-style-example');
        if (exampleElement) {
            exampleElement.textContent = NumberStyleConverter.getExample(style);
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

            // 更新文档功能开关状态
            const headingCheckbox = this.panelElement.querySelector('#heading-numbering') as HTMLInputElement;
            if (headingCheckbox) headingCheckbox.checked = docSettings.headingNumberingEnabled;

            const crossRefCheckbox = this.panelElement.querySelector('#cross-reference') as HTMLInputElement;
            if (crossRefCheckbox) crossRefCheckbox.checked = docSettings.crossReferenceEnabled;

            const defaultEnabledCheckbox = this.panelElement.querySelector('#default-enabled') as HTMLInputElement;
            if (defaultEnabledCheckbox) defaultEnabledCheckbox.checked = docSettings.defaultEnabled;

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
        const statusElement = this.panelElement?.querySelector('#current-doc-status');
        if (!statusElement) return;

        if (!docId) {
            statusElement.innerHTML = '<div class="b3-label">当前文档：未选择</div>';
            return;
        }

        try {
            const headingEnabled = await this.settingsManager.isDocumentHeadingNumberingEnabled(docId);
            const crossRefEnabled = await this.settingsManager.isDocumentCrossReferenceEnabled(docId);

            const statusHTML = `
                <div class="b3-label">当前文档状态</div>
                <div class="fn__flex fn__flex-wrap">
                    <label class="fn__flex fn__flex-center">
                        <input type="checkbox" id="doc-heading-enabled" ${headingEnabled ? 'checked' : ''}>
                        <span class="fn__space"></span>
                        <span>标题编号</span>
                    </label>
                    <div class="fn__space"></span>
                    <label class="fn__flex fn__flex-center">
                        <input type="checkbox" id="doc-crossref-enabled" ${crossRefEnabled ? 'checked' : ''}>
                        <span class="fn__space"></span>
                        <span>交叉引用</span>
                    </label>
                </div>
            `;

            statusElement.innerHTML = statusHTML;

            // 绑定事件
            this.bindDocumentStatusEvents(docId);
        } catch (error) {
            console.error('更新文档状态失败:', error);
            statusElement.innerHTML = '<div class="b3-label">状态获取失败</div>';
        }
    }

    /**
     * 绑定文档状态事件
     */
    private bindDocumentStatusEvents(docId: string): void {
        const headingCheckbox = this.panelElement?.querySelector('#doc-heading-enabled') as HTMLInputElement;
        const crossRefCheckbox = this.panelElement?.querySelector('#doc-crossref-enabled') as HTMLInputElement;

        if (headingCheckbox) {
            headingCheckbox.addEventListener('change', async (e) => {
                const enabled = (e.target as HTMLInputElement).checked;
                await this.settingsManager.setDocumentSettings(docId, { headingNumberingEnabled: enabled });
                await this.applyDocumentSettings(docId);
            });
        }

        if (crossRefCheckbox) {
            crossRefCheckbox.addEventListener('change', async (e) => {
                const enabled = (e.target as HTMLInputElement).checked;
                await this.settingsManager.setDocumentSettings(docId, { crossReferenceEnabled: enabled });
                await this.applyDocumentSettings(docId);
            });
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

    /**
     * 通知设置变更
     */
    private notifySettingsChanged(key: string, value: any): void {
        // 发送自定义事件，主插件类可以监听此事件
        const event = new CustomEvent('document-styler-settings-changed', {
            detail: { key, value }
        });
        document.dispatchEvent(event);
    }
}

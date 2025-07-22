/**
 * 侧边栏面板管理器
 * 负责管理插件的侧边栏面板UI
 */

import { Custom } from "../../../../layout/dock/Custom";
import { IDockPanel, IFigureInfo, HeadingNumberStyle, IFontSettings } from "../types";
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

                    <!-- 图表编号前缀设置 -->
                    <div class="document-styler-section" id="figure-prefix-section" style="${docSettings.crossReferenceEnabled ? '' : 'display: none;'}">
                        <h3 class="document-styler-section-title">图表编号前缀</h3>

                        <div class="fn__flex b3-label config__item">
                            <div class="fn__flex-1">
                                图片编号前缀
                                <div class="b3-label__text">自定义图片编号前缀，如"图"、"Figure"等</div>
                            </div>
                            <span class="fn__space"></span>
                            <input class="b3-text-field fn__flex-center fn__size200" id="figure-prefix-input" value="${docSettings.figurePrefix}" placeholder="图">
                        </div>

                        <div class="fn__flex b3-label config__item">
                            <div class="fn__flex-1">
                                表格编号前缀
                                <div class="b3-label__text">自定义表格编号前缀，如"表"、"Table"等</div>
                            </div>
                            <span class="fn__space"></span>
                            <input class="b3-text-field fn__flex-center fn__size200" id="table-prefix-input" value="${docSettings.tablePrefix}" placeholder="表">
                        </div>
                    </div>

                    <!-- 字体设置 -->
                    <div class="document-styler-section" id="font-settings-section">
                        <h3 class="document-styler-section-title">字体设置</h3>
                        ${this.generateFontSettingsHTML(docSettings.fontSettings)}
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
     * 生成字体设置HTML
     */
    private generateFontSettingsHTML(fontSettings: IFontSettings): string {
        return `
            <div class="document-styler-font-settings">
                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">
                        字体族
                        <div class="b3-label__text">设置文档的字体族，留空使用系统默认</div>
                    </div>
                    <span class="fn__space"></span>
                    <select class="b3-select fn__flex-center fn__size200" id="font-family-select">
                        <option value="">默认字体</option>
                        <!-- 字体选项将通过JavaScript动态加载 -->
                    </select>
                </div>

                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">
                        字体大小
                        <div class="b3-label__text">设置文档的字体大小</div>
                    </div>
                    <span class="fn__space"></span>
                    <input class="b3-text-field fn__flex-center fn__size200"
                           id="font-size-input"
                           value="${fontSettings.fontSize}"
                           placeholder="16px">
                </div>

                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">
                        行高
                        <div class="b3-label__text">设置文档的行高</div>
                    </div>
                    <span class="fn__space"></span>
                    <input class="b3-text-field fn__flex-center fn__size200"
                           id="line-height-input"
                           value="${fontSettings.lineHeight}"
                           placeholder="1.6">
                </div>

                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">
                        字体粗细
                        <div class="b3-label__text">设置文档的字体粗细</div>
                    </div>
                    <span class="fn__space"></span>
                    <select class="b3-select fn__flex-center fn__size200" id="font-weight-select">
                        <option value="normal" ${fontSettings.fontWeight === 'normal' ? 'selected' : ''}>正常</option>
                        <option value="bold" ${fontSettings.fontWeight === 'bold' ? 'selected' : ''}>粗体</option>
                        <option value="lighter" ${fontSettings.fontWeight === 'lighter' ? 'selected' : ''}>细体</option>
                        <option value="100" ${fontSettings.fontWeight === '100' ? 'selected' : ''}>100</option>
                        <option value="200" ${fontSettings.fontWeight === '200' ? 'selected' : ''}>200</option>
                        <option value="300" ${fontSettings.fontWeight === '300' ? 'selected' : ''}>300</option>
                        <option value="400" ${fontSettings.fontWeight === '400' ? 'selected' : ''}>400</option>
                        <option value="500" ${fontSettings.fontWeight === '500' ? 'selected' : ''}>500</option>
                        <option value="600" ${fontSettings.fontWeight === '600' ? 'selected' : ''}>600</option>
                        <option value="700" ${fontSettings.fontWeight === '700' ? 'selected' : ''}>700</option>
                        <option value="800" ${fontSettings.fontWeight === '800' ? 'selected' : ''}>800</option>
                        <option value="900" ${fontSettings.fontWeight === '900' ? 'selected' : ''}>900</option>
                    </select>
                </div>

                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">
                        字体样式
                        <div class="b3-label__text">设置文档的字体样式</div>
                    </div>
                    <span class="fn__space"></span>
                    <select class="b3-select fn__flex-center fn__size200" id="font-style-select">
                        <option value="normal" ${fontSettings.fontStyle === 'normal' ? 'selected' : ''}>正常</option>
                        <option value="italic" ${fontSettings.fontStyle === 'italic' ? 'selected' : ''}>斜体</option>
                        <option value="oblique" ${fontSettings.fontStyle === 'oblique' ? 'selected' : ''}>倾斜</option>
                    </select>
                </div>

                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">
                        字母间距
                        <div class="b3-label__text">设置文档的字母间距</div>
                    </div>
                    <span class="fn__space"></span>
                    <input class="b3-text-field fn__flex-center fn__size200"
                           id="letter-spacing-input"
                           value="${fontSettings.letterSpacing}"
                           placeholder="normal">
                </div>

                <div class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">
                        单词间距
                        <div class="b3-label__text">设置文档的单词间距</div>
                    </div>
                    <span class="fn__space"></span>
                    <input class="b3-text-field fn__flex-center fn__size200"
                           id="word-spacing-input"
                           value="${fontSettings.wordSpacing}"
                           placeholder="normal">
                </div>

                <div class="fn__flex" style="margin-top: 16px;">
                    <button class="b3-button b3-button--outline" id="reset-font-settings">
                        重置字体设置
                    </button>
                    <span class="fn__space"></span>
                    <button class="b3-button b3-button--text" id="apply-font-settings">
                        应用字体设置
                    </button>
                </div>
            </div>
        `;
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

        // 图表编号前缀输入框
        const figurePrefixInput = this.panelElement.querySelector('#figure-prefix-input') as HTMLInputElement;
        if (figurePrefixInput) {
            const handler = async (e: Event) => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;

                const prefix = (e.target as HTMLInputElement).value || '图';
                console.log(`DocumentStyler: 图片编号前缀改变: ${prefix}`);

                await this.settingsManager.setDocumentFigurePrefix(docId, prefix);

                // 如果交叉引用功能已启用，只更新CSS样式，不重新排序
                const docSettings = await this.settingsManager.getDocumentSettings(docId);
                if (docSettings.crossReferenceEnabled) {
                    await this.crossReference.updateFigurePrefixStyles(docId);
                }
            };
            figurePrefixInput.addEventListener('change', handler);
            (figurePrefixInput as any)._documentStylerHandler = handler;
        }

        const tablePrefixInput = this.panelElement.querySelector('#table-prefix-input') as HTMLInputElement;
        if (tablePrefixInput) {
            const handler = async (e: Event) => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;

                const prefix = (e.target as HTMLInputElement).value || '表';
                console.log(`DocumentStyler: 表格编号前缀改变: ${prefix}`);

                await this.settingsManager.setDocumentTablePrefix(docId, prefix);

                // 如果交叉引用功能已启用，只更新CSS样式，不重新排序
                const docSettings = await this.settingsManager.getDocumentSettings(docId);
                if (docSettings.crossReferenceEnabled) {
                    await this.crossReference.updateFigurePrefixStyles(docId);
                }
            };
            tablePrefixInput.addEventListener('change', handler);
            (tablePrefixInput as any)._documentStylerHandler = handler;
        }

        // 绑定字体设置事件
        this.bindFontSettingsEvents();
    }

    /**
     * 绑定字体设置事件
     */
    private bindFontSettingsEvents(): void {
        if (!this.panelElement) return;

        // 字体族选择器
        const fontFamilySelect = this.panelElement.querySelector('#font-family-select') as HTMLSelectElement;
        if (fontFamilySelect) {
            // 加载系统字体
            this.loadSystemFonts(fontFamilySelect);

            const handler = async (e: Event) => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;

                const fontFamily = (e.target as HTMLSelectElement).value;
                console.log(`DocumentStyler: 字体族改变: ${fontFamily}`);

                await this.settingsManager.setDocumentFontFamily(docId, fontFamily);
                await this.applyFontSettings(docId);
            };
            fontFamilySelect.addEventListener('change', handler);
            (fontFamilySelect as any)._documentStylerHandler = handler;
        }

        // 字体大小输入框
        const fontSizeInput = this.panelElement.querySelector('#font-size-input') as HTMLInputElement;
        if (fontSizeInput) {
            const handler = async (e: Event) => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;

                const fontSize = (e.target as HTMLInputElement).value;
                console.log(`DocumentStyler: 字体大小改变: ${fontSize}`);

                await this.settingsManager.setDocumentFontSize(docId, fontSize);
                await this.applyFontSettings(docId);
            };
            fontSizeInput.addEventListener('change', handler);
            (fontSizeInput as any)._documentStylerHandler = handler;
        }

        // 行高输入框
        const lineHeightInput = this.panelElement.querySelector('#line-height-input') as HTMLInputElement;
        if (lineHeightInput) {
            const handler = async (e: Event) => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;

                const lineHeight = (e.target as HTMLInputElement).value;
                console.log(`DocumentStyler: 行高改变: ${lineHeight}`);

                await this.settingsManager.setDocumentFontSettings(docId, { lineHeight });
                await this.applyFontSettings(docId);
            };
            lineHeightInput.addEventListener('change', handler);
            (lineHeightInput as any)._documentStylerHandler = handler;
        }

        // 字体粗细选择器
        const fontWeightSelect = this.panelElement.querySelector('#font-weight-select') as HTMLSelectElement;
        if (fontWeightSelect) {
            const handler = async (e: Event) => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;

                const fontWeight = (e.target as HTMLSelectElement).value;
                console.log(`DocumentStyler: 字体粗细改变: ${fontWeight}`);

                await this.settingsManager.setDocumentFontSettings(docId, { fontWeight });
                await this.applyFontSettings(docId);
            };
            fontWeightSelect.addEventListener('change', handler);
            (fontWeightSelect as any)._documentStylerHandler = handler;
        }

        // 字体样式选择器
        const fontStyleSelect = this.panelElement.querySelector('#font-style-select') as HTMLSelectElement;
        if (fontStyleSelect) {
            const handler = async (e: Event) => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;

                const fontStyle = (e.target as HTMLSelectElement).value;
                console.log(`DocumentStyler: 字体样式改变: ${fontStyle}`);

                await this.settingsManager.setDocumentFontSettings(docId, { fontStyle });
                await this.applyFontSettings(docId);
            };
            fontStyleSelect.addEventListener('change', handler);
            (fontStyleSelect as any)._documentStylerHandler = handler;
        }

        // 字母间距输入框
        const letterSpacingInput = this.panelElement.querySelector('#letter-spacing-input') as HTMLInputElement;
        if (letterSpacingInput) {
            const handler = async (e: Event) => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;

                const letterSpacing = (e.target as HTMLInputElement).value;
                console.log(`DocumentStyler: 字母间距改变: ${letterSpacing}`);

                await this.settingsManager.setDocumentFontSettings(docId, { letterSpacing });
                await this.applyFontSettings(docId);
            };
            letterSpacingInput.addEventListener('change', handler);
            (letterSpacingInput as any)._documentStylerHandler = handler;
        }

        // 单词间距输入框
        const wordSpacingInput = this.panelElement.querySelector('#word-spacing-input') as HTMLInputElement;
        if (wordSpacingInput) {
            const handler = async (e: Event) => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;

                const wordSpacing = (e.target as HTMLInputElement).value;
                console.log(`DocumentStyler: 单词间距改变: ${wordSpacing}`);

                await this.settingsManager.setDocumentFontSettings(docId, { wordSpacing });
                await this.applyFontSettings(docId);
            };
            wordSpacingInput.addEventListener('change', handler);
            (wordSpacingInput as any)._documentStylerHandler = handler;
        }

        // 重置字体设置按钮
        const resetButton = this.panelElement.querySelector('#reset-font-settings') as HTMLButtonElement;
        if (resetButton) {
            const handler = async () => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;

                console.log(`DocumentStyler: 重置字体设置`);

                const defaultFontSettings = this.settingsManager.getDefaultFontSettings();
                await this.settingsManager.setDocumentFontSettings(docId, defaultFontSettings);
                await this.updatePanel(); // 重新更新面板以显示默认值
                await this.applyFontSettings(docId);
            };
            resetButton.addEventListener('click', handler);
            (resetButton as any)._documentStylerHandler = handler;
        }

        // 应用字体设置按钮
        const applyButton = this.panelElement.querySelector('#apply-font-settings') as HTMLButtonElement;
        if (applyButton) {
            const handler = async () => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;

                console.log(`DocumentStyler: 手动应用字体设置`);
                await this.applyFontSettings(docId);
            };
            applyButton.addEventListener('click', handler);
            (applyButton as any)._documentStylerHandler = handler;
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

        // 清除字体设置事件
        this.clearFontSettingsEvents();

        // 清除文档状态事件
        this.clearDocumentStatusEvents();
    }

    /**
     * 清除字体设置事件
     */
    private clearFontSettingsEvents(): void {
        if (!this.panelElement) return;

        const fontElements = [
            '#font-family-select',
            '#font-size-input',
            '#line-height-input',
            '#font-weight-select',
            '#font-style-select',
            '#letter-spacing-input',
            '#word-spacing-input',
            '#reset-font-settings',
            '#apply-font-settings'
        ];

        fontElements.forEach(selector => {
            const element = this.panelElement.querySelector(selector) as HTMLElement;
            if (element && (element as any)._documentStylerHandler) {
                const eventType = element.tagName === 'BUTTON' ? 'click' : 'change';
                element.removeEventListener(eventType, (element as any)._documentStylerHandler);
                delete (element as any)._documentStylerHandler;
            }
        });
    }

    /**
     * 加载系统字体
     */
    private async loadSystemFonts(selectElement: HTMLSelectElement): void {
        try {
            // 调用思源的API获取系统字体
            const response = await fetch('/api/system/getSysFonts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({})
            });

            if (response.ok) {
                const data = await response.json();
                if (data.code === 0 && Array.isArray(data.data)) {
                    // 清空现有选项（保留默认选项）
                    const defaultOption = selectElement.querySelector('option[value=""]');
                    selectElement.innerHTML = '';
                    if (defaultOption) {
                        selectElement.appendChild(defaultOption);
                    }

                    // 添加系统字体选项
                    data.data.forEach((fontFamily: string) => {
                        const option = document.createElement('option');
                        option.value = fontFamily;
                        option.textContent = fontFamily;
                        option.style.fontFamily = fontFamily;
                        selectElement.appendChild(option);
                    });

                    // 设置当前选中的字体
                    const docId = this.documentManager.getCurrentDocId();
                    if (docId) {
                        const fontSettings = await this.settingsManager.getDocumentFontSettings(docId);
                        selectElement.value = fontSettings.fontFamily || '';
                    }
                }
            }
        } catch (error) {
            console.error('DocumentStyler: 加载系统字体失败:', error);
        }
    }

    /**
     * 应用字体设置
     */
    private async applyFontSettings(docId: string): Promise<void> {
        if (!docId) return;

        try {
            // 调用主插件的字体设置应用方法
            if (this.pluginInstance && typeof this.pluginInstance.applyFontSettings === 'function') {
                await this.pluginInstance.applyFontSettings();
                console.log(`DocumentStyler: 应用文档 ${docId} 的字体设置`);
            } else {
                console.warn('DocumentStyler: 主插件实例不可用，无法应用字体设置');
            }
        } catch (error) {
            console.error(`DocumentStyler: 应用字体设置失败:`, error);
        }
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
    private bindDocumentStatusEvents(_docId: string): void {
        // 先清除之前的事件监听器
        this.clearDocumentStatusEvents();

        const headingCheckbox = this.panelElement?.querySelector('#doc-heading-enabled') as HTMLInputElement;
        const crossRefCheckbox = this.panelElement?.querySelector('#doc-crossref-enabled') as HTMLInputElement;

        if (headingCheckbox) {
            const headingHandler = async (e: Event) => {
                // 实时获取当前文档ID，而不是使用闭包中的旧ID
                const currentDocId = this.documentManager.getCurrentDocId();
                if (!currentDocId) {
                    console.warn('DocumentStyler: 无法获取当前文档ID，跳过标题编号设置');
                    return;
                }

                const enabled = (e.target as HTMLInputElement).checked;
                console.log(`DocumentStyler: 标题编号开关改变 - 启用: ${enabled}, 文档ID: ${currentDocId}`);

                await this.settingsManager.setDocumentSettings(currentDocId, { headingNumberingEnabled: enabled });
                this.toggleHeadingStylesSection(enabled);
                this.toggleNumberingFormatsSection(enabled);

                // 只应用标题编号相关的设置，不影响交叉引用
                await this.applyHeadingNumberingSettings(currentDocId, enabled);
            };
            headingCheckbox.addEventListener('change', headingHandler);
            (headingCheckbox as any)._documentStylerHandler = headingHandler;
        }

        if (crossRefCheckbox) {
            const crossRefHandler = async (e: Event) => {
                // 实时获取当前文档ID，而不是使用闭包中的旧ID
                const currentDocId = this.documentManager.getCurrentDocId();
                if (!currentDocId) {
                    console.warn('DocumentStyler: 无法获取当前文档ID，跳过交叉引用设置');
                    return;
                }

                const enabled = (e.target as HTMLInputElement).checked;
                console.log(`DocumentStyler: 交叉引用开关改变 - 启用: ${enabled}, 文档ID: ${currentDocId}`);

                await this.settingsManager.setDocumentSettings(currentDocId, { crossReferenceEnabled: enabled });
                this.toggleFiguresSection(enabled);

                // 只应用交叉引用相关的设置，不影响标题编号
                await this.applyCrossReferenceSettings(currentDocId, enabled);
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
        const figuresSection = this.panelElement?.querySelector('#figures-section') as HTMLElement;
        if (figuresSection) {
            figuresSection.style.display = show ? '' : 'none';
        }

        const prefixSection = this.panelElement?.querySelector('#figure-prefix-section') as HTMLElement;
        if (prefixSection) {
            prefixSection.style.display = show ? '' : 'none';
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

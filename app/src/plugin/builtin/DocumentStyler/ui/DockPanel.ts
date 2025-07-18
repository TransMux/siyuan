/**
 * 侧边栏面板管理器
 * 负责管理插件的侧边栏面板UI
 */

import { Custom } from "../../../../layout/dock/Custom";
import { IDockPanel, IFigureInfo } from "../types";
import { SettingsManager } from "../core/SettingsManager";
import { DocumentManager } from "../core/DocumentManager";
import { CrossReference } from "../core/CrossReference";

export class DockPanel implements IDockPanel {
    private settingsManager: SettingsManager;
    private documentManager: DocumentManager;
    private crossReference: CrossReference;
    private customElement: Custom | null = null;
    private panelElement: HTMLElement | null = null;

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
    initPanel(custom: Custom): void {
        if (!custom || !custom.element) {
            console.error('DocumentStyler: Custom element not available');
            return;
        }

        try {
            this.customElement = custom;
            this.panelElement = custom.element;
            
            custom.element.innerHTML = this.generatePanelHTML();
            this.bindPanelEvents();
            this.updatePanel();
        } catch (error) {
            console.error('DocumentStyler: Error initializing dock panel:', error);
        }
    }

    updatePanel(): void {
        if (!this.panelElement) return;

        try {
            this.updateCurrentDocInfo();
            this.updateSettingsUI();
            this.updateFiguresList();
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
    private generatePanelHTML(): string {
        const settings = this.settingsManager.getSettings();
        
        return `
            <div class="document-styler-panel">
                <div class="block__icons">
                    <div class="block__logo">
                        <svg class="block__logoicon"><use xlink:href="#iconEdit"></use></svg>
                        文档样式设置
                    </div>
                </div>
                
                <div class="document-styler-content">
                    <!-- 标题样式设置 -->
                    <div class="document-styler-section">
                        <h3 class="document-styler-section-title">标题样式</h3>
                        <div class="document-styler-option">
                            <label class="fn__flex b3-label">
                                <div class="fn__flex-1">
                                    自动编号
                                </div>
                                <span class="fn__space"></span>
                                <input class="b3-switch fn__flex-center" id="heading-numbering" type="checkbox" ${settings.headingNumbering ? 'checked' : ''}>
                            </label>
                        </div>
                        <div class="document-styler-option">
                            <label class="fn__flex b3-label">
                                <div class="fn__flex-1">
                                    实时更新
                                    <div class="b3-label__text">编辑时自动更新标题编号</div>
                                </div>
                                <span class="fn__space"></span>
                                <input class="b3-switch fn__flex-center" id="real-time-update" type="checkbox" ${settings.realTimeUpdate ? 'checked' : ''}>
                            </label>
                        </div>
                    </div>

                    <!-- 图片/表格设置 -->
                    <div class="document-styler-section">
                        <h3 class="document-styler-section-title">图片/表格属性</h3>
                        <div class="document-styler-option">
                            <label class="fn__flex b3-label">
                                <div class="fn__flex-1">
                                    支持交叉引用
                                    <div class="b3-label__text">启用后将为图片和表格添加编号标签，支持@符号触发交叉引用选择</div>
                                </div>
                                <span class="fn__space"></span>
                                <input class="b3-switch fn__flex-center" id="cross-reference" type="checkbox" ${settings.crossReference ? 'checked' : ''}>
                            </label>
                        </div>
                    </div>

                    <!-- 编号格式设置 -->
                    <div class="document-styler-section" id="numbering-formats-section" style="${settings.headingNumbering ? '' : 'display: none;'}">
                        <h3 class="document-styler-section-title">编号格式</h3>
                        <div id="numbering-formats-container">
                            ${this.generateNumberingFormatsHTML()}
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
                    <div class="document-styler-section" id="figures-section" style="${settings.crossReference ? '' : 'display: none;'}">
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
     * 生成编号格式设置HTML
     */
    private generateNumberingFormatsHTML(): string {
        const settings = this.settingsManager.getSettings();
        let html = '';

        for (let i = 0; i < 6; i++) {
            const level = i + 1;
            const format = settings.numberingFormats[i];
            const useChinese = settings.useChineseNumbers[i];

            html += `
                <div class="document-styler-option">
                    <label class="b3-label">
                        <div class="fn__flex-1">
                            H${level} 格式
                        </div>
                        <div class="document-styler-format-input">
                            <input type="text" class="b3-text-field" 
                                   id="format-${i}" 
                                   value="${format}" 
                                   placeholder="例如: {1}. 或 第{1}章">
                            <label class="document-styler-chinese-option">
                                <input type="checkbox" class="b3-switch" 
                                       id="chinese-${i}" 
                                       ${useChinese ? 'checked' : ''}>
                                <span>中文数字</span>
                            </label>
                        </div>
                    </label>
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

        // 标题编号开关
        const headingNumberingCheckbox = this.panelElement.querySelector('#heading-numbering') as HTMLInputElement;
        headingNumberingCheckbox?.addEventListener('change', async (e) => {
            const enabled = (e.target as HTMLInputElement).checked;
            await this.settingsManager.updateSettings({ headingNumbering: enabled });
            this.toggleNumberingFormatsSection(enabled);
            this.notifySettingsChanged('headingNumbering', enabled);
        });

        // 实时更新开关
        const realTimeUpdateCheckbox = this.panelElement.querySelector('#real-time-update') as HTMLInputElement;
        realTimeUpdateCheckbox?.addEventListener('change', async (e) => {
            const enabled = (e.target as HTMLInputElement).checked;
            await this.settingsManager.updateSettings({ realTimeUpdate: enabled });
            this.notifySettingsChanged('realTimeUpdate', enabled);
        });

        // 交叉引用开关
        const crossReferenceCheckbox = this.panelElement.querySelector('#cross-reference') as HTMLInputElement;
        crossReferenceCheckbox?.addEventListener('change', async (e) => {
            const enabled = (e.target as HTMLInputElement).checked;
            await this.settingsManager.updateSettings({ crossReference: enabled });
            this.toggleFiguresSection(enabled);
            this.notifySettingsChanged('crossReference', enabled);
        });

        // 编号格式输入框
        for (let i = 0; i < 6; i++) {
            const formatInput = this.panelElement.querySelector(`#format-${i}`) as HTMLInputElement;
            formatInput?.addEventListener('change', async (e) => {
                const format = (e.target as HTMLInputElement).value;
                await this.settingsManager.setNumberingFormat(i, format);
                this.notifySettingsChanged('numberingFormats', null);
            });

            const chineseCheckbox = this.panelElement.querySelector(`#chinese-${i}`) as HTMLInputElement;
            chineseCheckbox?.addEventListener('change', async (e) => {
                const useChinese = (e.target as HTMLInputElement).checked;
                await this.settingsManager.setUseChineseNumbers(i, useChinese);
                this.notifySettingsChanged('useChineseNumbers', null);
            });
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
    private updateSettingsUI(): void {
        if (!this.panelElement) return;

        const settings = this.settingsManager.getSettings();

        // 更新开关状态
        const headingCheckbox = this.panelElement.querySelector('#heading-numbering') as HTMLInputElement;
        if (headingCheckbox) headingCheckbox.checked = settings.headingNumbering;

        const realTimeCheckbox = this.panelElement.querySelector('#real-time-update') as HTMLInputElement;
        if (realTimeCheckbox) realTimeCheckbox.checked = settings.realTimeUpdate;

        const crossRefCheckbox = this.panelElement.querySelector('#cross-reference') as HTMLInputElement;
        if (crossRefCheckbox) crossRefCheckbox.checked = settings.crossReference;

        // 更新编号格式
        for (let i = 0; i < 6; i++) {
            const formatInput = this.panelElement.querySelector(`#format-${i}`) as HTMLInputElement;
            if (formatInput) formatInput.value = settings.numberingFormats[i];

            const chineseCheckbox = this.panelElement.querySelector(`#chinese-${i}`) as HTMLInputElement;
            if (chineseCheckbox) chineseCheckbox.checked = settings.useChineseNumbers[i];
        }

        // 更新节的显示状态
        this.toggleNumberingFormatsSection(settings.headingNumbering);
        this.toggleFiguresSection(settings.crossReference);
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
                html += `
                    <div class="document-styler-figure-item" data-id="${figure.id}" onclick="window.documentStylerPlugin?.scrollToFigure('${figure.id}')">
                        <span class="figure-label">Figure ${figure.number}</span>
                        <span class="figure-content">${this.truncateText(figure.content, 50)}</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        if (tables.length > 0) {
            html += '<div class="document-styler-subsection"><h4>表格</h4>';
            tables.forEach((table) => {
                html += `
                    <div class="document-styler-figure-item" data-id="${table.id}" onclick="window.documentStylerPlugin?.scrollToFigure('${table.id}')">
                        <span class="table-label">Table ${table.number}</span>
                        <span class="figure-content">${this.truncateText(table.content, 50)}</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        return html;
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

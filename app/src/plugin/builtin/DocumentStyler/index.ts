import { Plugin } from "../../index";
import { App } from "../../../index";
import { fetchPost } from "../../../util/fetch";
import { showMessage } from "../../../dialog/message";
import { Custom } from "../../../layout/dock/Custom";

/**
 * Built-in plugin: Document Styler
 * Provides a sidebar panel for setting document element styles including:
 * - Heading auto-numbering
 * - Image/table cross-references with captions and labels
 * - Cross-reference selection with @ trigger
 */
export class DocumentStylerPlugin extends Plugin {
    private appRef: App;
    private currentDocId: string = "";
    private settings = {
        headingNumbering: false,
        crossReference: false
    };

    constructor(options: { app: App; name: string; displayName: string; i18n: any }) {
        super(options);
        this.appRef = options.app;

        // 将插件实例暴露到全局，供HTML onclick使用
        (window as any).documentStylerPlugin = this;

        // Load CSS styles
        this.loadStyles();

        // Register dock panel
        this.addDock({
            config: {
                position: "RightTop",
                size: { width: 300, height: 400 },
                icon: "iconEdit",
                title: "文档样式设置",
                show: false,
                index: 100
            },
            data: {},
            type: "document-styler-dock",
            init: (custom: Custom) => this.initDockPanel(custom),
            update: () => this.updateDockPanel(),
            destroy: () => this.destroyDockPanel()
        });

        // Listen for document changes
        this.eventBus.on("switch-protyle", this.onDocumentSwitch.bind(this));
        this.eventBus.on("loaded-protyle-static", this.onDocumentLoaded.bind(this));
    }

    private loadStyles() {
        const styleId = 'document-styler-plugin-styles';
        if (document.getElementById(styleId)) return;

        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = `
            .document-styler-panel {
                height: 100%;
                display: flex;
                flex-direction: column;
                font-size: 14px;
            }

            .document-styler-content {
                flex: 1;
                padding: 16px;
                overflow-y: auto;
            }

            .document-styler-section {
                margin-bottom: 24px;
                border-bottom: 1px solid var(--b3-theme-surface-lighter);
                padding-bottom: 16px;
            }

            .document-styler-section:last-child {
                border-bottom: none;
                margin-bottom: 0;
            }

            .document-styler-section-title {
                font-size: 16px;
                font-weight: 600;
                margin: 0 0 12px 0;
                color: var(--b3-theme-on-surface);
                display: flex;
                align-items: center;
            }

            .document-styler-section-title::before {
                content: "";
                width: 3px;
                height: 16px;
                background-color: var(--b3-theme-primary);
                margin-right: 8px;
                border-radius: 2px;
            }

            .document-styler-option {
                margin-bottom: 12px;
            }

            .document-styler-option .b3-switch {
                align-items: center;
            }

            .document-styler-description {
                font-size: 12px;
                color: var(--b3-theme-on-surface-light);
                margin-top: 8px;
                line-height: 1.4;
                padding-left: 16px;
                border-left: 2px solid var(--b3-theme-surface-light);
            }

            .document-styler-info {
                padding: 8px 12px;
                background-color: var(--b3-theme-surface);
                border-radius: var(--b3-border-radius);
                font-size: 13px;
                color: var(--b3-theme-on-surface-light);
                border: 1px solid var(--b3-theme-surface-lighter);
            }

            .document-styler-figures-list {
                max-height: 300px;
                overflow-y: auto;
                border: 1px solid var(--b3-theme-surface-lighter);
                border-radius: var(--b3-border-radius);
            }

            .document-styler-figure-item {
                padding: 8px 12px;
                border-bottom: 1px solid var(--b3-theme-surface-lighter);
                display: flex;
                align-items: center;
                cursor: pointer;
                transition: background-color 0.2s ease;
            }

            .document-styler-figure-item:last-child {
                border-bottom: none;
            }

            .document-styler-figure-item:hover {
                background-color: var(--b3-theme-surface);
            }

            .document-styler-figure-item .figure-label,
            .document-styler-figure-item .table-label {
                font-weight: 600;
                color: var(--b3-theme-primary);
                margin-right: 8px;
                min-width: 80px;
                font-size: 12px;
            }

            .document-styler-figure-item .figure-content {
                flex: 1;
                font-size: 12px;
                color: var(--b3-theme-on-surface-light);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .b3-list--empty {
                text-align: center;
                padding: 32px 16px;
                color: var(--b3-theme-on-surface-light);
                font-size: 13px;
            }

            .document-styler-subsection {
                margin-bottom: 16px;
            }

            .document-styler-subsection h4 {
                margin: 0 0 8px 0;
                font-size: 14px;
                font-weight: 600;
                color: var(--b3-theme-on-surface);
                padding: 4px 8px;
                background-color: var(--b3-theme-surface-light);
                border-radius: 4px;
            }
        `;
        document.head.appendChild(styleElement);
    }

    private initDockPanel(custom: Custom) {
        if (!custom || !custom.element) {
            console.error('DocumentStyler: Custom element not available');
            return;
        }

        try {
            custom.element.innerHTML = this.generateDockHTML();
            this.bindDockEvents(custom.element);
            this.loadSettings();
        } catch (error) {
            console.error('DocumentStyler: Error initializing dock panel:', error);
        }
    }

    private generateDockHTML(): string {
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
                                <input class="b3-switch fn__flex-center" id="heading-numbering" type="checkbox" ${this.settings.headingNumbering ? 'checked' : ''}>
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
                                <input class="b3-switch fn__flex-center" id="cross-reference" type="checkbox" ${this.settings.crossReference ? 'checked' : ''}>
                            </label>
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
                    <div class="document-styler-section" id="figures-section" style="display: none;">
                        <h3 class="document-styler-section-title">图片和表格</h3>
                        <div class="document-styler-figures-list" id="figures-list">
                            <!-- 动态生成的图片表格列表 -->
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    private bindDockEvents(element: Element) {
        // 标题编号开关
        const headingNumberingCheckbox = element.querySelector('#heading-numbering') as HTMLInputElement;
        headingNumberingCheckbox?.addEventListener('change', (e) => {
            this.settings.headingNumbering = (e.target as HTMLInputElement).checked;
            this.applyHeadingNumbering();
            this.saveSettings();
        });

        // 交叉引用开关
        const crossReferenceCheckbox = element.querySelector('#cross-reference') as HTMLInputElement;
        crossReferenceCheckbox?.addEventListener('change', (e) => {
            this.settings.crossReference = (e.target as HTMLInputElement).checked;
            this.applyCrossReference();
            this.saveSettings();
        });
    }

    private updateDockPanel() {
        // 更新当前文档信息
        this.updateCurrentDocInfo();
        // 更新图片表格列表
        if (this.settings.crossReference) {
            this.updateFiguresList();
        }
    }

    private destroyDockPanel() {
        // 清理资源
        this.removeHeadingNumbering();
        this.removeCrossReference();
    }

    private onDocumentSwitch(event: CustomEvent) {
        const protyle = event.detail?.protyle;
        if (protyle?.block?.rootID) {
            // 先清除当前文档的样式
            this.removeHeadingNumbering();
            this.removeCrossReference();

            this.currentDocId = protyle.block.rootID;

            // 加载新文档的设置
            this.loadSettings();
            this.updateDockPanel();
        }
    }

    private onDocumentLoaded(event: CustomEvent) {
        const protyle = event.detail?.protyle;
        if (protyle?.block?.rootID) {
            // 先清除当前文档的样式
            this.removeHeadingNumbering();
            this.removeCrossReference();

            this.currentDocId = protyle.block.rootID;

            // 加载新文档的设置
            this.loadSettings();
            this.updateDockPanel();
        }
    }

    private updateCurrentDocInfo() {
        const infoElement = document.querySelector('#current-doc-info');
        if (infoElement && this.currentDocId) {
            // 获取当前文档标题
            const protyle = this.getCurrentProtyle();
            if (protyle?.title?.editElement) {
                const title = protyle.title.editElement.textContent || "未命名文档";
                infoElement.textContent = title;
            } else {
                infoElement.textContent = `文档ID: ${this.currentDocId.substring(0, 8)}...`;
            }
        }
    }

    private getCurrentProtyle() {
        // 获取当前活跃的编辑器
        const app = this.appRef as any;
        const editors = app.layout?.layout?.models?.editor;
        if (editors && Array.isArray(editors)) {
            for (const editor of editors) {
                if (editor?.protyle?.block?.rootID === this.currentDocId) {
                    return editor.protyle;
                }
            }
        }
        return null;
    }

    private applyHeadingNumbering() {
        if (this.settings.headingNumbering) {
            this.addHeadingNumberingCSS();
        } else {
            this.removeHeadingNumbering();
        }
    }

    private addHeadingNumberingCSS() {
        const styleId = 'document-styler-heading-numbering';
        let styleElement = document.getElementById(styleId) as HTMLStyleElement;

        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = styleId;
            document.head.appendChild(styleElement);
        }

        // 首先检测文档中的最高标题级别
        const minHeadingLevel = this.getMinHeadingLevel();

        styleElement.textContent = this.generateHeadingNumberingCSS(minHeadingLevel);
    }

    private getMinHeadingLevel(): number {
        const protyle = this.getCurrentProtyle();
        if (!protyle) return 1;

        const headings = protyle.wysiwyg.element.querySelectorAll('[data-subtype^="h"]');
        let minLevel = 6;

        headings.forEach((heading: any) => {
            const subtype = heading.getAttribute('data-subtype');
            if (subtype) {
                const level = parseInt(subtype.substring(1));
                if (level < minLevel) {
                    minLevel = level;
                }
            }
        });

        return minLevel === 6 ? 1 : minLevel; // 如果没有标题，默认从1开始
    }

    private generateHeadingNumberingCSS(minLevel: number): string {
        const levels = [1, 2, 3, 4, 5, 6];
        const adjustedLevels = levels.map(level => level - minLevel + 1).filter(level => level >= 1);

        let css = `
            .protyle-wysiwyg {
                counter-reset: ${levels.map(l => `h${l}`).join(' ')};
            }
        `;

        levels.forEach((level) => {
            const adjustedLevel = level - minLevel + 1;
            if (adjustedLevel >= 1) {
                const resetCounters = levels.slice(level).map(l => `h${l}`).join(' ');
                const counterContent = adjustedLevels.slice(0, adjustedLevel).map(l => `counter(h${l + minLevel - 1})`).join(' "." ');

                css += `
                    .protyle-wysiwyg [data-subtype="h${level}"] > div:first-child:before {
                        counter-increment: h${level};
                        ${resetCounters ? `counter-reset: ${resetCounters};` : ''}
                        content: "${counterContent}. ";
                        color: var(--b3-theme-on-surface-light);
                        margin-right: 8px;
                        user-select: none;
                        display: inline;
                    }
                `;
            }
        });

        return css;
    }

    private removeHeadingNumbering() {
        const styleElement = document.getElementById('document-styler-heading-numbering');
        if (styleElement) {
            styleElement.remove();
        }
    }

    private applyCrossReference() {
        if (this.settings.crossReference) {
            this.addCrossReferenceSupport();
            this.updateFiguresList();
            document.querySelector('#figures-section')?.setAttribute('style', '');
        } else {
            this.removeCrossReference();
            document.querySelector('#figures-section')?.setAttribute('style', 'display: none;');
        }
    }

    private addCrossReferenceSupport() {
        // 为图片和表格添加标签支持
        this.addFigureCaptionCSS();
        this.processCurrentDocumentFigures();
    }

    private addFigureCaptionCSS() {
        const styleId = 'document-styler-figure-captions';
        let styleElement = document.getElementById(styleId) as HTMLStyleElement;

        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = styleId;
            document.head.appendChild(styleElement);
        }

        styleElement.textContent = `
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
    }

    private processCurrentDocumentFigures() {
        const protyle = this.getCurrentProtyle();
        if (!protyle) return;

        // 处理图片
        const images = protyle.wysiwyg.element.querySelectorAll('[data-type="img"]:not(.figure-processed)');
        images.forEach((img: any, index: number) => {
            this.addFigureCaption(img as HTMLElement, 'figure', index + 1);
        });

        // 处理表格
        const tables = protyle.wysiwyg.element.querySelectorAll('[data-type="table"]:not(.table-processed)');
        tables.forEach((table: any, index: number) => {
            this.addTableCaption(table as HTMLElement, 'table', index + 1);
        });
    }

    private addFigureCaption(element: HTMLElement, type: 'figure' | 'table', number: number) {
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

    private addTableCaption(element: HTMLElement, type: 'table', number: number) {
        this.addFigureCaption(element, type, number);
    }

    private removeCrossReference() {
        const styleElement = document.getElementById('document-styler-figure-captions');
        if (styleElement) {
            styleElement.remove();
        }

        // 移除已添加的标题
        const protyle = this.getCurrentProtyle();
        if (protyle) {
            protyle.wysiwyg.element.querySelectorAll('.figure-caption, .table-caption').forEach((caption: any) => {
                caption.remove();
            });
            protyle.wysiwyg.element.querySelectorAll('.figure-processed, .table-processed').forEach((element: any) => {
                element.classList.remove('figure-processed', 'table-processed');
                element.removeAttribute('data-figure-id');
                element.removeAttribute('data-table-id');
            });
        }
    }

    private updateFiguresList() {
        if (!this.settings.crossReference) return;

        const listElement = document.querySelector('#figures-list');
        if (!listElement) return;

        // 通过SQL查询当前文档的图片和表格
        this.queryDocumentFigures().then(figures => {
            listElement.innerHTML = this.generateFiguresListHTML(figures);
        });
    }

    private async queryDocumentFigures(): Promise<any[]> {
        if (!this.currentDocId) return [];

        return new Promise((resolve) => {
            const results: any[] = [];
            let completedQueries = 0;

            // 查询表格块 (type = 't')
            fetchPost("/api/query/sql", {
                stmt: `SELECT id, type, subtype, content FROM blocks WHERE root_id = '${this.currentDocId}' AND type = 't' ORDER BY sort`
            }, (response) => {
                if (response.code === 0 && response.data) {
                    const tables = response.data.map((item: any) => ({
                        ...item,
                        figureType: 'table'
                    }));
                    results.push(...tables);
                }
                completedQueries++;
                if (completedQueries === 2) {
                    resolve(results);
                }
            });

            // 查询包含图片的段落块 (通过content包含img标签来识别)
            fetchPost("/api/query/sql", {
                stmt: `SELECT id, type, subtype, content FROM blocks WHERE root_id = '${this.currentDocId}' AND type = 'p' AND markdown LIKE '![%' ORDER BY sort`
            }, (response) => {
                if (response.code === 0 && response.data) {
                    const images = response.data.map((item: any) => ({
                        ...item,
                        figureType: 'image'
                    }));
                    results.push(...images);
                }
                completedQueries++;
                if (completedQueries === 2) {
                    resolve(results);
                }
            });
        });
    }

    private generateFiguresListHTML(figures: any[]): string {
        if (figures.length === 0) {
            return '<div class="b3-list--empty">当前文档中没有图片或表格</div>';
        }

        // 分离图片和表格
        const images = figures.filter(f => f.figureType === 'image');
        const tables = figures.filter(f => f.figureType === 'table');

        let html = '';

        // 图片列表
        if (images.length > 0) {
            html += '<div class="document-styler-subsection"><h4>图片</h4>';
            images.forEach((figure, index) => {
                html += `
                    <div class="document-styler-figure-item" data-id="${figure.id}" onclick="window.documentStylerPlugin?.scrollToFigure('${figure.id}')">
                        <span class="figure-label">Figure ${index + 1}</span>
                        <span class="figure-content">${this.truncateText(this.extractImageAlt(figure.content), 50)}</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        // 表格列表
        if (tables.length > 0) {
            html += '<div class="document-styler-subsection"><h4>表格</h4>';
            tables.forEach((table, index) => {
                html += `
                    <div class="document-styler-figure-item" data-id="${table.id}" onclick="window.documentStylerPlugin?.scrollToFigure('${table.id}')">
                        <span class="table-label">Table ${index + 1}</span>
                        <span class="figure-content">${this.truncateText(this.extractTableSummary(table.content), 50)}</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        return html;
    }

    private extractImageAlt(content: string): string {
        // 从markdown内容中提取图片的alt文本
        const match = content.match(/!\[([^\]]*)\]/);
        return match ? match[1] || '图片' : '图片';
    }

    private extractTableSummary(content: string): string {
        // 从表格内容中提取简要信息
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length > 0) {
            // 取第一行作为表格描述
            const firstLine = lines[0].replace(/\|/g, ' ').trim();
            return firstLine || '表格';
        }
        return '表格';
    }

    private truncateText(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    private saveSettings() {
        if (!this.currentDocId) return;

        try {
            // 保存到文档属性中
            fetchPost("/api/attr/setBlockAttrs", {
                id: this.currentDocId,
                attrs: {
                    "custom-document-styler-heading-numbering": this.settings.headingNumbering.toString(),
                    "custom-document-styler-cross-reference": this.settings.crossReference.toString()
                }
            }, (response) => {
                if (response.code !== 0) {
                    console.error('Failed to save document settings:', response.msg);
                }
            });
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    private loadSettings() {
        if (!this.currentDocId) return;

        try {
            // 从文档属性中加载
            fetchPost("/api/attr/getBlockAttrs", {
                id: this.currentDocId
            }, (response) => {
                if (response.code === 0 && response.data) {
                    const attrs = response.data;

                    // 读取文档级别的设置
                    if (attrs["custom-document-styler-heading-numbering"]) {
                        this.settings.headingNumbering = attrs["custom-document-styler-heading-numbering"] === "true";
                    } else {
                        this.settings.headingNumbering = false;
                    }

                    if (attrs["custom-document-styler-cross-reference"]) {
                        this.settings.crossReference = attrs["custom-document-styler-cross-reference"] === "true";
                    } else {
                        this.settings.crossReference = false;
                    }

                    // 更新UI
                    this.updateSettingsUI();

                    // 应用设置
                    if (this.settings.headingNumbering) {
                        this.applyHeadingNumbering();
                    }
                    if (this.settings.crossReference) {
                        this.applyCrossReference();
                    }
                }
            });
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    private updateSettingsUI() {
        const headingCheckbox = document.querySelector('#heading-numbering') as HTMLInputElement;
        const crossRefCheckbox = document.querySelector('#cross-reference') as HTMLInputElement;

        if (headingCheckbox) {
            headingCheckbox.checked = this.settings.headingNumbering;
        }
        if (crossRefCheckbox) {
            crossRefCheckbox.checked = this.settings.crossReference;
        }
    }



    public scrollToFigure(figureId: string) {
        const protyle = this.getCurrentProtyle();
        if (!protyle) {
            console.warn('No active protyle found');
            return;
        }

        // 在当前编辑器中查找对应的块
        const element = protyle.wysiwyg.element.querySelector(`[data-node-id="${figureId}"]`);
        if (element) {
            // 滚动到元素位置
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // 高亮显示
            element.classList.add('protyle-wysiwyg--select');
            setTimeout(() => {
                element.classList.remove('protyle-wysiwyg--select');
            }, 2000);

            // 如果是表格，额外添加边框高亮
            if (element.getAttribute('data-type') === 't') {
                const table = element.querySelector('table');
                if (table) {
                    table.style.outline = '2px solid var(--b3-theme-primary)';
                    setTimeout(() => {
                        table.style.outline = '';
                    }, 2000);
                }
            }
        } else {
            console.warn(`Element with id ${figureId} not found`);
        }
    }
}

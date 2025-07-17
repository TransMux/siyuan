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
            init: () => {
                const custom = arguments[0] as Custom;
                this.initDockPanel(custom);
            },
            update: () => this.updateDockPanel(),
            destroy: () => this.destroyDockPanel()
        });

        // Listen for document changes
        this.eventBus.on("switch-protyle", this.onDocumentSwitch.bind(this));
        this.eventBus.on("loaded-protyle-static", this.onDocumentLoaded.bind(this));

        // Register cross-reference hint
        this.registerCrossReferenceHint();
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
                            <label class="b3-switch fn__flex">
                                <input type="checkbox" id="heading-numbering" ${this.settings.headingNumbering ? 'checked' : ''}>
                                <span class="b3-switch__slider"></span>
                                <span class="fn__space"></span>
                                <span>自动编号</span>
                            </label>
                        </div>
                    </div>

                    <!-- 图片/表格设置 -->
                    <div class="document-styler-section">
                        <h3 class="document-styler-section-title">图片/表格属性</h3>
                        <div class="document-styler-option">
                            <label class="b3-switch fn__flex">
                                <input type="checkbox" id="cross-reference" ${this.settings.crossReference ? 'checked' : ''}>
                                <span class="b3-switch__slider"></span>
                                <span class="fn__space"></span>
                                <span>支持交叉引用</span>
                            </label>
                        </div>
                        <div class="document-styler-description">
                            启用后将为图片和表格添加编号标签，支持@符号触发交叉引用选择
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
            this.currentDocId = protyle.block.rootID;
            this.updateDockPanel();
        }
    }

    private onDocumentLoaded(event: CustomEvent) {
        const protyle = event.detail?.protyle;
        if (protyle?.block?.rootID) {
            this.currentDocId = protyle.block.rootID;
            this.updateDockPanel();
            // 应用当前设置
            if (this.settings.headingNumbering) {
                this.applyHeadingNumbering();
            }
            if (this.settings.crossReference) {
                this.applyCrossReference();
            }
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

        styleElement.textContent = `
            .protyle-wysiwyg {
                counter-reset: h1 h2 h3 h4 h5 h6;
            }
            
            .protyle-wysiwyg [data-subtype="h1"]:before {
                counter-increment: h1;
                counter-reset: h2 h3 h4 h5 h6;
                content: counter(h1) ". ";
                color: var(--b3-theme-on-surface-light);
                margin-right: 8px;
            }
            
            .protyle-wysiwyg [data-subtype="h2"]:before {
                counter-increment: h2;
                counter-reset: h3 h4 h5 h6;
                content: counter(h1) "." counter(h2) ". ";
                color: var(--b3-theme-on-surface-light);
                margin-right: 8px;
            }
            
            .protyle-wysiwyg [data-subtype="h3"]:before {
                counter-increment: h3;
                counter-reset: h4 h5 h6;
                content: counter(h1) "." counter(h2) "." counter(h3) ". ";
                color: var(--b3-theme-on-surface-light);
                margin-right: 8px;
            }
            
            .protyle-wysiwyg [data-subtype="h4"]:before {
                counter-increment: h4;
                counter-reset: h5 h6;
                content: counter(h1) "." counter(h2) "." counter(h3) "." counter(h4) ". ";
                color: var(--b3-theme-on-surface-light);
                margin-right: 8px;
            }
            
            .protyle-wysiwyg [data-subtype="h5"]:before {
                counter-increment: h5;
                counter-reset: h6;
                content: counter(h1) "." counter(h2) "." counter(h3) "." counter(h4) "." counter(h5) ". ";
                color: var(--b3-theme-on-surface-light);
                margin-right: 8px;
            }
            
            .protyle-wysiwyg [data-subtype="h6"]:before {
                counter-increment: h6;
                content: counter(h1) "." counter(h2) "." counter(h3) "." counter(h4) "." counter(h5) "." counter(h6) ". ";
                color: var(--b3-theme-on-surface-light);
                margin-right: 8px;
            }
        `;
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

        let html = '';
        let figureCount = 0;
        let tableCount = 0;

        figures.forEach(figure => {
            if (figure.figureType === 'image') {
                figureCount++;
                html += `
                    <div class="document-styler-figure-item" data-id="${figure.id}">
                        <span class="figure-label">Figure ${figureCount}</span>
                        <span class="figure-content">${this.truncateText(figure.content, 50)}</span>
                    </div>
                `;
            } else if (figure.figureType === 'table') {
                tableCount++;
                html += `
                    <div class="document-styler-figure-item" data-id="${figure.id}">
                        <span class="table-label">Table ${tableCount}</span>
                        <span class="figure-content">${this.truncateText(figure.content, 50)}</span>
                    </div>
                `;
            }
        });

        return html;
    }

    private truncateText(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    private saveSettings() {
        localStorage.setItem('document-styler-settings', JSON.stringify(this.settings));
    }

    private loadSettings() {
        try {
            const saved = localStorage.getItem('document-styler-settings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    private registerCrossReferenceHint() {
        // 注册@符号触发的交叉引用提示
        this.protyleSlash.push({
            filter: ["@"],
            html: `<div class="b3-list-item__first"><span class="b3-list-item__text">交叉引用</span><span class="b3-list-item__meta">@</span></div>`,
            id: "cross-reference",
            callback: (protyle, nodeElement) => {
                this.showCrossReferenceHint(protyle, nodeElement);
            }
        });
    }

    private async showCrossReferenceHint(protyle: any, nodeElement: HTMLElement) {
        if (!this.settings.crossReference) {
            showMessage("请先启用交叉引用功能", 3000, "info");
            return;
        }

        const figures = await this.queryDocumentFigures();
        if (figures.length === 0) {
            showMessage("当前文档中没有图片或表格", 3000, "info");
            return;
        }

        // 创建提示菜单
        const hintData = this.generateCrossReferenceHints(figures);
        this.showHintMenu(protyle, nodeElement, hintData);
    }

    private generateCrossReferenceHints(figures: any[]): any[] {
        const hints: any[] = [];
        let figureCount = 0;
        let tableCount = 0;

        figures.forEach(figure => {
            if (figure.figureType === 'image') {
                figureCount++;
                hints.push({
                    value: `Figure ${figureCount}`,
                    html: `<div class="b3-list-item__first">
                        <span class="b3-list-item__text">Figure ${figureCount}</span>
                        <span class="b3-list-item__meta">${this.truncateText(figure.content, 30)}</span>
                    </div>`,
                    id: figure.id,
                    type: 'figure'
                });
            } else if (figure.figureType === 'table') {
                tableCount++;
                hints.push({
                    value: `Table ${tableCount}`,
                    html: `<div class="b3-list-item__first">
                        <span class="b3-list-item__text">Table ${tableCount}</span>
                        <span class="b3-list-item__meta">${this.truncateText(figure.content, 30)}</span>
                    </div>`,
                    id: figure.id,
                    type: 'table'
                });
            }
        });

        return hints;
    }

    private showHintMenu(protyle: any, _nodeElement: HTMLElement, hints: any[]) {
        // 这里需要集成到SiYuan的hint系统中
        // 由于hint系统比较复杂，我们先实现一个简单的菜单
        const menu = document.createElement('div');
        menu.className = 'document-styler-hint-menu';
        menu.style.cssText = `
            position: absolute;
            background: var(--b3-theme-surface);
            border: 1px solid var(--b3-theme-surface-lighter);
            border-radius: var(--b3-border-radius);
            box-shadow: var(--b3-point-shadow);
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            min-width: 200px;
        `;

        hints.forEach(hint => {
            const item = document.createElement('div');
            item.className = 'b3-list-item b3-list-item--hide-action';
            item.innerHTML = hint.html;
            item.style.cursor = 'pointer';

            item.addEventListener('click', () => {
                this.insertCrossReference(protyle, hint);
                menu.remove();
            });

            menu.appendChild(item);
        });

        // 定位菜单
        const range = protyle.toolbar?.range || document.getSelection()?.getRangeAt(0);
        if (range) {
            const rect = range.getBoundingClientRect();
            menu.style.left = rect.left + 'px';
            menu.style.top = (rect.bottom + 5) + 'px';
        }

        document.body.appendChild(menu);

        // 点击外部关闭菜单
        const closeMenu = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 100);
    }

    private insertCrossReference(protyle: IProtyle, hint: any) {
        const range = protyle.toolbar?.range || document.getSelection()?.getRangeAt(0);
        if (!range) return;

        // 删除@符号
        range.setStart(range.startContainer, range.startOffset - 1);
        range.deleteContents();

        // 插入交叉引用
        const refElement = document.createElement('span');
        refElement.className = 'document-styler-cross-ref';
        refElement.setAttribute('data-ref-id', hint.id);
        refElement.setAttribute('data-ref-type', hint.type);
        refElement.textContent = hint.value;
        refElement.style.cssText = `
            color: var(--b3-theme-primary);
            text-decoration: underline;
            cursor: pointer;
        `;

        range.insertNode(refElement);
        range.setStartAfter(refElement);
        range.collapse(true);

        // 添加点击事件
        refElement.addEventListener('click', () => {
            this.scrollToFigure(hint.id);
        });
    }

    private scrollToFigure(figureId: string) {
        const element = document.querySelector(`[data-node-id="${figureId}"]`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // 高亮显示
            element.classList.add('protyle-wysiwyg--select');
            setTimeout(() => {
                element.classList.remove('protyle-wysiwyg--select');
            }, 2000);
        }
    }
}

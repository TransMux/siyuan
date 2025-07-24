import { Plugin } from "../../index";
import { fetchPost } from "../../../util/fetch";
import { showMessage } from "../../../dialog/message";
import { NocodbApiClient, NocodbConfig, parseNocodbId, renderField } from "./utils";

/**
 * Built-in plugin: Nocodb Connector
 * 连接思源和Nocodb，在protyle-attr和文档属性视图中显示Nocodb数据
 */
export class NocodbConnectorPlugin extends Plugin {
    private apiClient: NocodbApiClient;
    private config: NocodbConfig;

    constructor(options: { app: import("../../../index").App; name: string; displayName: string; i18n: IObject }) {
        super(options);

        // 初始化配置
        this.config = {
            serverUrl: "http://server:18866",
            token: "QCQt9Ud_C9BW3JPG6djcn02XRr57ffi1SgYotFup",
            tableConfigs: {
                "m7vb2ve7wuh5fld": {
                    columns: {
                        "CreatedAt": { type: "string", readonly: true },
                        "inserted_at": { type: "string", readonly: true },
                        "url": { type: "link", readonly: false },
                        "status": { type: "string", readonly: true }
                    }
                }
            }
        };

        // 初始化API客户端
        this.apiClient = new NocodbApiClient(this.config);

        // 验证配置
        this.validateConfig();
    }

    /**
     * 插件加载时调用
     */
    async onload(): Promise<void> {
        try {
            console.log('NocodbConnector plugin loading...');
            
            // 绑定事件监听器
            this.bindEvents();
            
            console.log('NocodbConnector plugin loaded successfully');
        } catch (error) {
            console.error('NocodbConnector plugin failed to load:', error);
        }
    }

    /**
     * 插件卸载时调用
     */
    async onunload(): Promise<void> {
        try {
            // 解绑事件监听器
            this.unbindEvents();
            
            console.log('NocodbConnector plugin unloaded successfully');
        } catch (error) {
            console.error('NocodbConnector plugin failed to unload:', error);
        }
    }

    /**
     * 绑定事件监听器
     */
    private bindEvents(): void {
        // 监听protyle加载完成事件
        this.eventBus.on("loaded-protyle-static", this.onProtyleLoaded.bind(this));
        
        // 监听文档切换事件
        this.eventBus.on("switch-protyle", this.onProtyleSwitched.bind(this));
    }

    /**
     * 解绑事件监听器
     */
    private unbindEvents(): void {
        this.eventBus.off("loaded-protyle-static", this.onProtyleLoaded.bind(this));
        this.eventBus.off("switch-protyle", this.onProtyleSwitched.bind(this));
    }

    /**
     * protyle加载完成事件处理
     */
    private async onProtyleLoaded(event: CustomEvent): Promise<void> {
        try {
            const protyle = event.detail?.protyle;
            if (!protyle?.block?.rootID) return;

            console.log('NocodbConnector: protyle loaded, checking for nocodb blocks...');
            
            // 检查并处理带有nocodb属性的blocks
            await this.processNocodbBlocks(protyle);
            
            // 检查并处理文档属性
            await this.processDocumentAttributes(protyle);
            
        } catch (error) {
            console.error('NocodbConnector: protyle loaded event handling failed:', error);
        }
    }

    /**
     * protyle切换事件处理
     */
    private async onProtyleSwitched(event: CustomEvent): Promise<void> {
        try {
            const protyle = event.detail?.protyle;
            if (!protyle?.block?.rootID) return;

            console.log('NocodbConnector: protyle switched, checking for nocodb blocks...');
            
            // 检查并处理带有nocodb属性的blocks
            await this.processNocodbBlocks(protyle);
            
            // 检查并处理文档属性
            await this.processDocumentAttributes(protyle);
            
        } catch (error) {
            console.error('NocodbConnector: protyle switched event handling failed:', error);
        }
    }

    /**
     * 处理带有nocodb属性的blocks
     */
    private async processNocodbBlocks(protyle: any): Promise<void> {
        try {
            // 查找所有带有custom-nocodb-table-row-id属性的blocks
            const blocks = protyle.wysiwyg.element.querySelectorAll('[data-node-id]');
            let processedCount = 0;

            for (const block of blocks) {
                const blockId = block.getAttribute('data-node-id');
                if (!blockId) continue;

                try {
                    // 获取block属性
                    const attrs = await this.getBlockAttributes(blockId);
                    const nocodbId = attrs['custom-nocodb-table-row-id'];

                    if (nocodbId) {
                        console.log(`NocodbConnector: Found nocodb block ${blockId} with id ${nocodbId}`);
                        await this.renderNocodbDataInProtyleAttr(block, nocodbId);
                        processedCount++;
                    }
                } catch (error) {
                    console.error(`NocodbConnector: Failed to process block ${blockId}:`, error);
                    // 继续处理其他blocks，不因为单个block失败而停止
                }
            }

            if (processedCount > 0) {
                console.log(`NocodbConnector: Processed ${processedCount} nocodb blocks`);
            }
        } catch (error) {
            console.error('NocodbConnector: process nocodb blocks failed:', error);
        }
    }

    /**
     * 处理文档属性
     */
    private async processDocumentAttributes(protyle: any): Promise<void> {
        try {
            const docId = protyle.block.rootID;
            
            // 获取文档属性
            const attrs = await this.getBlockAttributes(docId);
            const nocodbId = attrs['custom-nocodb-table-row-id'];
            
            if (nocodbId) {
                console.log(`NocodbConnector: Found nocodb document ${docId} with id ${nocodbId}`);
                await this.renderNocodbDataInDocumentAttr(protyle, nocodbId);
            }
        } catch (error) {
            console.error('NocodbConnector: process document attributes failed:', error);
        }
    }

    /**
     * 在protyle-attr中渲染nocodb数据
     */
    private async renderNocodbDataInProtyleAttr(blockElement: Element, nocodbId: string): Promise<void> {
        try {
            // 解析table_id和row_id
            const parsed = parseNocodbId(nocodbId);
            if (!parsed) {
                console.warn(`NocodbConnector: Invalid nocodb id format: ${nocodbId}`);
                return;
            }

            const { tableId, rowId } = parsed;

            // 查找protyle-attr元素
            const attrElement = blockElement.querySelector('.protyle-attr');
            if (!attrElement) {
                console.warn(`NocodbConnector: No protyle-attr element found for block`);
                return;
            }

            // 显示加载状态
            this.showLoadingInElement(attrElement, 'nocodb-data');

            // 获取nocodb数据
            const data = await this.apiClient.getRecord(tableId, rowId);

            // 渲染数据
            this.renderNocodbDataInElement(attrElement, data, tableId);

        } catch (error) {
            console.error('NocodbConnector: render nocodb data in protyle-attr failed:', error);

            // 显示错误状态
            const attrElement = blockElement.querySelector('.protyle-attr');
            if (attrElement) {
                this.showErrorInElement(attrElement, 'nocodb-data', error.message);
            }
        }
    }

    /**
     * 在文档属性视图中渲染nocodb数据
     */
    private async renderNocodbDataInDocumentAttr(protyle: any, nocodbId: string): Promise<void> {
        try {
            // 解析table_id和row_id
            const parsed = parseNocodbId(nocodbId);
            if (!parsed) {
                console.warn(`NocodbConnector: Invalid nocodb id format: ${nocodbId}`);
                return;
            }

            const { tableId, rowId } = parsed;

            // 获取nocodb数据
            const data = await this.apiClient.getRecord(tableId, rowId);
            
            // 创建或更新文档属性面板
            await this.createDocumentAttributePanel(protyle, data, tableId);
            
        } catch (error) {
            console.error('NocodbConnector: render nocodb data in document attr failed:', error);
        }
    }

    /**
     * 在元素中渲染nocodb数据
     */
    private renderNocodbDataInElement(element: Element, data: any, tableId: string): void {
        const tableConfig = this.config.tableConfigs[tableId];
        if (!tableConfig) {
            console.warn(`NocodbConnector: No config found for table ${tableId}`);
            this.showErrorInElement(element, 'nocodb-data', `未找到表格 ${tableId} 的配置`);
            return;
        }

        let html = '<div class="nocodb-data" style="margin-top: 8px; padding: 8px; border: 1px solid var(--b3-border-color); border-radius: 4px; background-color: var(--b3-theme-surface);">';
        html += '<div style="font-weight: bold; margin-bottom: 8px; color: var(--b3-theme-primary); display: flex; align-items: center;">';
        html += '<svg style="width: 16px; height: 16px; margin-right: 4px;" viewBox="0 0 24 24" fill="currentColor">';
        html += '<path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6Z"/>';
        html += '</svg>';
        html += 'Nocodb 数据</div>';

        // 检查是否有数据
        const hasData = Object.keys(data).some(key =>
            tableConfig.columns[key] && data[key] !== undefined && data[key] !== null && data[key] !== ''
        );

        if (!hasData) {
            html += '<div style="color: var(--b3-theme-on-surface-light); font-style: italic; text-align: center; padding: 16px;">暂无数据</div>';
        } else {
            html += '<div style="display: grid; gap: 6px;">';

            for (const [columnName, columnConfig] of Object.entries(tableConfig.columns)) {
                const value = data[columnName];
                if (value !== undefined && value !== null && value !== '') {
                    html += `<div style="display: flex; align-items: flex-start; padding: 4px 0; border-bottom: 1px solid var(--b3-border-color-light);">`;
                    html += `<span style="font-weight: 500; color: var(--b3-theme-on-surface); min-width: 80px; margin-right: 12px; flex-shrink: 0;">${columnName}:</span>`;
                    html += `<div style="flex: 1; word-break: break-all;">${renderField(columnName, value, columnConfig)}</div>`;
                    html += `</div>`;
                }
            }

            html += '</div>';
        }

        html += '</div>';

        // 移除已存在的nocodb数据显示
        const existingNocodbData = element.querySelector('.nocodb-data');
        if (existingNocodbData) {
            existingNocodbData.remove();
        }

        // 添加新的数据显示
        element.insertAdjacentHTML('beforeend', html);
    }

    /**
     * 创建文档属性面板
     */
    private async createDocumentAttributePanel(protyle: any, data: any, tableId: string): Promise<void> {
        try {
            if (!protyle?.title?.element?.parentElement) {
                console.warn('NocodbConnector: protyle title element not found');
                return;
            }

            // 查找或创建nocodb文档属性面板
            let nocodbDocElement = protyle.title.element.parentElement.querySelector(".mux-doc-nocodb-panel") as HTMLElement;
            if (!nocodbDocElement) {
                nocodbDocElement = document.createElement("div");
                nocodbDocElement.className = "mux-doc-nocodb-panel";
                // 设置样式，模仿mux-doc-heading-attr-panel
                nocodbDocElement.style.marginRight = "96px";
                nocodbDocElement.style.marginLeft = "96px";
                nocodbDocElement.style.transition = "margin 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)";

                // 插入到title元素的父容器中
                protyle.title.element.parentElement.appendChild(nocodbDocElement);
            }

            // 渲染nocodb数据面板
            this.renderNocodbDocumentPanel(nocodbDocElement, data, tableId);

        } catch (error) {
            console.error('NocodbConnector: create document attribute panel failed:', error);
        }
    }

    /**
     * 渲染nocodb文档面板
     */
    private renderNocodbDocumentPanel(element: HTMLElement, data: any, tableId: string): void {
        const tableConfig = this.config.tableConfigs[tableId];
        if (!tableConfig) {
            console.warn(`NocodbConnector: No config found for table ${tableId}`);
            return;
        }

        // 使用思源AttributeView的DOM结构
        let html = `<div data-av-id="nocodb-${tableId}" data-av-type="table" data-node-id="${data.Id || 'unknown'}" data-type="NodeAttributeView">`;

        // 面板头部
        html += `<div class="custom-attr__avheader">`;
        html += `<div class="block__logo popover__block" style="max-width:calc(100% - 40px)">`;
        html += `<svg class="block__logoicon"><use xlink:href="#iconDatabase"></use></svg>`;
        html += `<span class="fn__ellipsis">🗄️ Nocodb 数据</span>`;
        html += `</div>`;
        html += `<div class="fn__flex-1"></div>`;
        html += `</div>`;

        // 检查是否有数据
        const hasData = Object.keys(data).some(key =>
            tableConfig.columns[key] && data[key] !== undefined && data[key] !== null && data[key] !== ''
        );

        if (!hasData) {
            html += `<div style="text-align: center; color: var(--b3-theme-on-surface-light); font-style: italic; padding: 32px;">`;
            html += `<div>暂无数据</div>`;
            html += `</div>`;
        } else {
            // 渲染数据行
            for (const [columnName, columnConfig] of Object.entries(tableConfig.columns)) {
                const value = data[columnName];
                if (value !== undefined && value !== null && value !== '') {
                    html += `<div class="block__icons av__row" data-id="${data.Id || 'unknown'}" data-col-id="nocodb-${columnName}">`;

                    // 拖拽图标
                    html += `<div class="block__icon" draggable="true"><svg><use xlink:href="#iconDrag"></use></svg></div>`;

                    // 字段标签
                    html += `<div class="block__logo ariaLabel fn__pointer" data-type="editCol" data-position="parentW" aria-label="${columnName}">`;
                    html += this.getFieldIcon(columnConfig.type);
                    html += `<span>${columnName}</span>`;
                    html += `</div>`;

                    // 字段值
                    const readonlyClass = columnConfig.readonly ? ' custom-attr__avvalue--readonly' : '';
                    html += `<div data-av-id="nocodb-${tableId}" data-col-id="nocodb-${columnName}" data-block-id="${data.Id || 'unknown'}" `;
                    html += `data-id="nocodb-${columnName}-${data.Id || 'unknown'}" data-type="${this.getAvType(columnConfig.type)}" `;
                    html += `data-options="[]" class="fn__flex-1 fn__flex custom-attr__avvalue${readonlyClass}">`;

                    if (columnConfig.readonly) {
                        // 只读字段
                        html += this.renderReadonlyAvField(columnName, value, columnConfig);
                    } else {
                        // 可编辑字段
                        html += this.renderEditableAvField(columnName, value, columnConfig, tableId, data);
                    }

                    html += `</div>`;
                    html += `</div>`;
                }
            }
        }

        html += `</div>`;

        element.innerHTML = html;

        // 绑定可编辑字段的事件
        this.bindEditableFieldEvents(element, tableId, data);
    }

    /**
     * 获取字段图标
     */
    private getFieldIcon(fieldType: string): string {
        switch (fieldType) {
            case 'link':
                return `<svg class="block__logoicon"><use xlink:href="#iconLink"></use></svg>`;
            case 'date':
                return `<svg class="block__logoicon"><use xlink:href="#iconCalendar"></use></svg>`;
            case 'boolean':
                return `<svg class="block__logoicon"><use xlink:href="#iconCheck"></use></svg>`;
            case 'number':
                return `<span class="block__logoicon">🔢</span>`;
            case 'string':
            default:
                return `<svg class="block__logoicon"><use xlink:href="#iconText"></use></svg>`;
        }
    }

    /**
     * 获取AttributeView类型
     */
    private getAvType(fieldType: string): string {
        switch (fieldType) {
            case 'link':
                return 'url';
            case 'date':
                return 'date';
            case 'boolean':
                return 'checkbox';
            case 'number':
                return 'number';
            case 'string':
            default:
                return 'text';
        }
    }

    /**
     * 渲染只读AttributeView字段
     */
    private renderReadonlyAvField(columnName: string, value: any, config: any): string {
        switch (config.type) {
            case 'link':
                const maxLinkLength = 50;
                const displayUrl = value.length > maxLinkLength ? value.substring(0, maxLinkLength) + '...' : value;
                return `<a href="${value}" target="_blank" class="av__celltext" title="${value}">${displayUrl}</a>`;

            case 'date':
                return `<span class="av__celltext" data-content="${value}">${this.formatDateForDisplay(value)}</span>`;

            case 'boolean':
                const iconHref = value ? '#iconCheck' : '#iconUncheck';
                return `<svg class="av__checkbox"><use xlink:href="${iconHref}"></use></svg>`;

            case 'number':
                return `<span class="av__celltext">${value}</span>`;

            case 'string':
            default:
                return `<span class="av__celltext">${value}</span>`;
        }
    }

    /**
     * 渲染可编辑AttributeView字段
     */
    private renderEditableAvField(columnName: string, value: any, config: any, tableId: string, data: any): string {
        const fieldId = `nocodb-av-field-${columnName}-${Date.now()}`;

        switch (config.type) {
            case 'link':
                return `<input type="url" id="${fieldId}" value="${value || ''}"
                        class="av__celltext b3-text-field"
                        placeholder="请输入链接地址"
                        data-column="${columnName}">`;

            case 'boolean':
                const iconHref = value ? '#iconCheck' : '#iconUncheck';
                return `<svg class="av__checkbox" id="${fieldId}" data-column="${columnName}" data-checked="${!!value}">
                        <use xlink:href="${iconHref}"></use></svg>`;

            case 'number':
                return `<input type="number" id="${fieldId}" value="${value || ''}"
                        class="av__celltext b3-text-field"
                        data-column="${columnName}">`;

            case 'string':
            default:
                return `<input type="text" id="${fieldId}" value="${value || ''}"
                        class="av__celltext b3-text-field"
                        placeholder="请输入内容"
                        data-column="${columnName}">`;
        }
    }

    /**
     * 格式化日期显示
     */
    private formatDateForDisplay(dateString: string): string {
        if (!dateString) return '';

        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } catch (error) {
            console.error('formatDateForDisplay error:', error);
            return dateString;
        }
    }

    /**
     * 为面板渲染可编辑字段
     */
    private renderEditableFieldForPanel(columnName: string, value: any, config: any, tableId: string, data: any): string {
        const fieldId = `nocodb-panel-field-${columnName}-${Date.now()}`;

        switch (config.type) {
            case 'link':
                return `<input type="url" id="${fieldId}" value="${value || ''}"
                        class="b3-text-field fn__block"
                        placeholder="请输入链接地址"
                        data-column="${columnName}">`;

            case 'boolean':
                return `<div class="fn__flex" style="align-items: center;">
                        <input type="checkbox" id="${fieldId}" ${value ? 'checked' : ''}
                               class="b3-switch fn__flex-center"
                               data-column="${columnName}">
                        <span style="margin-left: 8px; color: var(--b3-theme-on-surface-light);">${value ? '是' : '否'}</span>
                        </div>`;

            case 'number':
                return `<input type="number" id="${fieldId}" value="${value || ''}"
                        class="b3-text-field fn__block"
                        data-column="${columnName}">`;

            case 'string':
            default:
                if (typeof value === 'string' && value.includes('\n')) {
                    return `<textarea id="${fieldId}" rows="3"
                            class="b3-text-field fn__block"
                            style="resize: vertical;"
                            placeholder="请输入内容"
                            data-column="${columnName}">${value || ''}</textarea>`;
                } else {
                    return `<input type="text" id="${fieldId}" value="${value || ''}"
                            class="b3-text-field fn__block"
                            placeholder="请输入内容"
                            data-column="${columnName}">`;
                }
        }
    }

    /**
     * 绑定可编辑字段事件
     */
    private bindEditableFieldEvents(element: HTMLElement, tableId: string, originalData: any): void {
        // 处理输入框
        const inputs = element.querySelectorAll('input[data-column], textarea[data-column]');
        inputs.forEach((input: HTMLInputElement | HTMLTextAreaElement) => {
            this.bindInputFieldEvent(input, tableId, originalData);
        });

        // 处理复选框
        const checkboxes = element.querySelectorAll('.av__checkbox[data-column]');
        checkboxes.forEach((checkbox: Element) => {
            this.bindCheckboxFieldEvent(checkbox, tableId, originalData);
        });
    }

    /**
     * 绑定输入框字段事件
     */
    private bindInputFieldEvent(input: HTMLInputElement | HTMLTextAreaElement, tableId: string, originalData: any): void {
        const columnName = input.getAttribute('data-column');
        if (!columnName) return;

        // 防抖更新
        let updateTimeout: NodeJS.Timeout;

        const handleUpdate = () => {
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(async () => {
                try {
                    let newValue: any = input.value;

                    // 根据字段类型转换值
                    const columnConfig = this.config.tableConfigs[tableId]?.columns[columnName];
                    if (columnConfig) {
                        switch (columnConfig.type) {
                            case 'number':
                                newValue = parseFloat(input.value) || 0;
                                break;
                            default:
                                newValue = input.value;
                        }
                    }

                    await this.updateNocodbField(tableId, originalData, columnName, newValue);
                    this.showUpdateSuccess(input);

                } catch (error) {
                    console.error('NocodbConnector: Update field failed:', error);
                    this.showUpdateError(input, error.message);
                }
            }, 1000); // 1秒防抖
        };

        input.addEventListener('input', handleUpdate);
        input.addEventListener('blur', handleUpdate);
    }

    /**
     * 绑定复选框字段事件
     */
    private bindCheckboxFieldEvent(checkbox: Element, tableId: string, originalData: any): void {
        const columnName = checkbox.getAttribute('data-column');
        if (!columnName) return;

        checkbox.addEventListener('click', async () => {
            try {
                const currentChecked = checkbox.getAttribute('data-checked') === 'true';
                const newValue = !currentChecked;

                // 更新UI
                checkbox.setAttribute('data-checked', newValue.toString());
                const useElement = checkbox.querySelector('use');
                if (useElement) {
                    useElement.setAttribute('xlink:href', newValue ? '#iconCheck' : '#iconUncheck');
                }

                await this.updateNocodbField(tableId, originalData, columnName, newValue);
                this.showUpdateSuccess(checkbox as HTMLElement);

            } catch (error) {
                console.error('NocodbConnector: Update checkbox failed:', error);
                this.showUpdateError(checkbox as HTMLElement, error.message);

                // 回滚UI状态
                const currentChecked = checkbox.getAttribute('data-checked') === 'true';
                checkbox.setAttribute('data-checked', (!currentChecked).toString());
                const useElement = checkbox.querySelector('use');
                if (useElement) {
                    useElement.setAttribute('xlink:href', !currentChecked ? '#iconCheck' : '#iconUncheck');
                }
            }
        });
    }

    /**
     * 更新Nocodb字段
     */
    private async updateNocodbField(tableId: string, originalData: any, columnName: string, newValue: any): Promise<void> {
        // 获取行ID
        const rowId = originalData.Id || originalData.id;
        if (!rowId) {
            throw new Error('No row ID found in data for update');
        }

        // 更新数据
        await this.apiClient.updateRecord(tableId, rowId, {
            [columnName]: newValue
        });

        console.log(`NocodbConnector: Updated ${columnName} to ${newValue}`);
    }

    /**
     * 显示更新成功提示
     */
    private showUpdateSuccess(input: HTMLElement): void {
        const originalBorder = input.style.border;
        input.style.border = '2px solid var(--b3-theme-success)';
        input.style.transition = 'border 0.3s ease';

        setTimeout(() => {
            input.style.border = originalBorder;
        }, 2000);
    }

    /**
     * 显示更新错误提示
     */
    private showUpdateError(input: HTMLElement, errorMessage: string): void {
        const originalBorder = input.style.border;
        input.style.border = '2px solid var(--b3-theme-error)';
        input.style.transition = 'border 0.3s ease';
        input.title = `更新失败: ${errorMessage}`;

        setTimeout(() => {
            input.style.border = originalBorder;
            input.title = '';
        }, 5000);
    }

    /**
     * 显示加载状态
     */
    private showLoadingInElement(element: Element, className: string): void {
        // 移除已存在的数据显示
        const existingElement = element.querySelector(`.${className}`);
        if (existingElement) {
            existingElement.remove();
        }

        const html = `<div class="${className}" style="margin-top: 8px; padding: 8px; border: 1px solid var(--b3-border-color); border-radius: 4px;">
            <div style="font-weight: bold; margin-bottom: 8px; color: var(--b3-theme-primary);">Nocodb 数据</div>
            <div style="color: var(--b3-theme-on-surface-light); font-style: italic;">
                <svg style="width: 16px; height: 16px; margin-right: 4px; animation: spin 1s linear infinite;" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.416" stroke-dashoffset="31.416">
                        <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                        <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
                    </circle>
                </svg>
                正在加载数据...
            </div>
        </div>`;

        element.insertAdjacentHTML('beforeend', html);
    }

    /**
     * 显示错误状态
     */
    private showErrorInElement(element: Element, className: string, errorMessage: string): void {
        // 移除已存在的数据显示
        const existingElement = element.querySelector(`.${className}`);
        if (existingElement) {
            existingElement.remove();
        }

        const html = `<div class="${className}" style="margin-top: 8px; padding: 8px; border: 1px solid var(--b3-theme-error); border-radius: 4px; background-color: var(--b3-theme-error-lighter);">
            <div style="font-weight: bold; margin-bottom: 8px; color: var(--b3-theme-error);">Nocodb 数据加载失败</div>
            <div style="color: var(--b3-theme-error); font-size: 12px;">${errorMessage}</div>
        </div>`;

        element.insertAdjacentHTML('beforeend', html);
    }

    /**
     * 验证配置
     */
    private validateConfig(): void {
        if (!this.config.serverUrl) {
            console.warn('NocodbConnector: Server URL not configured');
        }

        if (!this.config.token) {
            console.warn('NocodbConnector: API token not configured');
        }

        if (!this.config.tableConfigs || Object.keys(this.config.tableConfigs).length === 0) {
            console.warn('NocodbConnector: No table configurations found');
        }

        // 验证表格配置
        Object.entries(this.config.tableConfigs).forEach(([tableId, tableConfig]) => {
            if (!(tableConfig as any).columns || Object.keys((tableConfig as any).columns).length === 0) {
                console.warn(`NocodbConnector: No column configurations found for table ${tableId}`);
            }
        });
    }

    /**
     * 获取block属性
     */
    private async getBlockAttributes(blockId: string): Promise<Record<string, string>> {
        return new Promise((resolve, reject) => {
            fetchPost("/api/attr/getBlockAttrs", { id: blockId }, (response) => {
                if (response.code === 0) {
                    resolve(response.data || {});
                } else {
                    reject(new Error(response.msg || "获取块属性失败"));
                }
            });
        });
    }
}

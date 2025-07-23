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

        // 创建面板HTML结构，模仿思源的属性面板样式
        let html = `<div class="fn__flex-column" style="background-color: var(--b3-theme-surface); border: 1px solid var(--b3-border-color); border-radius: var(--b3-border-radius); margin-top: 16px;">`;

        // 面板标题
        html += `<div class="block__icons" style="padding: 8px 16px; border-bottom: 1px solid var(--b3-border-color);">`;
        html += `<div class="block__logo" style="display: flex; align-items: center;">`;
        html += `<svg class="block__logoicon" style="width: 16px; height: 16px; margin-right: 8px;" viewBox="0 0 24 24" fill="currentColor">`;
        html += `<path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6Z"/>`;
        html += `</svg>`;
        html += `<span style="color: var(--b3-theme-on-surface); font-weight: 500;">Nocodb 数据</span>`;
        html += `</div>`;
        html += `</div>`;

        // 面板内容
        html += `<div style="padding: 16px;">`;

        // 检查是否有数据
        const hasData = Object.keys(data).some(key =>
            tableConfig.columns[key] && data[key] !== undefined && data[key] !== null && data[key] !== ''
        );

        if (!hasData) {
            html += `<div style="text-align: center; color: var(--b3-theme-on-surface-light); font-style: italic; padding: 32px;">`;
            html += `<svg style="width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.5;" viewBox="0 0 24 24" fill="currentColor">`;
            html += `<path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4Z"/>`;
            html += `</svg>`;
            html += `<div>暂无数据</div>`;
            html += `</div>`;
        } else {
            // 渲染数据字段
            for (const [columnName, columnConfig] of Object.entries(tableConfig.columns)) {
                const value = data[columnName];
                if (value !== undefined && value !== null && value !== '') {
                    html += `<label class="b3-label b3-label--noborder" style="margin-bottom: 12px;">`;
                    html += `<div class="fn__flex" style="margin-bottom: 4px;">`;
                    html += `<span class="fn__flex-1" style="font-weight: 500; color: var(--b3-theme-on-surface);">${columnName}</span>`;
                    if (columnConfig.readonly) {
                        html += `<span style="font-size: 12px; color: var(--b3-theme-on-surface-light); opacity: 0.7;">只读</span>`;
                    }
                    html += `</div>`;
                    html += `<div class="fn__hr"></div>`;

                    if (columnConfig.readonly) {
                        // 只读字段，直接显示值
                        html += `<div style="padding: 8px; background-color: var(--b3-theme-surface-light); border-radius: 4px; color: var(--b3-theme-on-surface-light);">`;
                        html += renderField(columnName, value, columnConfig);
                        html += `</div>`;
                    } else {
                        // 可编辑字段
                        html += this.renderEditableFieldForPanel(columnName, value, columnConfig, tableId, data);
                    }

                    html += `</label>`;
                }
            }
        }

        html += `</div>`;
        html += `</div>`;

        element.innerHTML = html;

        // 绑定可编辑字段的事件
        this.bindEditableFieldEvents(element, tableId, data);
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
        const inputs = element.querySelectorAll('input[data-column], textarea[data-column]');

        inputs.forEach((input: HTMLInputElement | HTMLTextAreaElement) => {
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
                                case 'boolean':
                                    newValue = (input as HTMLInputElement).checked;
                                    break;
                                case 'number':
                                    newValue = parseFloat(input.value) || 0;
                                    break;
                                default:
                                    newValue = input.value;
                            }
                        }

                        // 解析nocodb ID - 从原始数据中获取正确的ID
                        // 通常nocodb返回的数据中会有Id字段作为行ID
                        const rowId = originalData.Id || originalData.id;
                        if (!rowId) {
                            console.error('NocodbConnector: No row ID found in data for update');
                            return;
                        }

                        // 更新数据
                        await this.apiClient.updateRecord(tableId, rowId, {
                            [columnName]: newValue
                        });

                        console.log(`NocodbConnector: Updated ${columnName} to ${newValue}`);

                        // 显示成功提示
                        this.showUpdateSuccess(input);

                    } catch (error) {
                        console.error('NocodbConnector: Update field failed:', error);
                        this.showUpdateError(input, error.message);
                    }
                }, 1000); // 1秒防抖
            };

            // 绑定事件
            if (input.type === 'checkbox') {
                input.addEventListener('change', handleUpdate);
            } else {
                input.addEventListener('input', handleUpdate);
                input.addEventListener('blur', handleUpdate);
            }
        });
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
            if (!tableConfig.columns || Object.keys(tableConfig.columns).length === 0) {
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

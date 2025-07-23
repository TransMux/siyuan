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
            
            for (const block of blocks) {
                const blockId = block.getAttribute('data-node-id');
                if (!blockId) continue;

                // 获取block属性
                const attrs = await this.getBlockAttributes(blockId);
                const nocodbId = attrs['custom-nocodb-table-row-id'];
                
                if (nocodbId) {
                    console.log(`NocodbConnector: Found nocodb block ${blockId} with id ${nocodbId}`);
                    await this.renderNocodbDataInProtyleAttr(block, nocodbId);
                }
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
        // TODO: 实现文档属性面板的创建和显示
        console.log('NocodbConnector: Document attribute panel creation not implemented yet');
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

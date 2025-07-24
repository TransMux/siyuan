/**
 * Nocodb连接器工具类和配置
 */

export interface NocodbColumnConfig {
    type: 'string' | 'link' | 'number' | 'date' | 'boolean';
    readonly: boolean;
}

export interface NocodbTableConfig {
    columns: Record<string, NocodbColumnConfig>;
}

export interface NocodbConfig {
    serverUrl: string;
    token: string;
    tableConfigs: Record<string, NocodbTableConfig>;
}

/**
 * Nocodb API客户端
 */
export class NocodbApiClient {
    private config: NocodbConfig;

    constructor(config: NocodbConfig) {
        this.config = config;
    }

    /**
     * 获取记录数据
     * @param tableId 表格ID
     * @param rowId 行ID
     * @param fields 要获取的字段，如果不指定则获取所有字段
     * @returns 记录数据
     */
    async getRecord(tableId: string, rowId: string, fields?: string[]): Promise<any> {
        try {
            const url = `${this.config.serverUrl}/api/v2/tables/${tableId}/records/${rowId}`;
            const params = new URLSearchParams();
            
            if (fields && fields.length > 0) {
                params.append('fields', fields.join(','));
            }
            
            const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;
            
            const response = await fetch(fullUrl, {
                method: 'GET',
                headers: {
                    'xc-token': this.config.token,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
            
        } catch (error) {
            console.error(`NocodbApiClient: Failed to get record ${tableId}/${rowId}:`, error);
            throw error;
        }
    }

    /**
     * 更新记录数据
     * @param tableId 表格ID
     * @param rowId 行ID
     * @param data 要更新的数据
     * @returns 更新后的记录数据
     */
    async updateRecord(tableId: string, rowId: string, data: Record<string, any>): Promise<any> {
        try {
            const url = `${this.config.serverUrl}/api/v2/tables/${tableId}/records`;

            // 构建更新数据，包含Id字段
            const updateData = [{
                Id: parseInt(rowId),
                ...data
            }];

            const response = await fetch(url, {
                method: 'PATCH',
                headers: {
                    'xc-token': this.config.token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const result = await response.json();
            return result;

        } catch (error) {
            console.error(`NocodbApiClient: Failed to update record ${tableId}/${rowId}:`, error);
            throw error;
        }
    }

    /**
     * 获取表格的列信息
     * @param tableId 表格ID
     * @returns 列信息
     */
    async getTableColumns(tableId: string): Promise<any[]> {
        try {
            const url = `${this.config.serverUrl}/api/v2/tables/${tableId}/columns`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'xc-token': this.config.token,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.list || [];
            
        } catch (error) {
            console.error(`NocodbApiClient: Failed to get table columns ${tableId}:`, error);
            throw error;
        }
    }

    /**
     * 测试连接
     * @returns 连接是否成功
     */
    async testConnection(): Promise<boolean> {
        try {
            const url = `${this.config.serverUrl}/api/v1/db/meta/projects`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'xc-token': this.config.token,
                    'Content-Type': 'application/json'
                }
            });

            return response.ok;
            
        } catch (error) {
            console.error('NocodbApiClient: Connection test failed:', error);
            return false;
        }
    }
}

/**
 * 解析nocodb ID
 * @param nocodbId 格式为 {table_id}-{row_id} 的ID
 * @returns 解析后的table_id和row_id
 */
export function parseNocodbId(nocodbId: string): { tableId: string; rowId: string } | null {
    if (!nocodbId || typeof nocodbId !== 'string') {
        return null;
    }

    const parts = nocodbId.split('-');
    if (parts.length !== 2) {
        return null;
    }

    const [tableId, rowId] = parts;
    if (!tableId || !rowId) {
        return null;
    }

    return { tableId, rowId };
}

/**
 * 格式化日期时间
 * @param dateString 日期字符串
 * @returns 格式化后的日期字符串
 */
export function formatDateTime(dateString: string): string {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (error) {
        console.error('formatDateTime error:', error);
        return dateString;
    }
}

/**
 * 创建字段渲染器
 * @param columnName 列名
 * @param value 值
 * @param config 列配置
 * @returns HTML字符串
 */
export function renderField(columnName: string, value: any, config: NocodbColumnConfig): string {
    if (value === undefined || value === null || value === '') {
        return `<span style="color: var(--b3-theme-on-surface-light); font-style: italic;">空</span>`;
    }

    switch (config.type) {
        case 'link':
            // 截断长链接显示
            const maxLinkLength = 50;
            const displayUrl = value.length > maxLinkLength ? value.substring(0, maxLinkLength) + '...' : value;
            return `<a href="${value}" target="_blank"
                    style="color: var(--b3-theme-primary); text-decoration: underline; word-break: break-all;"
                    title="${value}">${displayUrl}</a>`;

        case 'date':
            return `<span style="color: var(--b3-theme-on-surface-light); font-family: monospace;">${formatDateTime(value)}</span>`;

        case 'boolean':
            const boolIcon = value ? '✓' : '✗';
            const boolColor = value ? 'var(--b3-theme-success)' : 'var(--b3-theme-error)';
            return `<span style="color: ${boolColor}; font-weight: bold;">${boolIcon} ${value ? '是' : '否'}</span>`;

        case 'number':
            return `<span style="color: var(--b3-theme-on-surface-light); font-family: monospace; font-weight: 500;">${value}</span>`;

        case 'string':
        default:
            // 处理多行文本
            if (typeof value === 'string' && value.includes('\n')) {
                const lines = value.split('\n');
                const maxLines = 3;
                const displayLines = lines.slice(0, maxLines);
                const hasMore = lines.length > maxLines;

                let html = '<div style="white-space: pre-wrap; word-break: break-word;">';
                html += displayLines.join('\n');
                if (hasMore) {
                    html += `\n<span style="color: var(--b3-theme-on-surface-light); font-style: italic;">... (还有 ${lines.length - maxLines} 行)</span>`;
                }
                html += '</div>';
                return html;
            } else {
                // 单行文本，截断显示
                const maxLength = 100;
                const displayValue = value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
                return `<span style="color: var(--b3-theme-on-surface-light); word-break: break-word;" title="${value}">${displayValue}</span>`;
            }
    }
}

/**
 * 创建可编辑字段渲染器
 * @param columnName 列名
 * @param value 值
 * @param config 列配置
 * @param onUpdate 更新回调
 * @returns HTML字符串
 */
export function renderEditableField(
    columnName: string, 
    value: any, 
    config: NocodbColumnConfig, 
    onUpdate?: (newValue: any) => void
): string {
    if (config.readonly) {
        return renderField(columnName, value, config);
    }

    const fieldId = `nocodb-field-${columnName}-${Date.now()}`;
    
    switch (config.type) {
        case 'link':
            return `<input type="url" id="${fieldId}" value="${value || ''}" 
                    style="width: 100%; padding: 4px; border: 1px solid var(--b3-border-color); border-radius: 3px;"
                    placeholder="请输入链接地址">`;
        
        case 'boolean':
            return `<input type="checkbox" id="${fieldId}" ${value ? 'checked' : ''} 
                    style="margin-right: 8px;">`;
        
        case 'number':
            return `<input type="number" id="${fieldId}" value="${value || ''}" 
                    style="width: 100%; padding: 4px; border: 1px solid var(--b3-border-color); border-radius: 3px; font-family: monospace;">`;
        
        case 'string':
        default:
            if (typeof value === 'string' && value.includes('\n')) {
                return `<textarea id="${fieldId}" rows="3" 
                        style="width: 100%; padding: 4px; border: 1px solid var(--b3-border-color); border-radius: 3px; resize: vertical;"
                        placeholder="请输入内容">${value || ''}</textarea>`;
            } else {
                return `<input type="text" id="${fieldId}" value="${value || ''}" 
                        style="width: 100%; padding: 4px; border: 1px solid var(--b3-border-color); border-radius: 3px;"
                        placeholder="请输入内容">`;
            }
    }
}

/**
 * 防抖函数
 * @param func 要防抖的函数
 * @param wait 等待时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout;
    return ((...args: any[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    }) as T;
}

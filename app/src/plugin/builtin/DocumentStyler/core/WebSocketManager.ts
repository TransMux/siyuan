/**
 * WebSocket 管理器
 * 负责监听思源的 WebSocket 事件，实现实时更新功能
 */

import { IModule } from "../types";
import { TransactionAnalyzer } from "../utils/transactionAnalyzer";
import { SettingsManager } from "./SettingsManager";
import { DocumentManager } from "./DocumentManager";
import { HeadingNumbering } from "./HeadingNumbering";
import { CrossReference } from "./CrossReference";
import { debounce } from "../utils/domUtils";

/**
 * WebSocket 事件过滤器接口
 */
export interface IWebSocketFilter {
    (msg: any): boolean;
}

/**
 * WebSocket 监听器选项
 */
export interface IWebSocketListenerOptions {
    /** 事件过滤器 */
    filter?: IWebSocketFilter;
    /** 是否只执行一次 */
    once?: boolean;
    /** 超时时间（毫秒） */
    timeout?: number;
}

/**
 * WebSocket 管理器类
 */
export class WebSocketManager implements IModule {
    private settingsManager: SettingsManager;
    private documentManager: DocumentManager;
    private headingNumbering: HeadingNumbering;
    private crossReference: CrossReference;
    
    private ws: WebSocket | null = null;
    private isConnected: boolean = false;
    private messageHandler: ((event: MessageEvent) => void) | null = null;
    
    // 防抖更新函数
    private debouncedUpdateHeadings = debounce(this.updateHeadingsForDoc.bind(this), 1000);
    private debouncedUpdateFigures = debounce(this.updateFiguresForDoc.bind(this), 1000);
    
    // 活跃的监听器
    private activeListeners: Map<string, {
        resolve: (value: any) => void;
        reject: (reason: any) => void;
        filter?: IWebSocketFilter;
        timeout?: NodeJS.Timeout;
    }> = new Map();

    constructor(
        settingsManager: SettingsManager,
        documentManager: DocumentManager,
        headingNumbering: HeadingNumbering,
        crossReference: CrossReference
    ) {
        this.settingsManager = settingsManager;
        this.documentManager = documentManager;
        this.headingNumbering = headingNumbering;
        this.crossReference = crossReference;
    }

    async init(): Promise<void> {
        this.connectToWebSocket();
    }

    destroy(): void {
        this.disconnectFromWebSocket();
        this.clearAllListeners();
    }

    /**
     * 连接到思源的 WebSocket
     */
    private connectToWebSocket(): void {
        try {
            // 获取思源的 WebSocket 实例
            if (window.siyuan?.ws?.ws) {
                this.ws = window.siyuan.ws.ws;
                this.setupMessageHandler();
                this.isConnected = true;
                console.log('WebSocketManager: 已连接到思源 WebSocket');
            } else {
                console.warn('WebSocketManager: 无法获取思源 WebSocket 实例');
                // 延迟重试
                setTimeout(() => this.connectToWebSocket(), 1000);
            }
        } catch (error) {
            console.error('WebSocketManager: 连接 WebSocket 失败:', error);
        }
    }

    /**
     * 断开 WebSocket 连接
     */
    private disconnectFromWebSocket(): void {
        if (this.ws && this.messageHandler) {
            this.ws.removeEventListener('message', this.messageHandler);
            this.messageHandler = null;
        }
        this.isConnected = false;
        console.log('WebSocketManager: 已断开 WebSocket 连接');
    }

    /**
     * 设置消息处理器
     */
    private setupMessageHandler(): void {
        if (!this.ws) return;

        this.messageHandler = (event: MessageEvent) => {
            try {
                const msg = JSON.parse(event.data);
                this.handleWebSocketMessage(msg);
            } catch (error) {
                console.error('WebSocketManager: 解析 WebSocket 消息失败:', error);
            }
        };

        this.ws.addEventListener('message', this.messageHandler);
    }

    /**
     * 处理 WebSocket 消息
     */
    private handleWebSocketMessage(msg: any): void {
        // 处理 transactions 命令
        if (msg.cmd === 'transactions') {
            this.handleTransactionMessage(msg);
        }

        // 处理活跃的监听器
        this.processActiveListeners(msg);
    }

    /**
     * 处理 transaction 消息
     */
    private async handleTransactionMessage(msg: any): Promise<void> {
        try {
            // 检查是否启用了实时更新
            const settings = this.settingsManager.getSettings();
            if (!settings.realTimeUpdate) return;

            // 分析 transaction 事件
            const analysisResult = TransactionAnalyzer.analyzeTransactionEvent(msg);

            // 如果没有需要更新的内容，直接返回
            if (!TransactionAnalyzer.needsUpdate(analysisResult)) {
                return;
            }

            // 检查变更是否影响当前文档
            const isCurrentDocAffected = this.documentManager.isCurrentDocumentAffected(msg);
            if (!isCurrentDocAffected) return;

            // 获取当前聚焦的文档ID
            const currentDocId = this.documentManager.getCurrentDocId();
            if (!currentDocId) return;

            // 检查当前文档是否启用了编号
            if (!this.settingsManager.isDocumentEnabled(currentDocId)) return;

            if (isCurrentDocAffected) {
                // 如果有标题变更，直接重新获取 Outline 并渲染
                if (analysisResult.needUpdateHeadings) {
                    this.debouncedUpdateHeadings(currentDocId);
                }

                // 如果有图片表格变更，更新索引
                if (analysisResult.needUpdateFigures && settings.crossReference) {
                    this.debouncedUpdateFigures(currentDocId);
                }
            }

            // 调试信息
            if (process.env.NODE_ENV === 'development') {
                console.log('WebSocketManager: Transaction分析结果:', {
                    currentDocId,
                    isCurrentDocAffected,
                    needUpdateHeadings: analysisResult.needUpdateHeadings,
                    needUpdateFigures: analysisResult.needUpdateFigures,
                    changeTypes: analysisResult.changeTypes
                });
            }
        } catch (error) {
            console.error('WebSocketManager: 处理 transaction 消息失败:', error);
        }
    }

    /**
     * 处理活跃的监听器
     */
    private processActiveListeners(msg: any): void {
        for (const [id, listener] of this.activeListeners) {
            try {
                // 如果有过滤器，检查消息是否匹配
                if (listener.filter && !listener.filter(msg)) {
                    continue;
                }

                // 清理超时定时器
                if (listener.timeout) {
                    clearTimeout(listener.timeout);
                }

                // 解析监听器
                listener.resolve(msg);
                this.activeListeners.delete(id);
            } catch (error) {
                console.error(`WebSocketManager: 处理监听器 ${id} 失败:`, error);
                listener.reject(error);
                this.activeListeners.delete(id);
            }
        }
    }

    /**
     * 当块被保存时执行回调（仅执行一次）
     * @param filter 过滤器函数
     * @param timeout 超时时间（毫秒）
     * @returns Promise
     */
    public whenBlockSaved(filter?: IWebSocketFilter, timeout: number = 10000): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                reject(new Error('WebSocket 未连接'));
                return;
            }

            const listenerId = `block-saved-${Date.now()}-${Math.random()}`;
            
            // 设置超时
            const timeoutHandle = setTimeout(() => {
                this.activeListeners.delete(listenerId);
                reject(new Error('等待块保存超时'));
            }, timeout);

            // 默认过滤器：监听 transactions 命令
            const defaultFilter: IWebSocketFilter = (msg) => msg.cmd === 'transactions';
            const actualFilter = filter || defaultFilter;

            this.activeListeners.set(listenerId, {
                resolve,
                reject,
                filter: actualFilter,
                timeout: timeoutHandle
            });
        });
    }

    /**
     * 监听特定的 WebSocket 事件
     * @param options 监听器选项
     * @returns Promise
     */
    public listen(options: IWebSocketListenerOptions = {}): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                reject(new Error('WebSocket 未连接'));
                return;
            }

            const listenerId = `listener-${Date.now()}-${Math.random()}`;
            
            // 设置超时
            let timeoutHandle: NodeJS.Timeout | undefined;
            if (options.timeout) {
                timeoutHandle = setTimeout(() => {
                    this.activeListeners.delete(listenerId);
                    reject(new Error('监听超时'));
                }, options.timeout);
            }

            this.activeListeners.set(listenerId, {
                resolve,
                reject,
                filter: options.filter,
                timeout: timeoutHandle
            });
        });
    }

    /**
     * 清除所有活跃的监听器
     */
    private clearAllListeners(): void {
        for (const [id, listener] of this.activeListeners) {
            if (listener.timeout) {
                clearTimeout(listener.timeout);
            }
            listener.reject(new Error('WebSocketManager 已销毁'));
        }
        this.activeListeners.clear();
    }



    /**
     * 更新指定文档的标题编号
     * @param docId 文档ID
     */
    private async updateHeadingsForDoc(docId: string): Promise<void> {
        try {
            await this.headingNumbering.updateNumberingForDoc(docId);
        } catch (error) {
            console.error(`WebSocketManager: 更新文档${docId}的标题编号失败:`, error);
        }
    }

    /**
     * 更新指定文档的图片表格索引
     * @param docId 文档ID
     */
    private async updateFiguresForDoc(docId: string): Promise<void> {
        try {
            // 这里将在更新交叉引用功能时实现
            console.log(`WebSocketManager: 更新文档${docId}的图片表格索引`);
        } catch (error) {
            console.error(`WebSocketManager: 更新文档${docId}的图片表格索引失败:`, error);
        }
    }

    /**
     * 检查 WebSocket 连接状态
     */
    public isWebSocketConnected(): boolean {
        return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
    }

    /**
     * 获取活跃监听器数量
     */
    public getActiveListenerCount(): number {
        return this.activeListeners.size;
    }
}

/**
 * 事件处理器
 * 负责处理插件的各种事件
 */

import { Plugin } from "../../../index";
import { IEventHandler } from "../types";
import { SettingsManager } from "../core/SettingsManager";
import { DocumentManager } from "../core/DocumentManager";
import { HeadingNumbering } from "../core/HeadingNumbering";
import { CrossReference } from "../core/CrossReference";
import { DockPanel } from "./DockPanel";
import { TransactionAnalyzer } from "../utils/transactionAnalyzer";
import { debounce } from "../utils/domUtils";

export class EventHandler implements IEventHandler {
    private plugin: Plugin;
    private settingsManager: SettingsManager;
    private documentManager: DocumentManager;
    private headingNumbering: HeadingNumbering;
    private crossReference: CrossReference;
    private dockPanel: DockPanel;

    // 事件监听器引用，用于清理
    private eventListeners: Map<string, Function> = new Map();

    // 防抖更新函数
    private debouncedUpdateHeadings = debounce(this.updateHeadingsForDoc.bind(this), 1000);
    private debouncedUpdateFigures = debounce(this.updateFiguresForDoc.bind(this), 1000);

    constructor(
        plugin: Plugin,
        settingsManager: SettingsManager,
        documentManager: DocumentManager,
        headingNumbering: HeadingNumbering,
        crossReference: CrossReference,
        dockPanel: DockPanel
    ) {
        this.plugin = plugin;
        this.settingsManager = settingsManager;
        this.documentManager = documentManager;
        this.headingNumbering = headingNumbering;
        this.crossReference = crossReference;
        this.dockPanel = dockPanel;
    }

    async init(): Promise<void> {
        this.bindEvents();
    }

    destroy(): void {
        this.unbindEvents();
    }

    bindEvents(): void {
        // 文档切换事件
        const onDocumentSwitch = this.onDocumentSwitch.bind(this);
        this.plugin.eventBus.on("switch-protyle", onDocumentSwitch);
        this.eventListeners.set("switch-protyle", onDocumentSwitch);

        // 文档加载事件
        const onDocumentLoaded = this.onDocumentLoaded.bind(this);
        this.plugin.eventBus.on("loaded-protyle-static", onDocumentLoaded);
        this.eventListeners.set("loaded-protyle-static", onDocumentLoaded);

        // 文档关闭事件
        const onDocumentClosed = this.onDocumentClosed.bind(this);
        this.plugin.eventBus.on("destroy-protyle", onDocumentClosed);
        this.eventListeners.set("destroy-protyle", onDocumentClosed);

        // 编辑事件（实时更新）
        const settings = this.settingsManager.getSettings();
        if (settings.realTimeUpdate) {
            this.enableRealTimeUpdate();
        }

        // 设置变更事件
        const onSettingsChanged = this.onSettingsChanged.bind(this);
        document.addEventListener('document-styler-settings-changed', onSettingsChanged);
        this.eventListeners.set('document-styler-settings-changed', onSettingsChanged);
    }

    unbindEvents(): void {
        // 移除所有事件监听器
        for (const [eventName, listener] of this.eventListeners) {
            if (eventName.startsWith('document-styler-')) {
                document.removeEventListener(eventName, listener as EventListener);
            } else {
                this.plugin.eventBus.off(eventName, listener);
            }
        }
        this.eventListeners.clear();

        // 禁用实时更新
        this.disableRealTimeUpdate();
    }

    /**
     * 文档切换事件处理
     */
    private async onDocumentSwitch(event: CustomEvent): Promise<void> {
        try {
            const protyle = event.detail?.protyle;
            if (!protyle?.block?.rootID) return;

            const newDocId = protyle.block.rootID;
            const currentDocId = this.documentManager.getCurrentDocId();

            // 检查是否是同一个文档，如果是则不需要更新
            if (currentDocId === newDocId) {
                return;
            }

            // 更新文档管理器
            this.documentManager.updateCurrentDocument(protyle);

            // 清除当前文档的样式
            await this.clearCurrentDocumentStyles();

            // 更新面板
            this.dockPanel.updatePanel();

            // 应用新文档的设置
            await this.applyDocumentSettings();
        } catch (error) {
            console.error('处理文档切换事件失败:', error);
        }
    }

    /**
     * 文档加载事件处理
     */
    private async onDocumentLoaded(event: CustomEvent): Promise<void> {
        try {
            const protyle = event.detail?.protyle;
            if (!protyle?.block?.rootID) return;

            // 更新文档管理器
            this.documentManager.updateCurrentDocument(protyle);

            // 清除当前文档的样式
            await this.clearCurrentDocumentStyles();

            // 更新面板
            this.dockPanel.updatePanel();

            // 应用新文档的设置
            await this.applyDocumentSettings();
        } catch (error) {
            console.error('处理文档加载事件失败:', error);
        }
    }

    /**
     * 文档关闭事件处理
     */
    private onDocumentClosed(event: CustomEvent): void {
        try {
            // 清理当前文档状态
            this.documentManager.updateCurrentDocument(null);
            
            // 更新面板
            this.dockPanel.updatePanel();
        } catch (error) {
            console.error('处理文档关闭事件失败:', error);
        }
    }

    /**
     * 编辑事件处理（实时更新）
     * 注意：现在实时更新由 WebSocketManager 处理，这里保留作为备用
     */
    private onEdited = async (event: CustomEvent): Promise<void> => {
        try {
            // 检查是否启用了实时更新
            const settings = this.settingsManager.getSettings();
            if (!settings.realTimeUpdate) return;

            // 分析transaction事件
            const analysisResult = TransactionAnalyzer.analyzeTransactionEvent(event.detail);

            // 如果没有需要更新的内容，直接返回
            if (!TransactionAnalyzer.needsUpdate(analysisResult)) {
                return;
            }

            // 获取受影响的文档
            const affectedDocIds = TransactionAnalyzer.getAffectedDocuments(analysisResult);

            // 处理每个受影响的文档
            for (const docId of affectedDocIds) {
                // 检查文档是否启用了编号
                if (!this.settingsManager.isDocumentEnabled(docId)) continue;

                // 根据分析结果决定更新内容
                if (analysisResult.needUpdateHeadings) {
                    this.debouncedUpdateHeadings(docId);
                }

                if (analysisResult.needUpdateFigures && settings.crossReference) {
                    this.debouncedUpdateFigures(docId);
                }
            }

            // 调试信息
            if (process.env.NODE_ENV === 'development') {
                console.log('EventHandler: Transaction分析结果:', TransactionAnalyzer.createDebugInfo(analysisResult));
            }
        } catch (error) {
            console.error('EventHandler: 处理编辑事件失败:', error);
        }
    };

    /**
     * 设置变更事件处理
     */
    private async onSettingsChanged(event: CustomEvent): Promise<void> {
        try {
            const { key, value } = event.detail;

            switch (key) {
                case 'headingNumbering':
                    await this.handleHeadingNumberingChange(value);
                    break;
                case 'crossReference':
                    await this.handleCrossReferenceChange(value);
                    break;
                case 'realTimeUpdate':
                    this.handleRealTimeUpdateChange(value);
                    break;
                case 'numberingFormats':
                case 'useChineseNumbers':
                    await this.handleNumberingFormatChange();
                    break;
            }
        } catch (error) {
            console.error('处理设置变更事件失败:', error);
        }
    }

    /**
     * 处理标题编号设置变更
     */
    private async handleHeadingNumberingChange(enabled: boolean): Promise<void> {
        const protyle = this.documentManager.getCurrentProtyle();
        if (!protyle) return;

        if (enabled) {
            await this.headingNumbering.applyNumbering(protyle);
        } else {
            await this.headingNumbering.clearNumbering(protyle);
        }
    }

    /**
     * 处理交叉引用设置变更
     */
    private async handleCrossReferenceChange(enabled: boolean): Promise<void> {
        const protyle = this.documentManager.getCurrentProtyle();
        if (!protyle) return;

        if (enabled) {
            await this.crossReference.applyCrossReference(protyle);
        } else {
            await this.crossReference.clearCrossReference(protyle);
        }

        // 更新面板中的图片表格列表
        this.dockPanel.updatePanel();
    }

    /**
     * 处理实时更新设置变更
     */
    private handleRealTimeUpdateChange(enabled: boolean): void {
        if (enabled) {
            this.enableRealTimeUpdate();
        } else {
            this.disableRealTimeUpdate();
        }
    }

    /**
     * 处理编号格式变更
     */
    private async handleNumberingFormatChange(): Promise<void> {
        const settings = this.settingsManager.getSettings();
        if (!settings.headingNumbering) return;

        const protyle = this.documentManager.getCurrentProtyle();
        if (!protyle) return;

        // 重新应用编号
        await this.headingNumbering.updateNumbering(protyle);
    }

    /**
     * 启用实时更新
     * 注意：现在实时更新由 WebSocketManager 处理，这里保留作为备用
     */
    private enableRealTimeUpdate(): void {
        // 实时更新现在由 WebSocketManager 处理
        // 这里保留旧的事件监听作为备用
        if (!this.eventListeners.has('ws-main')) {
            // this.plugin.eventBus.on("ws-main", this.onEdited);
            // this.eventListeners.set('ws-main', this.onEdited);
        }
    }

    /**
     * 禁用实时更新
     * 注意：现在实时更新由 WebSocketManager 处理，这里保留作为备用
     */
    private disableRealTimeUpdate(): void {
        // 实时更新现在由 WebSocketManager 处理
        // 这里保留旧的事件监听清理作为备用
        if (this.eventListeners.has('ws-main')) {
            // this.plugin.eventBus.off("ws-main", this.onEdited);
            // this.eventListeners.delete('ws-main');
        }

        // 禁用标题编号的实时更新
        this.headingNumbering.disableRealTimeUpdate();
    }

    /**
     * 清除当前文档的样式
     */
    private async clearCurrentDocumentStyles(): Promise<void> {
        const protyle = this.documentManager.getCurrentProtyle();
        if (!protyle) return;

        try {
            // 清除标题编号
            await this.headingNumbering.clearNumbering(protyle);
            
            // 清除交叉引用
            await this.crossReference.clearCrossReference(protyle);
        } catch (error) {
            console.error('清除文档样式失败:', error);
        }
    }

    /**
     * 应用文档设置
     */
    private async applyDocumentSettings(): Promise<void> {
        const docId = this.documentManager.getCurrentDocId();
        const protyle = this.documentManager.getCurrentProtyle();
        
        if (!docId || !protyle) return;

        try {
            const settings = this.settingsManager.getSettings();
            const isEnabled = this.settingsManager.isDocumentEnabled(docId);

            if (isEnabled) {
                // 应用标题编号
                if (settings.headingNumbering) {
                    await this.headingNumbering.applyNumbering(protyle);
                }

                // 应用交叉引用
                if (settings.crossReference) {
                    await this.crossReference.applyCrossReference(protyle);
                }
            }
        } catch (error) {
            console.error('应用文档设置失败:', error);
        }
    }

    /**
     * 获取事件监听器数量（用于调试）
     */
    getEventListenerCount(): number {
        return this.eventListeners.size;
    }

    /**
     * 检查特定事件是否已绑定
     */
    isEventBound(eventName: string): boolean {
        return this.eventListeners.has(eventName);
    }

    /**
     * 更新指定文档的标题编号
     * @param docId 文档ID
     */
    private async updateHeadingsForDoc(docId: string): Promise<void> {
        try {
            // 使用新的架构更新标题编号
            await this.headingNumbering.updateNumberingForDoc(docId);
        } catch (error) {
            console.error(`更新文档${docId}的标题编号失败:`, error);
        }
    }

    /**
     * 更新指定文档的图片表格索引
     * @param docId 文档ID
     */
    private async updateFiguresForDoc(docId: string): Promise<void> {
        try {
            // 这里将在更新交叉引用功能时实现
            // 暂时使用旧的方法
            const currentDocId = this.documentManager.getCurrentDocId();
            if (currentDocId === docId) {
                const protyle = this.documentManager.getCurrentProtyle();
                if (protyle) {
                    await this.crossReference.applyCrossReference(protyle);
                }
            }
        } catch (error) {
            console.error(`更新文档${docId}的图片表格索引失败:`, error);
        }
    }
}

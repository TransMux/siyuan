import { Plugin } from "../../index";
import { App } from "../../../index";
import { Custom } from "../../../layout/dock/Custom";

// 导入核心组件
import { SettingsManager } from "./core/SettingsManager";
import { DocumentManager } from "./core/DocumentManager";
import { HeadingNumbering } from "./core/HeadingNumbering";
import { CrossReference } from "./core/CrossReference";
import { DockPanel } from "./ui/DockPanel";
import { StyleManager } from "./ui/StyleManager";
import { IPluginOptions, IDocumentStylerSettings, IDocumentInfo } from "./types";

/**
 * Built-in plugin: Document Styler
 * 提供文档样式设置的侧边栏面板，包括：
 * - 标题自动编号与高级格式化选项
 * - 图片/表格交叉引用与标题标签
 * - 实时更新与可自定义编号格式
 */
export class DocumentStylerPlugin extends Plugin {
    private appRef: App;

    // 核心组件 - 简化架构，只保留必要的模块
    private settingsManager: SettingsManager;
    private documentManager: DocumentManager;
    private headingNumbering: HeadingNumbering;
    private crossReference: CrossReference;
    private styleManager: StyleManager;
    private dockPanel: DockPanel;

    // 事件监听器管理
    private eventListeners: Map<string, Function> = new Map();
    private currentDocId: string | null = null;

    // 防重复处理
    private lastSwitchTime = 0;
    private switchDebounceDelay = 300; // 300ms防抖

    constructor(options: IPluginOptions) {
        super(options);
        this.appRef = options.app;

        // 将插件实例暴露到全局，供HTML onclick使用
        (window as any).documentStylerPlugin = this;

        // 初始化核心组件 - 简化依赖关系
        this.initializeComponents();
    }

    /**
     * 初始化核心组件
     */
    private initializeComponents(): void {
        // 按依赖顺序创建组件
        this.settingsManager = new SettingsManager(this);
        this.documentManager = new DocumentManager(this.appRef);
        this.styleManager = new StyleManager();

        // 功能组件
        this.headingNumbering = new HeadingNumbering(
            this.settingsManager,
            this.documentManager,
            this.styleManager
        );
        this.crossReference = new CrossReference(this.documentManager);
        this.crossReference.setSettingsManager(this.settingsManager);

        // UI组件
        this.dockPanel = new DockPanel(
            this.settingsManager,
            this.documentManager,
            this.crossReference,
            this
        );

        // 设置交叉引用的面板更新回调
        this.crossReference.setPanelUpdateCallback(async () => {
            await this.dockPanel.updatePanel();
        });
    }

    /**
     * 插件加载时调用
     */
    async onload(): Promise<void> {
        try {
            // 初始化所有组件
            await this.initializeAllComponents();

            // 绑定事件监听器
            this.bindEvents();

            // 注册侧边栏面板
            this.registerDockPanel();

            console.log('DocumentStyler plugin loaded successfully');
        } catch (error) {
            console.error('DocumentStyler plugin failed to load:', error);
        }
    }

    /**
     * 插件卸载时调用
     */
    async onunload(): Promise<void> {
        try {
            // 解绑事件监听器
            this.unbindEvents();

            // 销毁所有组件
            this.destroyAllComponents();

            // 清理全局引用
            delete (window as any).documentStylerPlugin;

            console.log('DocumentStyler plugin unloaded successfully');
        } catch (error) {
            console.error('DocumentStyler plugin failed to unload:', error);
        }
    }

    /**
     * 初始化所有组件
     */
    private async initializeAllComponents(): Promise<void> {
        // 按依赖顺序初始化组件
        await this.settingsManager.init();
        await this.documentManager.init();
        await this.styleManager.init();
        await this.headingNumbering.init();
        await this.crossReference.init();
        await this.dockPanel.init();
    }

    /**
     * 销毁所有组件
     */
    private destroyAllComponents(): void {
        // 按相反顺序销毁组件
        this.dockPanel?.destroy();
        this.crossReference?.destroy();
        this.headingNumbering?.destroy();
        this.styleManager?.destroy();
        this.documentManager?.destroy();
        this.settingsManager?.destroy();
    }

    /**
     * 绑定事件监听器 - 合并EventHandler的功能
     */
    private bindEvents(): void {
        // 文档切换事件
        const onDocumentSwitch = this.onDocumentSwitch.bind(this);
        this.eventBus.on("switch-protyle", onDocumentSwitch);
        this.eventListeners.set("switch-protyle", onDocumentSwitch);

        // 文档加载事件
        const onDocumentLoaded = this.onDocumentLoaded.bind(this);
        this.eventBus.on("loaded-protyle-static", onDocumentLoaded);
        this.eventListeners.set("loaded-protyle-static", onDocumentLoaded);

        // WebSocket 事件监听 - 简化版本
        this.setupWebSocketListener();
    }

    /**
     * 解绑事件监听器
     */
    private unbindEvents(): void {
        // 移除所有事件监听器
        for (const [eventName, listener] of this.eventListeners) {
            this.eventBus.off(eventName as any, listener as any);
        }
        this.eventListeners.clear();
    }

    /**
     * 设置WebSocket监听器 - 简化版本，只监听必要事件
     */
    private setupWebSocketListener(): void {
        if (window.siyuan?.ws?.ws) {
            const originalOnMessage = window.siyuan.ws.ws.onmessage;
            window.siyuan.ws.ws.onmessage = (event) => {
                // 先调用原始处理器
                if (originalOnMessage) {
                    originalOnMessage.call(window.siyuan.ws.ws, event);
                }

                // 处理我们关心的事件
                this.handleWebSocketMessage(event);
            };
        }
    }

    /**
     * 文档切换事件处理
     */
    private async onDocumentSwitch(event: CustomEvent): Promise<void> {
        try {
            const protyle = event.detail?.protyle;
            if (!protyle?.block?.rootID) return;

            const newDocId = protyle.block.rootID;
            const now = Date.now();

            // 检查是否是同一个文档
            if (this.currentDocId === newDocId) return;

            // 立即更新文档ID，确保后续操作使用正确的ID
            this.currentDocId = newDocId;
            this.documentManager.updateCurrentDocument(protyle);

            // 防抖处理，避免短时间内重复的完整处理流程
            if (now - this.lastSwitchTime < this.switchDebounceDelay) {
                console.log(`DocumentStyler: 快速切换到文档 ${newDocId}，仅更新ID，跳过完整处理`);
                // 仍然需要更新面板以显示正确的文档信息
                await this.dockPanel.updatePanel();
                return;
            }

            this.lastSwitchTime = now;
            console.log(`DocumentStyler: 完整处理文档切换到 ${newDocId}`);

            // 更新面板
            await this.dockPanel.updatePanel();

            // 应用当前文档的设置
            await this.applyCurrentDocumentSettings();
        } catch (error) {
            console.error('DocumentStyler: 文档切换处理失败:', error);
        }
    }

    /**
     * 文档加载事件处理
     */
    private async onDocumentLoaded(event: CustomEvent): Promise<void> {
        try {
            const protyle = event.detail?.protyle;
            if (!protyle?.block?.rootID) return;

            const docId = protyle.block.rootID;
            this.currentDocId = docId;
            this.documentManager.updateCurrentDocument(protyle);

            // 应用当前文档的设置
            await this.applyCurrentDocumentSettings();
        } catch (error) {
            console.error('DocumentStyler: 文档加载处理失败:', error);
        }
    }

    /**
     * WebSocket消息处理 - 智能版本，使用组件的专门处理器
     */
    private async handleWebSocketMessage(event: MessageEvent): Promise<void> {
        try {
            const data = JSON.parse(event.data);

            // 只处理transactions事件，用于实时更新
            if (data.cmd === 'transactions' && this.currentDocId) {
                // 使用组件的专门处理器进行更精细的分析
                await this.headingNumbering.handleTransactionMessage(data);
                await this.crossReference.handleTransactionMessage(data);
            }
        } catch (error) {
            // 忽略解析错误，不是所有WebSocket消息都是JSON
        }
    }



    /**
     * 应用当前文档的设置
     */
    private async applyCurrentDocumentSettings(): Promise<void> {
        if (!this.currentDocId) return;

        try {
            const docSettings = await this.settingsManager.getDocumentSettings(this.currentDocId);

            // 应用标题编号
            if (docSettings.headingNumberingEnabled) {
                await this.headingNumbering.updateNumberingForDoc(this.currentDocId);
            } else {
                await this.headingNumbering.clearNumbering(null);
            }

            // 应用交叉引用
            if (docSettings.crossReferenceEnabled) {
                const protyle = this.documentManager.getCurrentProtyle();
                if (protyle) {
                    await this.crossReference.applyCrossReference(protyle);
                }
            } else {
                const protyle = this.documentManager.getCurrentProtyle();
                if (protyle) {
                    await this.crossReference.clearCrossReference(protyle);
                }
            }
        } catch (error) {
            console.error('DocumentStyler: 应用文档设置失败:', error);
        }
    }

    /**
     * 注册侧边栏面板
     */
    private registerDockPanel(): void {
        this.addDock({
            config: {
                position: "RightTop",
                size: { width: 320, height: 450 },
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
    }

    /**
     * 初始化侧边栏面板
     */
    private async initDockPanel(custom: Custom): Promise<void> {
        await this.dockPanel.initPanel(custom);
    }

    /**
     * 更新侧边栏面板
     */
    private async updateDockPanel(): Promise<void> {
        await this.dockPanel.updatePanel();
    }

    /**
     * 销毁侧边栏面板
     */
    private destroyDockPanel(): void {
        // 面板销毁逻辑由 dockPanel 模块处理
    }

    // ==================== 公共方法 ====================

    /**
     * 滚动到指定图片/表格（供HTML onclick调用）
     * @param figureId 图片/表格ID
     */
    public scrollToFigure(figureId: string): void {
        this.crossReference.scrollToFigure(figureId);
    }

    /**
     * 切换当前文档的标题编号状态
     */
    public async toggleHeadingNumbering(): Promise<void> {
        const docId = this.documentManager.getCurrentDocId();
        if (!docId) return;

        try {
            const currentEnabled = await this.settingsManager.isDocumentHeadingNumberingEnabled(docId);

            if (currentEnabled) {
                // 关闭编号
                await this.headingNumbering.clearNumbering(null);
                await this.settingsManager.setDocumentHeadingNumberingEnabled(docId, false);
            } else {
                // 开启编号
                await this.headingNumbering.updateNumberingForDoc(docId);
                await this.settingsManager.setDocumentHeadingNumberingEnabled(docId, true);
            }

            // 更新面板
            this.dockPanel.updatePanel();
        } catch (error) {
            console.error('切换标题编号失败:', error);
        }
    }

    /**
     * 切换当前文档的交叉引用状态
     */
    public async toggleCrossReference(): Promise<void> {
        const settings = this.settingsManager.getSettings();
        const protyle = this.documentManager.getCurrentProtyle();

        if (!protyle) return;

        try {
            if (settings.crossReference) {
                await this.crossReference.clearCrossReference(protyle);
                await this.settingsManager.updateSettings({ crossReference: false });
            } else {
                await this.crossReference.applyCrossReference(protyle);
                await this.settingsManager.updateSettings({ crossReference: true });
            }

            // 更新面板
            this.dockPanel.updatePanel();
        } catch (error) {
            console.error('切换交叉引用失败:', error);
        }
    }

    /**
     * 获取当前设置
     */
    public getSettings(): IDocumentStylerSettings {
        return this.settingsManager.getSettings();
    }

    /**
     * 获取当前文档的编号启用状态
     */
    public async getCurrentDocumentNumberingStatus(): Promise<{
        headingNumbering: boolean;
        crossReference: boolean;
    }> {
        const docId = this.documentManager.getCurrentDocId();
        if (!docId) {
            return {
                headingNumbering: false,
                crossReference: false
            };
        }

        try {
            const headingNumbering = await this.settingsManager.isDocumentHeadingNumberingEnabled(docId);
            const crossReference = await this.settingsManager.isDocumentCrossReferenceEnabled(docId);

            return {
                headingNumbering,
                crossReference
            };
        } catch (error) {
            console.error('获取文档编号状态失败:', error);
            return {
                headingNumbering: false,
                crossReference: false
            };
        }
    }

    /**
     * 更新设置
     */
    public async updateSettings(settings: Partial<IDocumentStylerSettings>): Promise<void> {
        await this.settingsManager.updateSettings(settings);
        this.dockPanel.updatePanel();
    }

    /**
     * 获取当前文档信息
     */
    public async getCurrentDocumentInfo(): Promise<IDocumentInfo | null> {
        const docId = this.documentManager.getCurrentDocId();
        if (!docId) return null;
        return await this.documentManager.getDocumentInfo(docId);
    }

    /**
     * 应用标题编号（供DockPanel调用）
     */
    public async applyHeadingNumbering(): Promise<void> {
        const docId = this.documentManager.getCurrentDocId();
        if (!docId) return;

        try {
            console.log('DocumentStyler: 开始应用标题编号');
            
            // 获取文档设置
            const docSettings = await this.settingsManager.getDocumentSettings(docId);
            console.log('DocumentStyler: 文档设置获取成功', docSettings);
            
            // 使用文档的设置更新编号
            await this.headingNumbering.updateNumberingForDoc(docId);
            console.log('DocumentStyler: 标题编号应用完成');
        } catch (error) {
            console.error('应用标题编号失败:', error);
        }
    }

    /**
     * 清除标题编号（供DockPanel调用）
     */
    public async clearHeadingNumbering(): Promise<void> {
        try {
            await this.headingNumbering.clearNumbering(null);
        } catch (error) {
            console.error('清除标题编号失败:', error);
        }
    }

    /**
     * 应用交叉引用（供DockPanel调用）
     */
    public async applyCrossReference(): Promise<void> {
        const protyle = this.documentManager.getCurrentProtyle();
        if (!protyle) return;

        try {
            await this.crossReference.applyCrossReference(protyle);
        } catch (error) {
            console.error('应用交叉引用失败:', error);
        }
    }

    /**
     * 清除交叉引用（供DockPanel调用）
     */
    public async clearCrossReference(): Promise<void> {
        const protyle = this.documentManager.getCurrentProtyle();
        if (!protyle) return;

        try {
            await this.crossReference.clearCrossReference(protyle);
        } catch (error) {
            console.error('清除交叉引用失败:', error);
        }
    }

}

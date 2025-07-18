import { Plugin } from "../../index";
import { App } from "../../../index";
import { Custom } from "../../../layout/dock/Custom";

// 导入模块化组件
import { HeadingNumbering } from "./core/HeadingNumbering";
import { CrossReference } from "./core/CrossReference";
import { DocumentManager } from "./core/DocumentManager";
import { SettingsManager } from "./core/SettingsManager";
import { OutlineManager } from "./core/OutlineManager";
import { WebSocketManager } from "./core/WebSocketManager";
import { DockPanel } from "./ui/DockPanel";
import { StyleManager } from "./ui/StyleManager";
import { EventHandler } from "./ui/EventHandler";
import { IPluginOptions, IDocumentStylerSettings, IDocumentInfo } from "./types";

/**
 * Built-in plugin: Document Styler
 * Provides a sidebar panel for setting document element styles including:
 * - Heading auto-numbering with advanced formatting options
 * - Image/table cross-references with captions and labels
 * - Cross-reference selection with @ trigger
 * - Real-time updating and customizable numbering formats
 */
export class DocumentStylerPlugin extends Plugin {
    private appRef: App;

    // 模块化组件
    private settingsManager: SettingsManager;
    private documentManager: DocumentManager;
    private outlineManager: OutlineManager;
    private webSocketManager: WebSocketManager;
    private headingNumbering: HeadingNumbering;
    private crossReference: CrossReference;
    private styleManager: StyleManager;
    private dockPanel: DockPanel;
    private eventHandler: EventHandler;

    constructor(options: IPluginOptions) {
        super(options);
        this.appRef = options.app;

        // 将插件实例暴露到全局，供HTML onclick使用
        (window as any).documentStylerPlugin = this;

        // 初始化模块化组件
        this.initializeModules();
    }

    /**
     * 初始化模块化组件
     */
    private initializeModules(): void {
        // 创建核心模块
        this.settingsManager = new SettingsManager(this);
        this.documentManager = new DocumentManager(this.appRef);
        this.outlineManager = new OutlineManager();
        this.styleManager = new StyleManager();
        this.headingNumbering = new HeadingNumbering(
            this.settingsManager,
            this.documentManager,
            this.outlineManager,
            this.styleManager
        );
        this.crossReference = new CrossReference(this.documentManager);
        this.webSocketManager = new WebSocketManager(
            this.settingsManager,
            this.headingNumbering,
            this.crossReference
        );

        // 创建UI模块
        this.dockPanel = new DockPanel(this.settingsManager, this.documentManager, this.crossReference);
        this.eventHandler = new EventHandler(
            this,
            this.settingsManager,
            this.documentManager,
            this.headingNumbering,
            this.crossReference,
            this.dockPanel
        );
    }

    /**
     * 插件加载时调用
     */
    async onload(): Promise<void> {
        try {
            // 初始化所有模块
            await this.initializeAllModules();

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
            // 销毁所有模块
            this.destroyAllModules();

            // 清理全局引用
            delete (window as any).documentStylerPlugin;

            console.log('DocumentStyler plugin unloaded successfully');
        } catch (error) {
            console.error('DocumentStyler plugin failed to unload:', error);
        }
    }

    /**
     * 初始化所有模块
     */
    private async initializeAllModules(): Promise<void> {
        // 按依赖顺序初始化模块
        await this.settingsManager.init();
        await this.documentManager.init();
        await this.outlineManager.init();
        await this.styleManager.init();
        await this.headingNumbering.init();
        await this.crossReference.init();
        await this.webSocketManager.init();
        await this.dockPanel.init();
        await this.eventHandler.init();
    }

    /**
     * 销毁所有模块
     */
    private destroyAllModules(): void {
        // 按相反顺序销毁模块
        this.eventHandler?.destroy();
        this.dockPanel?.destroy();
        this.webSocketManager?.destroy();
        this.crossReference?.destroy();
        this.headingNumbering?.destroy();
        this.styleManager?.destroy();
        this.outlineManager?.destroy();
        this.documentManager?.destroy();
        this.settingsManager?.destroy();
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
            // 获取文档设置
            const docSettings = await this.settingsManager.getDocumentSettings(docId);
            
            // 使用文档的设置更新编号
            await this.headingNumbering.updateNumberingForDoc(docId);
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

/**
 * 标题自动编号系统
 * 基于 siyuan-auto-seq-number 插件的设计思路重新实现
 */

import { IHeadingNumbering, IHeadingInfo } from "../types";
import { SettingsManager } from "./SettingsManager";
import { DocumentManager } from "./DocumentManager";
import { 
    generateHeaderNumber, 
    hasHeaderNumber, 
    removeHeaderNumber, 
    getHeaderLevel,
    getExistingHeaderLevels
} from "../utils/numberUtils";
import { 
    getHeaderElements, 
    getHtmlContent, 
    setHtmlContent,
    setCursorToEnd,
    debounce
} from "../utils/domUtils";
import { batchUpdateBlockContent, getVersion } from "../utils/apiUtils";

export class HeadingNumbering implements IHeadingNumbering {
    private settingsManager: SettingsManager;
    private documentManager: DocumentManager;
    private version: string = "";
    private updateTimer: number | null = null;
    private lastInputTime: number = 0;
    private shouldUpdate: boolean = false;
    private activeBlockId: string | null = null;

    // 防抖更新函数
    private debouncedUpdate = debounce(this.performUpdate.bind(this), 2000);

    constructor(settingsManager: SettingsManager, documentManager: DocumentManager) {
        this.settingsManager = settingsManager;
        this.documentManager = documentManager;
    }

    async init(): Promise<void> {
        this.version = await getVersion();
    }

    destroy(): void {
        this.clearUpdateTimer();
        this.shouldUpdate = false;
        this.activeBlockId = null;
    }

    async applyNumbering(protyle: any): Promise<void> {
        const docId = this.documentManager.getCurrentDocId();
        if (!docId || !protyle) return;

        try {
            // 先清除现有编号
            await this.clearNumbering(protyle);
            
            // 应用新编号
            await this.updateNumbering(protyle);
        } catch (error) {
            console.error('应用标题编号失败:', error);
            throw error;
        }
    }

    async clearNumbering(protyle: any): Promise<void> {
        if (!protyle) return;

        try {
            const headerElements = getHeaderElements(protyle);
            if (headerElements.length === 0) return;

            const updates: Record<string, string> = {};
            const settings = this.settingsManager.getSettings();

            // 处理每个标题
            for (const element of headerElements) {
                const blockId = element.getAttribute("data-node-id");
                if (!blockId) continue;

                const htmlContent = getHtmlContent(element);
                if (!htmlContent) continue;

                // 检查所有可能的格式并移除编号
                let contentUpdated = false;
                let cleanContent = htmlContent;

                for (let i = 0; i < settings.numberingFormats.length; i++) {
                    const format = settings.numberingFormats[i];
                    if (hasHeaderNumber(cleanContent, format)) {
                        cleanContent = removeHeaderNumber(cleanContent, format);
                        contentUpdated = true;
                    }
                }

                // 如果内容被更新，则添加到更新列表中
                if (contentUpdated) {
                    setHtmlContent(element, cleanContent);
                    updates[blockId] = element.outerHTML;
                }
            }

            // 批量更新内容
            if (Object.keys(updates).length > 0) {
                await batchUpdateBlockContent(updates, "dom", this.canUseBulkApi());
            }
        } catch (error) {
            console.error('清除标题编号失败:', error);
            throw error;
        }
    }

    async updateNumbering(protyle: any): Promise<void> {
        if (!protyle) return;

        this.clearUpdateTimer();

        try {
            const headerElements = getHeaderElements(protyle);
            if (headerElements.length === 0) return;

            // 收集所有存在的标题级别并排序
            const existingLevels = getExistingHeaderLevels(protyle);
            if (existingLevels.length === 0) return;

            const settings = this.settingsManager.getSettings();
            const updates: Record<string, string> = {};
            const counters = [0, 0, 0, 0, 0, 0];

            // 处理每个标题
            for (const element of headerElements) {
                const blockId = element.getAttribute("data-node-id");
                if (!blockId) continue;

                const level = getHeaderLevel(element);
                if (level === 0) continue;

                const htmlContent = getHtmlContent(element);
                if (!htmlContent) continue;

                // 生成新序号
                const [number, newCounters] = generateHeaderNumber(
                    level,
                    counters,
                    settings.numberingFormats,
                    settings.useChineseNumbers,
                    existingLevels
                );

                // 更新计数器
                Object.assign(counters, newCounters);

                // 添加新序号到HTML内容
                const numberedContent = number + htmlContent;
                setHtmlContent(element, numberedContent);

                // 添加到更新列表
                updates[blockId] = element.outerHTML;
            }

            // 批量更新内容
            if (Object.keys(updates).length > 0) {
                await batchUpdateBlockContent(updates, "dom", this.canUseBulkApi());

                // 如果有活动的块，将光标移动到其末尾
                if (this.activeBlockId) {
                    setTimeout(() => {
                        const activeElement = document.querySelector(
                            `[data-node-id="${this.activeBlockId}"]`
                        );
                        if (activeElement) {
                            setCursorToEnd(activeElement);
                        }
                    }, 200);
                }
            }

            this.shouldUpdate = false;
        } catch (error) {
            console.error('更新标题编号失败:', error);
            throw error;
        }
    }

    hasNumbering(protyle: any): boolean {
        if (!protyle) return false;

        try {
            const headerElements = getHeaderElements(protyle);
            const settings = this.settingsManager.getSettings();

            for (const element of headerElements) {
                const htmlContent = getHtmlContent(element);
                if (!htmlContent) continue;

                // 检查是否包含任何格式的编号
                for (const format of settings.numberingFormats) {
                    if (hasHeaderNumber(htmlContent, format)) {
                        return true;
                    }
                }
            }
        } catch (error) {
            console.error('检查标题编号失败:', error);
        }

        return false;
    }

    /**
     * 处理编辑事件
     * @param event 编辑事件
     */
    handleEditEvent(event: CustomEvent): void {
        this.lastInputTime = Date.now();
        
        const docId = this.documentManager.getCurrentDocId();
        if (!docId) return;

        if (!event.detail || !event.detail.cmd || event.detail.cmd !== "transactions") {
            return;
        }

        for (const transaction of event.detail.data) {
            for (const operation of transaction.doOperations) {
                if (operation.action === "insert") {
                    this.activeBlockId = operation.id;
                }

                if (!this.shouldUpdate) {
                    const blockHtml = operation.data;
                    // 检查是否是标题
                    if (/data-subtype="h\d"/.test(blockHtml)) {
                        this.shouldUpdate = true;
                    }
                }

                if (operation.action === "insert" && this.shouldUpdate) {
                    this.queueUpdate();
                }
            }
        }
    }

    /**
     * 队列更新
     */
    private queueUpdate(): void {
        this.clearUpdateTimer();

        // 设置新的定时器
        this.updateTimer = window.setTimeout(async () => {
            // 检查是否距离最后一次输入已经过去2秒
            if (Date.now() - this.lastInputTime >= 2000) {
                if (this.shouldUpdate) {
                    const protyle = this.documentManager.getCurrentProtyle();
                    if (protyle) {
                        await this.updateNumbering(protyle);
                    }
                }
            } else {
                // 如果还没到2秒，重新设置定时器
                this.queueUpdate();
            }
        }, 2000) as unknown as number;
    }

    /**
     * 执行更新
     */
    private async performUpdate(): Promise<void> {
        if (this.shouldUpdate) {
            const protyle = this.documentManager.getCurrentProtyle();
            if (protyle) {
                await this.updateNumbering(protyle);
            }
        }
    }

    /**
     * 清除更新定时器
     */
    private clearUpdateTimer(): void {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }
    }

    /**
     * 检查是否可以使用批量API
     * @returns 是否可以使用
     */
    private canUseBulkApi(): boolean {
        return this.version >= "3.1.25";
    }

    /**
     * 获取标题信息列表
     * @param protyle 编辑器实例
     * @returns 标题信息数组
     */
    getHeaderInfoList(protyle: any): IHeadingInfo[] {
        if (!protyle) return [];

        const headerInfos: IHeadingInfo[] = [];
        const headerElements = getHeaderElements(protyle);

        for (const element of headerElements) {
            const blockId = element.getAttribute("data-node-id");
            if (!blockId) continue;

            const level = getHeaderLevel(element);
            if (level === 0) continue;

            const originalContent = getHtmlContent(element);
            if (!originalContent) continue;

            headerInfos.push({
                element: element as HTMLElement,
                blockId,
                level,
                originalContent
            });
        }

        return headerInfos;
    }

    /**
     * 启用实时更新
     */
    enableRealTimeUpdate(): void {
        // 这个方法需要在主插件类中调用，以便绑定事件监听器
    }

    /**
     * 禁用实时更新
     */
    disableRealTimeUpdate(): void {
        this.clearUpdateTimer();
        this.shouldUpdate = false;
    }
}

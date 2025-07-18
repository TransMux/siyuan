/**
 * 标题自动编号系统
 * 基于 siyuan-auto-seq-number 插件的设计思路重新实现
 */

import { IHeadingNumbering } from "../types";
import { SettingsManager } from "./SettingsManager";
import { DocumentManager } from "./DocumentManager";
import { OutlineManager } from "./OutlineManager";
import { StyleManager } from "../ui/StyleManager";
import { getVersion } from "../utils/apiUtils";

export class HeadingNumbering implements IHeadingNumbering {
    private settingsManager: SettingsManager;
    private documentManager: DocumentManager;
    private outlineManager: OutlineManager;
    private styleManager: StyleManager;
    private version: string = "";

    constructor(
        settingsManager: SettingsManager,
        documentManager: DocumentManager,
        outlineManager: OutlineManager,
        styleManager: StyleManager
    ) {
        this.settingsManager = settingsManager;
        this.documentManager = documentManager;
        this.outlineManager = outlineManager;
        this.styleManager = styleManager;
    }

    async init(): Promise<void> {
        this.version = await getVersion();
    }

    destroy(): void {
        // 清除样式
        this.styleManager.clearHeadingNumbering();
    }

    async applyNumbering(protyle: any): Promise<void> {
        const docId = this.documentManager.getCurrentDocId();
        if (!docId) return;

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
        try {
            // 使用CSS方式清除编号，只需要清除样式即可
            this.styleManager.clearHeadingNumbering();
        } catch (error) {
            console.error('清除标题编号失败:', error);
            throw error;
        }
    }

    async updateNumbering(protyle: any): Promise<void> {
        const docId = this.documentManager.getCurrentDocId();
        if (!docId) return;

        try {
            // 获取设置
            const settings = this.settingsManager.getSettings();

            // 获取标题编号映射
            const headingMap = await this.outlineManager.getHeadingNumberMap(
                docId,
                settings.numberingFormats,
                settings.useChineseNumbers,
                true // 强制刷新
            );

            // 应用CSS样式
            this.styleManager.applyHeadingNumbering(headingMap);
        } catch (error) {
            console.error('更新标题编号失败:', error);
            throw error;
        }
    }

    hasNumbering(protyle: any): boolean {
        try {
            // 检查样式管理器中是否有应用的编号样式
            return this.styleManager.isNumberingApplied();
        } catch (error) {
            console.error('检查标题编号失败:', error);
            return false;
        }
    }

    /**
     * 更新指定文档的标题编号
     * @param docId 文档ID
     */
    async updateNumberingForDoc(docId: string): Promise<void> {
        try {
            // 获取设置
            const settings = this.settingsManager.getSettings();

            // 获取标题编号映射
            const headingMap = await this.outlineManager.getHeadingNumberMap(
                docId,
                settings.numberingFormats,
                settings.useChineseNumbers,
                true // 强制刷新
            );

            // 应用CSS样式
            this.styleManager.applyHeadingNumbering(headingMap);
        } catch (error) {
            console.error(`更新文档${docId}的标题编号失败:`, error);
            throw error;
        }
    }

    /**
     * 检查文档是否包含标题
     * @param docId 文档ID
     * @returns 是否包含标题
     */
    async hasHeadingsInDoc(docId: string): Promise<boolean> {
        try {
            return await this.outlineManager.hasHeadings(docId);
        } catch (error) {
            console.error(`检查文档${docId}是否包含标题失败:`, error);
            return false;
        }
    }

    /**
     * 获取文档的标题统计信息
     * @param docId 文档ID
     * @returns 标题统计信息
     */
    async getHeadingStats(docId: string): Promise<{
        totalCount: number;
        levelCounts: Record<number, number>;
        maxLevel: number;
        minLevel: number;
    }> {
        try {
            return await this.outlineManager.getHeadingStats(docId);
        } catch (error) {
            console.error(`获取文档${docId}的标题统计失败:`, error);
            return {
                totalCount: 0,
                levelCounts: {},
                maxLevel: 0,
                minLevel: 0
            };
        }
    }

    /**
     * 获取当前编号样式统计
     * @returns 样式统计信息
     */
    getNumberingStats(): {
        headingCount: number;
        figureCount: number;
        cssStats: ReturnType<typeof import("../utils/cssGenerator").CSSGenerator.getStats>;
    } {
        return this.styleManager.getNumberingStats();
    }

    /**
     * 启用实时更新（保留接口兼容性）
     */
    enableRealTimeUpdate(): void {
        // 新架构中实时更新由EventHandler处理
    }

    /**
     * 禁用实时更新（保留接口兼容性）
     */
    disableRealTimeUpdate(): void {
        // 新架构中实时更新由EventHandler处理
    }

    /**
     * 处理 WebSocket transaction 消息
     * @param msg WebSocket 消息
     */
    async handleTransactionMessage(msg: any): Promise<void> {
        try {
            // 检查当前文档是否受影响
            if (!this.documentManager.isCurrentDocumentAffected(msg)) {
                return;
            }

            // 获取当前文档ID
            const currentDocId = this.documentManager.getCurrentDocId();
            if (!currentDocId) return;

            // 分析是否需要更新标题编号
            if (this.needsHeadingUpdate(msg)) {
                await this.updateNumberingForDoc(currentDocId);
            }
        } catch (error) {
            console.error('HeadingNumbering: 处理 transaction 消息失败:', error);
        }
    }

    /**
     * 检查消息是否需要更新标题编号
     * @param msg WebSocket 消息
     * @returns 是否需要更新
     */
    private needsHeadingUpdate(msg: any): boolean {
        if (!msg.data || !Array.isArray(msg.data)) {
            return false;
        }

        // 检查是否包含标题相关的操作
        return msg.data.some((transaction: any) => {
            if (!transaction.doOperations || !Array.isArray(transaction.doOperations)) {
                return false;
            }

            return transaction.doOperations.some((operation: any) => {
                // 检查操作数据中是否包含标题节点
                if (operation.data && typeof operation.data === 'string') {
                    return operation.data.includes('data-type="NodeHeading"');
                }
                return false;
            });
        });
    }
}

/**
 * 设置管理器
 * 负责插件配置的加载、保存和管理
 */

import { Plugin } from "../../../index";
import { ISettingsManager, IDocumentStylerSettings } from "../types";

// 存储配置的键名
const STORAGE_NAME = "document-styler-settings";

// 默认配置
const DEFAULT_SETTINGS: IDocumentStylerSettings = {
    headingNumbering: false,
    crossReference: false,
    numberingFormats: [
        "{1}. ",        // h1
        "{1}.{2} ",     // h2
        "{1}.{2}.{3} ", // h3
        "{1}.{2}.{3}.{4} ", // h4
        "{1}.{2}.{3}.{4}.{5} ", // h5
        "{1}.{2}.{3}.{4}.{5}.{6} ", // h6
    ],
    useChineseNumbers: [false, false, false, false, false, false],
    defaultEnabled: true,
    realTimeUpdate: false,
    docEnableStatus: {},
};

export class SettingsManager implements ISettingsManager {
    private plugin: Plugin;
    private settings: IDocumentStylerSettings;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
        this.settings = { ...DEFAULT_SETTINGS };
    }

    async init(): Promise<void> {
        await this.loadSettings();
    }

    destroy(): void {
        // 清理资源
    }

    getSettings(): IDocumentStylerSettings {
        return { ...this.settings };
    }

    async updateSettings(newSettings: Partial<IDocumentStylerSettings>): Promise<void> {
        this.settings = { ...this.settings, ...newSettings };
        await this.saveSettings();
    }

    async saveSettings(): Promise<void> {
        try {
            await this.plugin.saveData(STORAGE_NAME, this.settings);
        } catch (error) {
            console.error('保存设置失败:', error);
            throw error;
        }
    }

    async loadSettings(): Promise<void> {
        try {
            const stored = await this.plugin.loadData(STORAGE_NAME);
            if (stored) {
                // 合并默认设置和存储的设置，确保新增的配置项有默认值
                this.settings = { ...DEFAULT_SETTINGS, ...stored };
            } else {
                this.settings = { ...DEFAULT_SETTINGS };
            }
        } catch (error) {
            console.error('加载设置失败:', error);
            this.settings = { ...DEFAULT_SETTINGS };
        }
    }

    /**
     * 重置设置为默认值
     * @param preserveDocStatus 是否保留文档启用状态
     */
    async resetSettings(preserveDocStatus: boolean = true): Promise<void> {
        const docEnableStatus = preserveDocStatus ? this.settings.docEnableStatus : {};
        this.settings = {
            ...DEFAULT_SETTINGS,
            docEnableStatus
        };
        await this.saveSettings();
    }

    /**
     * 获取文档的启用状态
     * @param docId 文档ID
     * @returns 是否启用
     */
    isDocumentEnabled(docId: string): boolean {
        if (!docId) return false;
        return docId in this.settings.docEnableStatus
            ? this.settings.docEnableStatus[docId]
            : this.settings.defaultEnabled;
    }

    /**
     * 设置文档的启用状态
     * @param docId 文档ID
     * @param enabled 是否启用
     */
    async setDocumentEnabled(docId: string, enabled: boolean): Promise<void> {
        if (!docId) return;
        
        this.settings.docEnableStatus[docId] = enabled;
        await this.saveSettings();
    }

    /**
     * 获取标题编号格式
     * @param level 标题级别 (0-5)
     * @returns 格式字符串
     */
    getNumberingFormat(level: number): string {
        if (level < 0 || level >= this.settings.numberingFormats.length) {
            return "{1}. ";
        }
        return this.settings.numberingFormats[level];
    }

    /**
     * 设置标题编号格式
     * @param level 标题级别 (0-5)
     * @param format 格式字符串
     */
    async setNumberingFormat(level: number, format: string): Promise<void> {
        if (level < 0 || level >= this.settings.numberingFormats.length) {
            return;
        }
        
        this.settings.numberingFormats[level] = format;
        await this.saveSettings();
    }

    /**
     * 获取是否使用中文数字
     * @param level 标题级别 (0-5)
     * @returns 是否使用中文数字
     */
    getUseChineseNumbers(level: number): boolean {
        if (level < 0 || level >= this.settings.useChineseNumbers.length) {
            return false;
        }
        return this.settings.useChineseNumbers[level];
    }

    /**
     * 设置是否使用中文数字
     * @param level 标题级别 (0-5)
     * @param useChinese 是否使用中文数字
     */
    async setUseChineseNumbers(level: number, useChinese: boolean): Promise<void> {
        if (level < 0 || level >= this.settings.useChineseNumbers.length) {
            return;
        }
        
        this.settings.useChineseNumbers[level] = useChinese;
        await this.saveSettings();
    }

    /**
     * 获取默认配置
     * @returns 默认配置
     */
    static getDefaultSettings(): IDocumentStylerSettings {
        return { ...DEFAULT_SETTINGS };
    }

    /**
     * 验证设置的有效性
     * @param settings 要验证的设置
     * @returns 是否有效
     */
    static validateSettings(settings: any): settings is IDocumentStylerSettings {
        if (!settings || typeof settings !== 'object') {
            return false;
        }

        // 检查必需的属性
        const requiredProps = [
            'headingNumbering',
            'crossReference',
            'numberingFormats',
            'useChineseNumbers',
            'defaultEnabled',
            'realTimeUpdate',
            'docEnableStatus'
        ];

        for (const prop of requiredProps) {
            if (!(prop in settings)) {
                return false;
            }
        }

        // 检查数组长度
        if (!Array.isArray(settings.numberingFormats) || settings.numberingFormats.length !== 6) {
            return false;
        }

        if (!Array.isArray(settings.useChineseNumbers) || settings.useChineseNumbers.length !== 6) {
            return false;
        }

        return true;
    }

    /**
     * 修复无效的设置
     * @param settings 要修复的设置
     * @returns 修复后的设置
     */
    static fixSettings(settings: any): IDocumentStylerSettings {
        const fixed = { ...DEFAULT_SETTINGS };

        if (settings && typeof settings === 'object') {
            // 复制有效的属性
            if (typeof settings.headingNumbering === 'boolean') {
                fixed.headingNumbering = settings.headingNumbering;
            }
            if (typeof settings.crossReference === 'boolean') {
                fixed.crossReference = settings.crossReference;
            }
            if (typeof settings.defaultEnabled === 'boolean') {
                fixed.defaultEnabled = settings.defaultEnabled;
            }
            if (typeof settings.realTimeUpdate === 'boolean') {
                fixed.realTimeUpdate = settings.realTimeUpdate;
            }
            if (Array.isArray(settings.numberingFormats) && settings.numberingFormats.length === 6) {
                fixed.numberingFormats = [...settings.numberingFormats];
            }
            if (Array.isArray(settings.useChineseNumbers) && settings.useChineseNumbers.length === 6) {
                fixed.useChineseNumbers = [...settings.useChineseNumbers];
            }
            if (settings.docEnableStatus && typeof settings.docEnableStatus === 'object') {
                fixed.docEnableStatus = { ...settings.docEnableStatus };
            }
        }

        return fixed;
    }
}

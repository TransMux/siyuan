/**
 * 设置管理器
 * 负责插件配置的加载、保存和管理
 */

import { Plugin } from "../../../index";
import { ISettingsManager, IDocumentStylerSettings, HeadingNumberStyle, DOCUMENT_ATTR_KEYS, IDocumentStylerDocumentSettings } from "../types";
import { getDocumentAttr, setDocumentAttr } from "../utils/apiUtils";

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
    headingNumberStyles: [
        HeadingNumberStyle.ARABIC,    // h1: 1, 2, 3
        HeadingNumberStyle.ARABIC,    // h2: 1, 2, 3
        HeadingNumberStyle.ARABIC,    // h3: 1, 2, 3
        HeadingNumberStyle.ARABIC,    // h4: 1, 2, 3
        HeadingNumberStyle.ARABIC,    // h5: 1, 2, 3
        HeadingNumberStyle.ARABIC,    // h6: 1, 2, 3
    ],
    defaultEnabled: true,
};

export class SettingsManager implements ISettingsManager {
    private plugin: Plugin;
    private settings: IDocumentStylerSettings;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
        this.settings = Object.assign({}, DEFAULT_SETTINGS);
    }

    async init(): Promise<void> {
        await this.loadSettings();
    }

    destroy(): void {
        // 清理资源
    }

    getSettings(): IDocumentStylerSettings {
        return Object.assign({}, this.settings);
    }

    async updateSettings(newSettings: Partial<IDocumentStylerSettings>): Promise<void> {
        this.settings = Object.assign({}, this.settings, newSettings);
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
            if (stored && typeof stored === 'object') {
                // 合并默认设置和存储的设置，确保新增的配置项有默认值
                this.settings = Object.assign({}, DEFAULT_SETTINGS, stored);
            } else {
                this.settings = Object.assign({}, DEFAULT_SETTINGS);
            }
        } catch (error) {
            console.error('加载设置失败:', error);
            this.settings = Object.assign({}, DEFAULT_SETTINGS);
        }
    }

    /**
     * 重置设置为默认值
     */
    async resetSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS);
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
     * 获取指定级别的标题编号样式
     * @param level 标题级别 (0-5)
     * @returns 标题编号样式
     */
    getHeadingNumberStyle(level: number): HeadingNumberStyle {
        if (level < 0 || level >= this.settings.headingNumberStyles.length) {
            return HeadingNumberStyle.ARABIC;
        }
        return this.settings.headingNumberStyles[level];
    }

    /**
     * 设置指定级别的标题编号样式
     * @param level 标题级别 (0-5)
     * @param style 标题编号样式
     */
    async setHeadingNumberStyle(level: number, style: HeadingNumberStyle): Promise<void> {
        if (level < 0 || level >= this.settings.headingNumberStyles.length) {
            return;
        }

        this.settings.headingNumberStyles[level] = style;
        await this.saveSettings();
    }

    /**
     * 获取文档的设置
     * @param docId 文档ID
     * @returns 文档设置
     */
    async getDocumentSettings(docId: string): Promise<IDocumentStylerDocumentSettings> {
        try {
            const value = await getDocumentAttr(docId, DOCUMENT_ATTR_KEYS.DOCUMENT_STYLER_SETTINGS);
            if (value === null) {
                // 如果没有设置属性，返回默认设置
                return this.getDefaultDocumentSettings();
            }
            
            const settings = JSON.parse(value);
            return this.validateAndFixDocumentSettings(settings);
        } catch (error) {
            console.error('获取文档设置失败:', error);
            return this.getDefaultDocumentSettings();
        }
    }

    /**
     * 设置文档的设置
     * @param docId 文档ID
     * @param settings 文档设置
     */
    async setDocumentSettings(docId: string, settings: Partial<IDocumentStylerDocumentSettings>): Promise<void> {
        try {
            const currentSettings = await this.getDocumentSettings(docId);
            const newSettings = { ...currentSettings, ...settings };
            await setDocumentAttr(docId, {
                [DOCUMENT_ATTR_KEYS.DOCUMENT_STYLER_SETTINGS]: JSON.stringify(newSettings)
            });
        } catch (error) {
            console.error('设置文档设置失败:', error);
        }
    }

    /**
     * 获取文档的标题编号启用状态
     * @param docId 文档ID
     * @returns 是否启用标题编号
     */
    async isDocumentHeadingNumberingEnabled(docId: string): Promise<boolean> {
        const settings = await this.getDocumentSettings(docId);
        return settings.headingNumberingEnabled;
    }

    /**
     * 设置文档的标题编号启用状态
     * @param docId 文档ID
     * @param enabled 是否启用
     */
    async setDocumentHeadingNumberingEnabled(docId: string, enabled: boolean): Promise<void> {
        await this.setDocumentSettings(docId, { headingNumberingEnabled: enabled });
    }

    /**
     * 获取文档的交叉引用启用状态
     * @param docId 文档ID
     * @returns 是否启用交叉引用
     */
    async isDocumentCrossReferenceEnabled(docId: string): Promise<boolean> {
        const settings = await this.getDocumentSettings(docId);
        return settings.crossReferenceEnabled;
    }

    /**
     * 设置文档的交叉引用启用状态
     * @param docId 文档ID
     * @param enabled 是否启用
     */
    async setDocumentCrossReferenceEnabled(docId: string, enabled: boolean): Promise<void> {
        await this.setDocumentSettings(docId, { crossReferenceEnabled: enabled });
    }

    /**
     * 获取文档的标题编号样式
     * @param docId 文档ID
     * @param level 标题级别 (0-5)
     * @returns 标题编号样式
     */
    async getDocumentHeadingNumberStyle(docId: string, level: number): Promise<HeadingNumberStyle> {
        const settings = await this.getDocumentSettings(docId);
        if (level < 0 || level >= settings.headingNumberStyles.length) {
            return HeadingNumberStyle.ARABIC;
        }
        return settings.headingNumberStyles[level];
    }

    /**
     * 设置文档的标题编号样式
     * @param docId 文档ID
     * @param level 标题级别 (0-5)
     * @param style 标题编号样式
     */
    async setDocumentHeadingNumberStyle(docId: string, level: number, style: HeadingNumberStyle): Promise<void> {
        const settings = await this.getDocumentSettings(docId);
        if (level < 0 || level >= settings.headingNumberStyles.length) {
            return;
        }
        
        const newStyles = [...settings.headingNumberStyles];
        newStyles[level] = style;
        await this.setDocumentSettings(docId, { headingNumberStyles: newStyles });
    }

    /**
     * 获取文档的编号格式
     * @param docId 文档ID
     * @param level 标题级别 (0-5)
     * @returns 格式字符串
     */
    async getDocumentNumberingFormat(docId: string, level: number): Promise<string> {
        const settings = await this.getDocumentSettings(docId);
        if (level < 0 || level >= settings.numberingFormats.length) {
            return "{1}. ";
        }
        return settings.numberingFormats[level];
    }

    /**
     * 设置文档的编号格式
     * @param docId 文档ID
     * @param level 标题级别 (0-5)
     * @param format 格式字符串
     */
    async setDocumentNumberingFormat(docId: string, level: number, format: string): Promise<void> {
        const settings = await this.getDocumentSettings(docId);
        if (level < 0 || level >= settings.numberingFormats.length) {
            return;
        }
        
        const newFormats = [...settings.numberingFormats];
        newFormats[level] = format;
        await this.setDocumentSettings(docId, { numberingFormats: newFormats });
    }

    /**
     * 获取默认文档设置
     * @returns 默认文档设置
     */
    getDefaultDocumentSettings(): IDocumentStylerDocumentSettings {
        return {
            headingNumberingEnabled: this.settings.defaultEnabled,
            crossReferenceEnabled: false,
            numberingFormats: [...this.settings.numberingFormats],
            headingNumberStyles: [...this.settings.headingNumberStyles],
            defaultEnabled: this.settings.defaultEnabled
        };
    }

    /**
     * 验证并修复文档设置
     * @param settings 要验证的设置
     * @returns 修复后的设置
     */
    private validateAndFixDocumentSettings(settings: any): IDocumentStylerDocumentSettings {
        const defaultSettings = this.getDefaultDocumentSettings();
        
        if (!settings || typeof settings !== 'object') {
            return defaultSettings;
        }

        const fixed = { ...defaultSettings };

        // 验证并修复各个属性
        if (typeof settings.headingNumberingEnabled === 'boolean') {
            fixed.headingNumberingEnabled = settings.headingNumberingEnabled;
        }
        
        if (typeof settings.crossReferenceEnabled === 'boolean') {
            fixed.crossReferenceEnabled = settings.crossReferenceEnabled;
        }
        
        if (typeof settings.defaultEnabled === 'boolean') {
            fixed.defaultEnabled = settings.defaultEnabled;
        }
        
        if (Array.isArray(settings.numberingFormats) && settings.numberingFormats.length === 6) {
            fixed.numberingFormats = [...settings.numberingFormats];
        }
        
        if (Array.isArray(settings.headingNumberStyles) && settings.headingNumberStyles.length === 6) {
            fixed.headingNumberStyles = [...settings.headingNumberStyles];
        }

        return fixed;
    }

    /**
     * 获取默认配置
     * @returns 默认配置
     */
    static getDefaultSettings(): IDocumentStylerSettings {
        return Object.assign({}, DEFAULT_SETTINGS);
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
            'headingNumberStyles',
            'defaultEnabled'
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

        if (!Array.isArray(settings.headingNumberStyles) || settings.headingNumberStyles.length !== 6) {
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
        const fixed = Object.assign({}, DEFAULT_SETTINGS);

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
            if (Array.isArray(settings.numberingFormats) && settings.numberingFormats.length === 6) {
                fixed.numberingFormats = [...settings.numberingFormats];
            }
            if (Array.isArray(settings.headingNumberStyles) && settings.headingNumberStyles.length === 6) {
                fixed.headingNumberStyles = [...settings.headingNumberStyles];
            }
        }

        return fixed;
    }
}

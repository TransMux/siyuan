/**
 * DocumentStyler 插件类型定义
 */

import { App } from "../../../../index";
import { Plugin } from "../../../index";

/**
 * 标题编号样式枚举
 */
export enum HeadingNumberStyle {
    /** 阿拉伯数字：1, 2, 3 */
    ARABIC = 'arabic',
    /** 中文数字：一, 二, 三 */
    CHINESE = 'chinese',
    /** 中文大写：壹, 贰, 叁 */
    CHINESE_UPPER = 'chinese_upper',
    /** 圆圈数字：①, ②, ③ */
    CIRCLED = 'circled',
    /** 圆圈中文：❶, ❷, ❸ */
    CIRCLED_CHINESE = 'circled_chinese',
    /** 表情数字：1️⃣, 2️⃣, 3️⃣ */
    EMOJI = 'emoji',
    /** 英文大写：A, B, C */
    UPPER_ALPHA = 'upper_alpha',
    /** 英文小写：a, b, c */
    LOWER_ALPHA = 'lower_alpha',
    /** 罗马数字大写：I, II, III */
    UPPER_ROMAN = 'upper_roman',
    /** 罗马数字小写：i, ii, iii */
    LOWER_ROMAN = 'lower_roman',
    /** 带括号数字：(1), (2), (3) */
    PARENTHESES = 'parentheses',
    /** 方括号数字：[1], [2], [3] */
    BRACKETS = 'brackets',
    /** 点号数字：1., 2., 3. */
    DOT = 'dot',
    /** 双点号数字：1), 2), 3) */
    DOUBLE_DOT = 'double_dot',
    /** 天干：甲, 乙, 丙 */
    HEAVENLY_STEMS = 'heavenly_stems',
    /** 地支：子, 丑, 寅 */
    EARTHLY_BRANCHES = 'earthly_branches'
}

/**
 * 插件设置接口
 */
export interface IDocumentStylerSettings {
    /** 标题自动编号设置 */
    headingNumbering: boolean;
    /** 交叉引用设置 */
    crossReference: boolean;
    /** 标题编号格式配置 */
    numberingFormats: string[];
    /** 标题编号样式配置 (6个级别) */
    headingNumberStyles: HeadingNumberStyle[];
    /** 默认启用状态 */
    defaultEnabled: boolean;
}

/**
 * 文档信息接口
 */
export interface IDocumentInfo {
    /** 文档ID */
    id: string;
    /** 文档标题 */
    title: string;
    /** 标题编号启用状态 */
    numberingEnabled: boolean;
    /** 交叉引用启用状态 */
    crossReferenceEnabled: boolean;
}

/**
 * 标题元素信息
 */
export interface IHeadingInfo {
    /** 元素 */
    element: HTMLElement;
    /** 块ID */
    blockId: string;
    /** 标题级别 (1-6) */
    level: number;
    /** 原始内容 */
    originalContent: string;
    /** 编号后的内容 */
    numberedContent?: string;
}

/**
 * 标题编号映射接口
 */
export interface IHeadingNumberMap {
    /** 块ID到编号的映射 */
    [blockId: string]: string;
}

/**
 * 图片/表格信息
 */
export interface IFigureInfo {
    /** 块ID */
    id: string;
    /** 类型 */
    type: 'image' | 'table';
    /** 内容 */
    content: string;
    /** 标题/描述 */
    caption?: string;
    /** 编号 */
    number?: number;
}

/**
 * 编号配置
 */
export interface INumberingConfig {
    /** 格式模板 */
    formats: string[];
    /** 是否使用中文数字 */
    useChineseNumbers: boolean[];
    /** 起始级别 */
    startLevel: number;
}

/**
 * 事件数据接口
 */
export interface IDocumentSwitchEvent {
    protyle: any;
}

export interface IDocumentLoadedEvent {
    protyle: any;
}

/**
 * 插件构造函数选项
 */
export interface IPluginOptions {
    app: App;
    name: string;
    displayName: string;
    i18n: any;
}

/**
 * 模块基类接口
 */
export interface IModule {
    /** 初始化模块 */
    init(): Promise<void>;
    /** 销毁模块 */
    destroy(): void;
}

/**
 * 文档管理器接口
 */
export interface IDocumentManager extends IModule {
    /** 当前文档ID */
    getCurrentDocId(): string | null;
    /** 获取当前编辑器 */
    getCurrentProtyle(): any;
    /** 获取文档信息 */
    getDocumentInfo(docId: string): Promise<IDocumentInfo | null>;
    /** 更新文档信息 */
    updateDocumentInfo(docId: string, info: Partial<IDocumentInfo>): Promise<void>;
}

/**
 * 设置管理器接口
 */
export interface ISettingsManager extends IModule {
    /** 获取设置 */
    getSettings(): IDocumentStylerSettings;
    /** 更新设置 */
    updateSettings(settings: Partial<IDocumentStylerSettings>): Promise<void>;
    /** 保存设置 */
    saveSettings(): Promise<void>;
    /** 加载设置 */
    loadSettings(): Promise<void>;
}

/**
 * 标题编号管理器接口
 */
export interface IHeadingNumbering extends IModule {
    /** 应用编号 */
    applyNumbering(protyle: any): Promise<void>;
    /** 清除编号 */
    clearNumbering(protyle: any): Promise<void>;
    /** 更新编号 */
    updateNumbering(protyle: any): Promise<void>;
    /** 检查是否有编号 */
    hasNumbering(protyle: any): boolean;
}

/**
 * 交叉引用管理器接口
 */
export interface ICrossReference extends IModule {
    /** 应用交叉引用 */
    applyCrossReference(protyle: any): Promise<void>;
    /** 清除交叉引用 */
    clearCrossReference(protyle: any): Promise<void>;
    /** 获取图片表格列表 */
    getFiguresList(docId: string): Promise<IFigureInfo[]>;
    /** 滚动到指定图片/表格 */
    scrollToFigure(figureId: string): void;
}

/**
 * UI管理器接口
 */
export interface IDockPanel extends IModule {
    /** 更新面板 */
    updatePanel(): void;
    /** 显示面板 */
    showPanel(): void;
    /** 隐藏面板 */
    hidePanel(): void;
}

/**
 * 样式管理器接口
 */
export interface IStyleManager extends IModule {
    /** 加载样式 */
    loadStyles(): void;
    /** 移除样式 */
    removeStyles(): void;
    /** 更新样式 */
    updateStyles(): void;
}

// 移除不再需要的EventHandler接口

/**
 * 文档属性常量
 */
export const DOCUMENT_ATTR_KEYS = {
    /** 文档样式设置 */
    DOCUMENT_STYLER_SETTINGS: 'custom-document-styler-settings'
} as const;

/**
 * 文档样式设置接口
 */
export interface IDocumentStylerDocumentSettings {
    /** 标题自动编号启用状态 */
    headingNumberingEnabled: boolean;
    /** 交叉引用启用状态 */
    crossReferenceEnabled: boolean;
    /** 标题编号格式配置 */
    numberingFormats: string[];
    /** 标题编号样式配置 (6个级别) */
    headingNumberStyles: HeadingNumberStyle[];
    /** 默认启用状态（用于新建文档） */
    defaultEnabled: boolean;
}

/**
 * CSS样式生成器
 * 用于根据标题编号映射动态生成CSS规则
 */

import { IHeadingNumberMap } from './outlineUtils';

/**
 * CSS生成器类
 */
export class CSSGenerator {
    private static readonly STYLE_ID = 'document-styler-heading-numbers';

    /**
     * 根据标题编号映射生成CSS规则
     * @param numberMap 标题编号映射
     * @returns CSS字符串
     */
    static generateHeadingNumberCSS(numberMap: IHeadingNumberMap): string {
        const cssRules: string[] = [];

        // 为每个标题生成CSS规则
        for (const [blockId, numberInfo] of Object.entries(numberMap)) {
            const rule = `.protyle-wysiwyg [data-node-id="${blockId}"][data-type="NodeHeading"] [contenteditable]:before {
    content: "${this.escapeCSS(numberInfo.number)}";
    color: var(--b3-theme-on-surface);
    font-weight: inherit;
}`;
            cssRules.push(rule);
        }

        return cssRules.join('\n');
    }

    /**
     * 应用CSS样式到页面
     * @param css CSS字符串
     */
    static applyCSS(css: string): void {
        let styleElement = document.getElementById(this.STYLE_ID) as HTMLStyleElement;

        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = this.STYLE_ID;
            styleElement.type = 'text/css';
            document.head.appendChild(styleElement);
        }

        styleElement.textContent = css;
    }

    /**
     * 移除CSS样式
     */
    static removeCSS(): void {
        const styleElement = document.getElementById(this.STYLE_ID);
        if (styleElement) {
            styleElement.remove();
        }
    }

    /**
     * 转义CSS字符串中的特殊字符
     * @param str 要转义的字符串
     * @returns 转义后的字符串
     */
    private static escapeCSS(str: string): string {
        return str
            .replace(/\\/g, '\\\\')  // 反斜杠
            .replace(/"/g, '\\"')    // 双引号
            .replace(/'/g, "\\'")    // 单引号
            .replace(/\n/g, '\\A ')  // 换行符
            .replace(/\r/g, '\\D ')  // 回车符
            .replace(/\t/g, '\\9 ')  // 制表符
            .replace(/\f/g, '\\C ')  // 换页符
            .replace(/\v/g, '\\B '); // 垂直制表符
    }

    /**
     * 检查CSS样式是否已应用
     * @returns 是否已应用
     */
    static isApplied(): boolean {
        return document.getElementById(this.STYLE_ID) !== null;
    }

    /**
     * 获取当前应用的CSS内容
     * @returns CSS内容，如果未应用则返回空字符串
     */
    static getCurrentCSS(): string {
        const styleElement = document.getElementById(this.STYLE_ID) as HTMLStyleElement;
        return styleElement ? styleElement.textContent || '' : '';
    }

    /**
     * 清空CSS内容但保留样式元素
     */
    static clearCSS(): void {
        const styleElement = document.getElementById(this.STYLE_ID) as HTMLStyleElement;
        if (styleElement) {
            styleElement.textContent = '';
        }
    }

    /**
     * 生成图片表格编号CSS（为交叉引用功能准备）
     * @param figureMap 图片表格编号映射
     * @returns CSS字符串
     */
    static generateFigureNumberCSS(figureMap: Record<string, { number: string; type: 'image' | 'table' }>): string {
        const cssRules: string[] = [];

        for (const [blockId, figureInfo] of Object.entries(figureMap)) {
            const selector = figureInfo.type === 'image'
                ? `[data-node-id="${blockId}"] img`
                : `[data-node-id="${blockId}"] table`;

            const rule = `
${selector}:after {
    content: "${this.escapeCSS(figureInfo.number)}";
    display: block;
    text-align: center;
    font-size: 0.9em;
    color: var(--b3-theme-on-surface-light);
    margin-top: 0.5em;
}`;
            cssRules.push(rule);
        }

        return cssRules.join('\n');
    }

    /**
     * 生成完整的样式CSS（包括标题和图片表格）
     * @param headingMap 标题编号映射
     * @param figureMap 图片表格编号映射
     * @returns 完整的CSS字符串
     */
    static generateCompleteCSS(
        headingMap: IHeadingNumberMap,
        figureMap?: Record<string, { number: string; type: 'image' | 'table' }>
    ): string {
        const cssRules: string[] = [];

        // 添加标题编号CSS
        const headingCSS = this.generateHeadingNumberCSS(headingMap);
        if (headingCSS) {
            cssRules.push(headingCSS);
        }

        // 添加图片表格编号CSS
        if (figureMap) {
            const figureCSS = this.generateFigureNumberCSS(figureMap);
            if (figureCSS) {
                cssRules.push(figureCSS);
            }
        }

        return cssRules.join('\n\n');
    }

    /**
     * 批量更新样式
     * @param updates 样式更新配置
     */
    static batchUpdate(updates: {
        headingMap?: IHeadingNumberMap;
        figureMap?: Record<string, { number: string; type: 'image' | 'table' }>;
        clear?: boolean;
    }): void {
        if (updates.clear) {
            this.clearCSS();
            return;
        }

        const css = this.generateCompleteCSS(updates.headingMap || {}, updates.figureMap);
        this.applyCSS(css);
    }

    /**
     * 获取样式元素的统计信息
     * @returns 统计信息
     */
    static getStats(): {
        applied: boolean;
        cssLength: number;
        ruleCount: number;
    } {
        const styleElement = document.getElementById(this.STYLE_ID) as HTMLStyleElement;
        const css = styleElement ? styleElement.textContent || '' : '';

        // 简单计算CSS规则数量（通过大括号对数量）
        const ruleCount = (css.match(/\{[^}]*\}/g) || []).length;

        return {
            applied: styleElement !== null,
            cssLength: css.length,
            ruleCount
        };
    }
}

/**
 * CSS工具函数
 */
export class CSSUtils {
    /**
     * 验证CSS选择器是否有效
     * @param selector CSS选择器
     * @returns 是否有效
     */
    static isValidSelector(selector: string): boolean {
        try {
            document.querySelector(selector);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 检查元素是否匹配选择器
     * @param element 目标元素
     * @param selector CSS选择器
     * @returns 是否匹配
     */
    static elementMatches(element: Element, selector: string): boolean {
        try {
            return element.matches(selector);
        } catch {
            return false;
        }
    }

    /**
     * 获取元素的计算样式
     * @param element 目标元素
     * @param property CSS属性名
     * @returns 属性值
     */
    static getComputedStyle(element: Element, property: string): string {
        return window.getComputedStyle(element).getPropertyValue(property);
    }

    /**
     * 检查CSS属性是否被支持
     * @param property CSS属性名
     * @returns 是否支持
     */
    static isCSSPropertySupported(property: string): boolean {
        return property in document.documentElement.style;
    }
}

/**
 * DOM 操作工具函数
 */

/**
 * 设置光标到元素末尾
 * @param element 目标元素
 */
export function setCursorToEnd(element: Element): void {
    const editableElement = element.querySelector('[contenteditable="true"]');
    if (!editableElement) return;

    const range = document.createRange();
    const selection = window.getSelection();
    
    if (!selection) return;

    range.selectNodeContents(editableElement);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
}

/**
 * 获取元素的文本内容（不包含HTML标签）
 * @param element 目标元素
 * @returns 纯文本内容
 */
export function getTextContent(element: Element): string {
    const editableElement = element.querySelector('[contenteditable="true"]');
    return editableElement?.textContent || '';
}

/**
 * 获取元素的HTML内容
 * @param element 目标元素
 * @returns HTML内容
 */
export function getHtmlContent(element: Element): string {
    const editableElement = element.querySelector('[contenteditable="true"]');
    return editableElement?.innerHTML || '';
}

/**
 * 设置元素的HTML内容
 * @param element 目标元素
 * @param content HTML内容
 */
export function setHtmlContent(element: Element, content: string): void {
    const editableElement = element.querySelector('[contenteditable="true"]');
    if (editableElement) {
        editableElement.innerHTML = content;
    }
}

/**
 * 滚动到指定元素并高亮显示
 * @param element 目标元素
 * @param duration 高亮持续时间（毫秒）
 */
export function scrollToElementAndHighlight(element: Element, duration: number = 2000): void {
    // 滚动到元素位置
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // 高亮显示
    element.classList.add('protyle-wysiwyg--select');
    setTimeout(() => {
        element.classList.remove('protyle-wysiwyg--select');
    }, duration);

    // 如果是表格，额外添加边框高亮
    if (element.getAttribute('data-type') === 't') {
        const table = element.querySelector('table') as HTMLTableElement;
        if (table) {
            table.style.outline = '2px solid var(--b3-theme-primary)';
            setTimeout(() => {
                table.style.outline = '';
            }, duration);
        }
    }
}

/**
 * 创建样式元素
 * @param id 样式元素ID
 * @param css CSS内容
 * @returns 创建的样式元素
 */
export function createStyleElement(id: string, css: string): HTMLStyleElement {
    let styleElement = document.getElementById(id) as HTMLStyleElement;
    
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = id;
        document.head.appendChild(styleElement);
    }
    
    styleElement.textContent = css;
    return styleElement;
}

/**
 * 移除样式元素
 * @param id 样式元素ID
 */
export function removeStyleElement(id: string): void {
    const styleElement = document.getElementById(id);
    if (styleElement) {
        styleElement.remove();
    }
}

/**
 * 查找指定块ID的元素
 * @param blockId 块ID
 * @param container 搜索容器，默认为document
 * @returns 找到的元素或null
 */
export function findBlockElement(blockId: string, container: Document | Element = document): Element | null {
    return container.querySelector(`[data-node-id="${blockId}"]`);
}

/**
 * 获取所有标题元素
 * @param protyle 编辑器实例
 * @returns 标题元素列表
 */
export function getHeaderElements(protyle: any): NodeListOf<Element> {
    if (!protyle?.wysiwyg?.element) {
        return document.querySelectorAll(''); // 返回空的NodeList
    }
    return protyle.wysiwyg.element.querySelectorAll('[data-type="NodeHeading"]');
}

/**
 * 获取所有图片元素
 * @param protyle 编辑器实例
 * @returns 图片元素列表
 */
export function getImageElements(protyle: any): NodeListOf<Element> {
    if (!protyle?.wysiwyg?.element) {
        return document.querySelectorAll('');
    }
    return protyle.wysiwyg.element.querySelectorAll('[data-type="img"]');
}

/**
 * 获取所有表格元素
 * @param protyle 编辑器实例
 * @returns 表格元素列表
 */
export function getTableElements(protyle: any): NodeListOf<Element> {
    if (!protyle?.wysiwyg?.element) {
        return document.querySelectorAll('');
    }
    return protyle.wysiwyg.element.querySelectorAll('[data-type="table"]');
}

/**
 * 检查元素是否可见
 * @param element 目标元素
 * @returns 是否可见
 */
export function isElementVisible(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

/**
 * 防抖函数
 * @param func 要防抖的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: number | null = null;
    
    return (...args: Parameters<T>) => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        
        timeoutId = window.setTimeout(() => {
            func(...args);
            timeoutId = null;
        }, delay);
    };
}

/**
 * 节流函数
 * @param func 要节流的函数
 * @param delay 延迟时间（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number
): (...args: Parameters<T>) => void {
    let lastCall = 0;
    
    return (...args: Parameters<T>) => {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            func(...args);
        }
    };
}

/**
 * 等待指定时间
 * @param ms 等待时间（毫秒）
 * @returns Promise
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 安全地执行DOM操作
 * @param operation DOM操作函数
 * @param fallback 失败时的回调函数
 */
export function safeExecute(operation: () => void, fallback?: (error: Error) => void): void {
    try {
        operation();
    } catch (error) {
        console.error('DOM operation failed:', error);
        if (fallback) {
            fallback(error as Error);
        }
    }
}

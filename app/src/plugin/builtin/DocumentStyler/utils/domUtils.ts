/**
 * DOM 操作工具函数
 * 仅保留实际使用的函数
 */

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



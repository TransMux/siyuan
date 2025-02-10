import { bulletMain } from "./focus-block";

// 隐藏已完成 https://x.transmux.top/j/20250207000640-w6qpyf9
const css_隐藏已完成 = `
[data-type="NodeListItem"][class*="protyle-task--done"][data-node-id] {
    opacity: 0.1;
}
`;

let status = false;

export function enable() {
    // 创建一个 <style> 元素
    const styleElement = document.createElement('style');
    styleElement.id = 'mux-hide-checked'; // 给这个style元素一个id
    styleElement.innerHTML = css_隐藏已完成; // 设置css规则

    // 将这个style元素添加到页面的 <head> 部分
    document.head.appendChild(styleElement);
    status = true
}

export function disable() {
    // 找到具有id "mux-hide-checked" 的 <style> 元素
    const styleElement = document.getElementById('mux-hide-checked');

    // 如果找到了，删除它
    if (styleElement) {
        styleElement.remove();
    }
    status = false
}

export function toggle() {
    if (status) {
        disable()
    } else {
        enable()
    }
}

// 默认启用
enable()

bulletMain();
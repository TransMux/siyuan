// ref: 🔗 [js] 多彩 Tab - 链滴
// https://ld246.com/article/1745131935346
const tabStyles = [
    'background-color:var(--b3-font-background1)',
    'background-color:var(--b3-font-background2)',
    'background-color:var(--b3-font-background3)',
    'background-color:var(--b3-font-background4)',
    'background-color:var(--b3-font-background5)',
    'background-color:var(--b3-font-background6)',
    'background-color:var(--b3-font-background7)',
    'background-color:var(--b3-font-background8)',
    'background-color:var(--b3-font-background9)',
    'background-color:var(--b3-font-background10)',
    'background-color:var(--b3-font-background11)',
    'background-color:var(--b3-font-background12)',
];

export function setTabBackground(id: string) {
    const style = getRandomStyle();
    if(!style) return;
    insertTabStyle(id, `.layout-tab-bar .item[data-id="${id}"]{${style} !important}`);
}

export function removeTabBackground(id: string) {
    const styleElement = document.getElementById(`mux-colorful-tab-style-${id}`);
    if (styleElement) {
        styleElement.remove();
    }
}

function insertTabStyle(id: string, style: string) {
    // 创建一个新的style元素
    const styleElement = document.createElement('style');
    // 设置CSS规则
    styleElement.innerHTML = style;
    styleElement.id = `mux-colorful-tab-style-${id}`;
    // 将style元素添加到<head>中
    document.head.appendChild(styleElement);
}


let lastSelected: string | null = null; // 记录上一次选择的样式
function getRandomStyle(defaultStyle = '') {
    const validStyles = tabStyles.filter(style => style.trim() !== '');
    // 如果没有有效样式，返回默认样式
    if (validStyles.length === 0) {
        return defaultStyle;
    }
    // 如果只有一个有效样式，直接返回它
    if (validStyles.length === 1) {
        lastSelected = validStyles[0];
        return validStyles[0];
    }
    let randomIndex, selectedStyle;
    // 确保生成的样式与上一次不同
    do {
        randomIndex = Math.floor(Math.random() * validStyles.length);
        selectedStyle = validStyles[randomIndex];
    } while (selectedStyle === lastSelected);
    // 更新 lastSelected 并返回结果
    lastSelected = selectedStyle;
    return selectedStyle;
}
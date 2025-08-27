/**
 * 获得指定块位于的编辑区
 * @params {HTMLElement}
 * @return {HTMLElement} 光标所在块位于的编辑区
 * @return {null} 光标不在块内
 */
function getTargetEditor(block: HTMLElement) {
    while (block != null && !block.classList.contains('protyle-wysiwyg')) block = block.parentElement;
    return block;
}

/**
 * 获得焦点所在的块
 * @return {HTMLElement} 光标所在块
 * @return {null} 光标不在块内
 */
function getFocusedBlock() {
    if (document.activeElement.classList.contains('protyle-wysiwyg')) {
        let block = window.getSelection()?.focusNode?.parentElement; // 当前光标
        while (block != null && block.dataset.nodeId == null) block = block.parentElement;
        return block;
    }
}

function focusHandler() {
    /* 获取当前编辑区 */
    let block = getFocusedBlock(); // 当前光标所在块
    /* 当前块已经设置焦点 */
    if (block?.classList.contains(`block-focus`)) return;

    /* 当前块未设置焦点 */
    const editor = getTargetEditor(block); // 当前光标所在块位于的编辑区
    if (editor) {
        editor.querySelectorAll(`.block-focus`).forEach((element: HTMLElement) => element.classList.remove(`block-focus`));
        block.classList.add(`block-focus`);

        // 将焦点块 ID 发送到后端状态
        const id = block?.dataset?.nodeId;
        if (id) {
            try {
                // 使用全局内核地址和 Token。前端已有统一 fetch 封装，这里直接调用 fetch 并依赖浏览器注入的 Token 头部中间件。
                fetch('/api/status', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ focusBlockId: id }),
                });
            } catch (e) {
                // 忽略错误
            }
        }
    }
}

export function bulletMain() {
    // 跟踪当前所在块
    window.addEventListener('mouseup', focusHandler, true);
    window.addEventListener('keyup', focusHandler, true);
}
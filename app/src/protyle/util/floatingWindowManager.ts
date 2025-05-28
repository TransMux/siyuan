import {hasTopClosestByClassName} from "./hasClosest";
import {transaction} from "../wysiwyg/transaction";
import {genEmptyElement} from "../../block/util";
import {zoomOut} from "../../menus/protyle";
// 不导入类型，避免 .d.ts 不是模块导致错误

/**
 * 处理编辑器内容为空时的通用清理逻辑
 * 如果在浮窗中删除唯一文档，则移除对应编辑器或关闭浮窗；
 * 否则在根文档创建空元素，或在子文档执行 zoomOut
 * @param protyle 
 * @returns true 表示继续后续操作，false 表示已处理
 */
export const handleFloatingWindowCleanup = (protyle: any): boolean => {
    // 当前内容不为空，继续默认逻辑
    if (protyle.wysiwyg.element.childElementCount !== 0) {
        return true;
    }

    // 如果在浮窗中，移除对应编辑器或关闭浮窗
    const popoverElement = hasTopClosestByClassName(protyle.element, "block__popover", true);
    if (popoverElement) {
        const blockPanel = window.siyuan.blockPanels.find(panel => panel.element === popoverElement);
        if (blockPanel && blockPanel.removeEditorForProtyle(protyle)) {
            return false;
        }
        return true;
    }

    // 非浮窗场景：根文档创建空元素
    if (protyle.block.rootID === protyle.block.id) {
        const newId = (window as any).Lute.NewNodeID();
        const emptyEl = genEmptyElement(false, false, newId);
        protyle.wysiwyg.element.innerHTML = emptyEl.outerHTML;
        transaction(protyle, [{
            action: "insert",
            data: emptyEl.outerHTML,
            id: newId,
            parentID: protyle.block.parentID,
        }]);
        // 清空撤销栈
        if (protyle.undo && typeof protyle.undo.clear === "function") {
            protyle.undo.clear();
        }
        return false;
    }

    // 非浮窗子文档：回到父文档
    zoomOut({
        protyle,
        id: protyle.block.rootID,
        isPushBack: false,
        focusId: protyle.block.id,
    });
    return false;
};

/**
 * 检查是否应该调用浮窗清理逻辑的辅助函数
 * @param protyle 
 * @returns 
 */
export const shouldTriggerFloatingWindowCleanup = (protyle: any): boolean => {
    return protyle.wysiwyg.element.childElementCount === 0;
} 
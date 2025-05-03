import {ToolbarItem} from "./ToolbarItem";
import {hasClosestBlock, hasClosestByAttribute} from "../util/hasClosest";
import { showAnnotationEditPanel, addAnnotation } from "../../mux/protyle-annotation";
import { updateTransaction } from "../wysiwyg/transaction";
import { get } from "../../mux/settings";

export class InlineMemo extends ToolbarItem {
    public element: HTMLElement;

    constructor(protyle: IProtyle, menuItem: IMenuItem) {
        super(protyle, menuItem);
        this.element.addEventListener("click", async (event: MouseEvent & { changedTouches: MouseEvent[] }) => {
            protyle.toolbar.element.classList.add("fn__none");
            event.stopPropagation();

            const range = protyle.toolbar.range;
            const nodeElement = hasClosestBlock(range.startContainer);
            if (!nodeElement) {
                return;
            }

            if(get<boolean>("use-memo-as-annotation")) {
                // 批注逻辑
                const tempElement = document.createElement("div");
                tempElement.appendChild(range.cloneContents());
                const selectedHTML = tempElement.innerHTML;

                const inlineEl = hasClosestByAttribute(range.startContainer, "data-type", "inline-memo") as HTMLElement;
                // Clicking existing annotation: open editor
                if (inlineEl) {
                    const annId = inlineEl.getAttribute("data-inline-memo-content") || "";
                    showAnnotationEditPanel(protyle, inlineEl, annId);
                    return;
                }
                if (!selectedHTML) return;
                const refId = nodeElement.getAttribute("data-node-id")!;
                const oldHTML = nodeElement.outerHTML;
                const newBlockId = await addAnnotation(refId, selectedHTML);
                if (!newBlockId) return;
                // Wrap selection and retrieve new inline element
                const newNodes = protyle.toolbar.setInlineMark(protyle, "inline-memo", "range", { type: "inline-memo" }, true) as Node[];
                const newInlineEl = newNodes[0] as HTMLElement;
                newInlineEl.setAttribute("data-inline-memo-content", newBlockId);
                newInlineEl.dataset.type += " mux-protyle-annotation";
                // Persist inline annotation change
                updateTransaction(protyle, refId, nodeElement.outerHTML, oldHTML);
                // Open annotation panel
                showAnnotationEditPanel(protyle, newInlineEl, newBlockId);
            }
            // 原版逻辑
            const memoElement = hasClosestByAttribute(range.startContainer, "data-type", "inline-memo");
            if (memoElement && memoElement.textContent === range.toString()) {
                // https://github.com/siyuan-note/siyuan/issues/6569
                protyle.toolbar.showRender(protyle, memoElement);
                return;
            }

            if (range.toString() === "") {
                return;
            }

            protyle.toolbar.setInlineMark(protyle, "inline-memo", "range", {
                type: "inline-memo",
            });
        });
    }
}

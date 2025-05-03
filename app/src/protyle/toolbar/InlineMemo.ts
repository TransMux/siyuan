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
                const selectedText = range.toString();
                const inlineEl = hasClosestByAttribute(range.startContainer, "data-type", "mux-protyle-annotation") as HTMLElement;
                // Clicking existing annotation: open editor
                if (inlineEl && inlineEl.textContent === selectedText) {
                    const dataType = inlineEl.getAttribute("data-type") || "";
                    const idToken = dataType.split(" ").find(token => token.startsWith("mux-protyle-annotation-id-"));
                    const annId = idToken ? idToken.slice("mux-protyle-annotation-id-".length) : "";
                    showAnnotationEditPanel(protyle, inlineEl, annId);
                    return;
                }
                if (!selectedText) return;
                const refId = nodeElement.getAttribute("data-node-id")!;
                const oldHTML = nodeElement.outerHTML;
                const newBlockId = await addAnnotation(refId, selectedText);
                if (!newBlockId) return;
                // Wrap selection and retrieve new inline element
                const newNodes = protyle.toolbar.setInlineMark(protyle, "mux-protyle-annotation", "range", { type: "mux-protyle-annotation" }, true) as Node[];
                const newInlineEl = newNodes[0] as HTMLElement;
                // Set data-type to include annotation identifier token
                newInlineEl.setAttribute("data-type", `mux-protyle-annotation mux-protyle-annotation-id-${newBlockId}`);
                // Persist inline annotation change
                updateTransaction(protyle, refId, nodeElement.outerHTML, oldHTML);
                // Open annotation panel
                showAnnotationEditPanel(protyle, newInlineEl, newBlockId);
            }
        });
    }
}

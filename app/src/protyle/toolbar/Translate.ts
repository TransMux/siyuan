import {ToolbarItem} from "./ToolbarItem";
import {hasClosestBlock} from "../util/hasClosest";
import {translateText} from "../util/mux/translate";

export class Translate extends ToolbarItem {
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

            if (range.toString() === "") {
                return;
            }

            // Get the selected text, translate it, and insert as inline-memo
            const selectedText = range.toString();
            try {
                // Translate the selected text
                const translatedText = await translateText(selectedText);
                
                // Insert the translated text as an inline-memo
                protyle.toolbar.setInlineMark(protyle, "inline-memo", "range", {
                    type: "inline-memo"
                });
                
                // The memo content gets added automatically by the system
                // We'll need to find the inserted memo element and update its content
                setTimeout(() => {
                    const memoElements = nodeElement.querySelectorAll('span[data-type="inline-memo"]');
                    if (memoElements.length > 0) {
                        // Get the last memo element, which should be the one we just created
                        const lastMemo = memoElements[memoElements.length - 1];
                        lastMemo.setAttribute("data-inline-memo-content", translatedText);
                    }
                }, 10);
            } catch (error) {
                console.error("Translation error:", error);
            }
        });
    }
} 
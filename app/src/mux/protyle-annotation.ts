import { Constants } from "../constants";
import { fetchPost, fetchSyncPost } from "../util/fetch";
import { showMessage } from "../dialog/message";
import { Protyle } from "../protyle";
import { hideElements } from "../protyle/ui/hideElements";
import { setPosition } from "../util/setPosition";
import { getSelectionPosition } from "../protyle/util/selection";

/**
 * Open annotation edit panel for a given annotation block ID.
 */
export function showAnnotationEditPanel(protyle: IProtyle, nodeElement: Element, annotationBlockId: string) {
    // Hide existing hints and context menus
    hideElements(["hint"], protyle);
    window.siyuan.menus.menu.remove();
    // Prepare the sub-element panel
    const panel = protyle.toolbar.subElement;
    panel.innerHTML = `
      <div class="block__icons block__icons--menu fn__flex" style="border-radius: var(--b3-border-radius-b) var(--b3-border-radius-b) 0 0;">
        <span class="fn__flex-1 resize__move">${window.siyuan.languages.memo}</span>
        <span class="fn__space"></span>
        <button data-type="close" class="block__icon block__icon--show" aria-label="${window.siyuan.languages.close}"><svg><use xlink:href="#iconClose"></use></svg></button>
      </div>
      <div id="annotation-editor" style="min-width:268px;min-height:200px;overflow:auto"></div>
    `;
    // Position the panel near current selection
    const selRect = getSelectionPosition(nodeElement);
    panel.style.zIndex = (++window.siyuan.zIndex).toString();
    panel.classList.remove("fn__none");
    setPosition(panel, selRect.left, selRect.top, 26);
    // Close button behavior
    panel.querySelector('[data-type="close"]')?.addEventListener("click", () => {
        panel.classList.add("fn__none");
    });
    // Mount a Protyle editor for the annotation block
    const container = panel.querySelector("#annotation-editor") as HTMLElement;
    new Protyle(protyle.app, container, {
        rootId: annotationBlockId,
        blockId: annotationBlockId,
        render: { background: false, title: false, gutter: false, scroll: true, breadcrumb: false },
        action: [Constants.CB_GET_HTML, Constants.CB_GET_SETID],
    });
}

/**
 * Create a new annotation block under today's daily note and return its block ID.
 */
export async function addAnnotationInline(protyle: IProtyle): Promise<string> {
    // Ensure today's daily note exists and get its block ID
    const localDailyNoteId = window.siyuan.storage[Constants.LOCAL_DAILYNOTEID];
    const ensureResp = await fetchSyncPost("/api/filetree/createDailyNote", {
        notebook: localDailyNoteId,
        app: Constants.SIYUAN_APPID,
    });
    const parentID = ensureResp.data.id;
    // Insert an empty paragraph block after the daily note root
    return new Promise((resolve) => {
        fetchPost(
            "/api/block/insertBlock",
            { previousID: parentID, dataType: "markdown", data: "" },
            (insertResp: any) => {
                const newBlockId = insertResp.data[0]?.doOperations[0]?.id;
                if (newBlockId) {
                    resolve(newBlockId);
                } else {
                    showMessage("创建批注失败", 1000, "error");
                    resolve("");
                }
            }
        );
    });
}

/**
 * TODO: Implement multi-block annotation creation.
 */
export function addAnnotationMultiBlock(protyle: IProtyle): Promise<string> {
    console.warn("addAnnotationMultiBlock not implemented");
    return Promise.resolve("");
}



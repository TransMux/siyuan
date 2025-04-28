import { Constants } from "../constants";
import { fetchPost, fetchSyncPost } from "../util/fetch";
import { showMessage } from "../dialog/message";
import { hideElements } from "../protyle/ui/hideElements";
import { setPosition } from "../util/setPosition";
import { Protyle } from "../protyle";

/**
 * Open annotation edit panel for a given annotation block ID.
 */
export function showAnnotationEditPanel(
    protyle: IProtyle,
    anchorEl: Element,
    annotationBlockId: string
) {
    // Hide existing hints and context menus and prepare panel
    hideElements(["hint"], protyle);
    window.siyuan.menus.menu.remove();
    const panel = protyle.toolbar.subElement;
    panel.innerHTML = `
      <div class="block__icons block__icons--menu fn__flex" style="border-radius: var(--b3-border-radius-b) var(--b3-border-radius-b) 0 0;">
        <span class="fn__flex-1 resize__move">${window.siyuan.languages.memo}</span>
        <span class="fn__space"></span>
        <button data-type="close" class="block__icon block__icon--show" aria-label="${window.siyuan.languages.close}"><svg><use xlink:href="#iconClose"></use></svg></button>
      </div>
      <div id="annotation-editor" style="width: 800px;max-width:70vw;min-height:200px;overflow:auto"></div>
    `;
    // Position the panel like showRender for inline-memo
    const rect = anchorEl.getBoundingClientRect();
    const bottom = rect.bottom === rect.top ? rect.bottom + 26 : rect.bottom;
    panel.style.zIndex = (++window.siyuan.zIndex).toString();
    panel.classList.remove("fn__none");
    // Position panel like showRender's autoHeight for inline-memo
    const nodeRect = rect;
    const autoHeight = () => {
        // place below if there's room, else to the right
        if (panel.clientHeight <= window.innerHeight - bottom || panel.clientHeight <= nodeRect.top) {
            setPosition(panel, nodeRect.left, bottom, nodeRect.height || 26);
        } else {
            setPosition(panel, nodeRect.right, bottom);
        }
    };
    autoHeight();
    // Close button behavior
    panel.querySelector('[data-type="close"]')?.addEventListener("click", () => {
        panel.classList.add("fn__none");
    });
    // Mount a Protyle editor for the annotation block
    const container = panel.querySelector("#annotation-editor") as HTMLElement;
    // Instantiate Protyle editor for annotation block and focus
    const annotationEditor = new Protyle(protyle.app, container, {
        rootId: annotationBlockId,
        blockId: annotationBlockId,
        render: { background: false, title: false, gutter: false, scroll: true, breadcrumb: false },
        action: [Constants.CB_GET_HTML, Constants.CB_GET_SETID],
    });
    annotationEditor.focus();
    // marker class for styling annotation panel
    panel.classList.add("mux-protyle-annotation");
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



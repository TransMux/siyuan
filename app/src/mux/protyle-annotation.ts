import { Constants } from "../constants";
import { fetchPost, fetchSyncPost } from "../util/fetch";
import { hideElements } from "../protyle/ui/hideElements";
import { setPosition } from "../util/setPosition";
import { Protyle } from "../protyle";
import { updateTransaction } from "../protyle/wysiwyg/transaction";
import { get } from "./settings";

export async function showAnnotationEditPanel(
    protyle: IProtyle,
    anchorEl: HTMLElement,
    annotationBlockId: string,
) {
    // Validate annotation block exists
    try {
        const info = await fetchSyncPost("/api/block/getBlockInfo", { id: annotationBlockId });
        if (info.code !== 0 || !info.data) {
            // Annotation block missing, remove inline mark gracefully
            const inlineEl = anchorEl;
            const parentBlock = inlineEl.closest("[data-node-id]") as HTMLElement;
            if (parentBlock) {
                const blockId = parentBlock.getAttribute("data-node-id");
                const oldHTML = parentBlock.outerHTML;
                // Remove inline-memo and marker
                const types = (inlineEl.getAttribute("data-type") || "").split(" ")
                    .filter(t => t !== "inline-memo" && t !== "mux-protyle-annotation");
                inlineEl.setAttribute("data-type", types.join(" "));
                inlineEl.removeAttribute("data-inline-memo-content");
                inlineEl.removeAttribute("custom-mux-protyle-annotation");
                // Commit transaction
                if (blockId) {
                    updateTransaction(protyle, blockId, parentBlock.outerHTML, oldHTML);
                }
            }
            return;
        }
    } catch (e) {
        // On error, treat as missing
        const inlineEl = anchorEl;
        const parentBlock = inlineEl.closest("[data-node-id]") as HTMLElement;
        if (parentBlock) {
            const blockId = parentBlock.getAttribute("data-node-id");
            const oldHTML = parentBlock.outerHTML;
            const types = (inlineEl.getAttribute("data-type") || "").split(" ")
                .filter(t => t !== "inline-memo" && t !== "mux-protyle-annotation");
            inlineEl.setAttribute("data-type", types.join(" "));
            inlineEl.removeAttribute("data-inline-memo-content");
            if (blockId) {
                updateTransaction(protyle, blockId, parentBlock.outerHTML, oldHTML);
            }
        }
        return;
    }
    // Hide existing hints and context menus and prepare panel
    hideElements(["hint"], protyle);
    window.siyuan.menus.menu.remove();
    const panel = protyle.toolbar.subElement;
    panel.innerHTML = `
      <div class="block__icons block__icons--menu fn__flex" style="border-radius: var(--b3-border-radius-b) var(--b3-border-radius-b) 0 0;">
        <span class="fn__flex-1 resize__move">批注</span>
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

export async function addAnnotation(refId: string, selectedText?: string, selectedBlocks?: Element[]) {
    // 开始构造插入dom
    let dom = annotationTemplate;

    const annotationId = Lute.NewNodeID();
    dom = dom.replace("{annotationId}", annotationId);
    dom = dom.replace("{refId}", refId);

    if (selectedText) {
        dom = dom.replace("{selectedText}", textNodeTemplate.replace("{text}", selectedText));
    } else if (selectedBlocks) {
        dom = dom.replace("{selectedText}", selectedBlocks.map(block => block.outerHTML).join("\n"));
    }

    // 转换为节点
    const tempElement = document.createElement("div");
    tempElement.innerHTML = dom;

    // 删除多余的属性
    tempElement.querySelectorAll("[data-node-id]").forEach((e) => {
        const newId = Lute.NewNodeID();
        e.removeAttribute(Constants.CUSTOM_RIFF_DECKS);
        e.classList.remove("protyle-wysiwyg--select", "protyle-wysiwyg--hl");
        if (e.getAttribute("data-node-id") !== annotationId) {
            // 跳过已经设置的根节点
            e.setAttribute("data-node-id", newId);
        }
        e.setAttribute("updated", newId.split("-")[0]);
        e.removeAttribute("refcount");
        e.removeAttribute("custom-mux-protyle-annotation");
    });

    await fetchSyncPost("/api/block/appendDailyNoteBlock", {
        notebook: window.siyuan.storage[Constants.LOCAL_DAILYNOTEID],
        dataType: "dom",
        data: tempElement.innerHTML,
    });

    // 添加 annotationId 到数据库
    const annotationAvID = get<string>("annotationAvID");
    if (annotationAvID) {
        setTimeout(async () => {
            await fetchPost('/api/av/addAttributeViewBlocks', {
                "avID": annotationAvID,
                "srcs": [{
                    "id": annotationId,
                    "isDetached": false,
                }]
            });
        }, 2000);
    }

    return annotationId;
}
const annotationTemplate = `<div data-marker="*" data-subtype="u" data-node-id="{annotationId}" data-type="NodeListItem" class="li"><div class="protyle-action" draggable="true"><svg><use xlink:href="#iconDot"></use></svg></div><div data-node-id="20250419185932-7on1qns" data-type="NodeParagraph" class="p"><div contenteditable="true" spellcheck="false"><span data-type="block-ref" data-subtype="s" data-id="{refId}">*</span></div><div class="protyle-attr" contenteditable="false">&ZeroWidthSpace;</div></div>{selectedText}<div class="protyle-attr" contenteditable="false">&ZeroWidthSpace;</div></div>`;

const textNodeTemplate = `<div data-node-id="20250429025930-cfcmtsf" data-type="NodeParagraph" class="p"><div contenteditable="true" spellcheck="false">{text}</div><div class="protyle-attr" contenteditable="false">&ZeroWidthSpace;</div></div>`

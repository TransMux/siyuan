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

export async function addAnnotation(refId: string, selectedText?: string, selectedBlocks?: Element[]) {
    // 开始构造插入dom
    debugger;
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
        e.setAttribute("updated", newId.split("-")[0]);
        e.removeAttribute("refcount");
    });

    await fetchSyncPost("/api/block/appendDailyNoteBlock", {
        notebook: window.siyuan.storage[Constants.LOCAL_DAILYNOTEID],
        dataType: "dom",
        data: tempElement.innerHTML,
    });

    return annotationId;
}

const annotationTemplate = `<div data-subtype="u" data-node-id="{annotationId}" data-node-index="1" data-type="NodeList" class="list">
    <div data-marker="*" data-subtype="u" data-node-id="20250419185932-d5cq7qh" data-type="NodeListItem" class="li">

        <div class="protyle-action" draggable="true"><svg><use xlink:href="#iconDot"></use></svg></div>

        <div data-node-id="20250419185932-7on1qns" data-type="NodeParagraph" class="p">
            <div contenteditable="true" spellcheck="false"><span data-type="block-ref" data-subtype="s" data-id="{refId}">*</span></div>
            <div class="protyle-attr" contenteditable="false">&ZeroWidthSpace;</div>
        </div>

        {selectedText}

        <div class="protyle-attr" contenteditable="false">&ZeroWidthSpace;</div>
    </div>
    <div class="protyle-attr" contenteditable="false">&ZeroWidthSpace;</div>
</div>`;

const textNodeTemplate = `<div data-node-id="20250429025930-cfcmtsf" data-type="NodeParagraph" class="p"><div contenteditable="true" spellcheck="false">{text}</div><div class="protyle-attr" contenteditable="false">&ZeroWidthSpace;</div></div>`

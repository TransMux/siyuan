import { insertEmptyBlock } from "../block/util";
import { showMessage } from "../dialog/message";
import { Constants } from "../constants";
import { hideMessage } from "../dialog/message";
import { Toolbar } from "../protyle/toolbar";
import { hideElements } from "../protyle/ui/hideElements";
import { addScript } from "../protyle/util/addScript";
import { openByMobile } from "../protyle/util/compatibility";
import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { fetchPost } from "../util/fetch";
import { Protyle } from "../protyle";
import { isMobile } from "../util/functions";
import { setPosition } from "../util/setPosition";

/* 
mux-annotation
id={id}
...=...
*/
interface AnnotationOptions {
    id: string;
}

export const parseInlineMemo = (text: string): AnnotationOptions | null => {
    // 检查内容是否符合批注格式
    if (text.startsWith("mux-annotation")) {
        // 解析逐行选项
        const options = text.split("\n").map(line => {
            const [key, value] = line.split("=");
            return {
                [key]: value
            };
        });
        return options as unknown as AnnotationOptions;
    }
    if (text === "") {
        // 默认值，创建
        return { id: "" } as AnnotationOptions;
    }
    return null;
};


export async function renderCustomAnnotationPanel(protyle: IProtyle, renderElement: HTMLElement, toolbar: Toolbar, annotationOptions: AnnotationOptions) {
    const { id } = annotationOptions;
    const nodeRect = renderElement.getBoundingClientRect();
    // 如果 id 为空
    // 1. 在日记文档下创建一个
    if (id === "") {
        console.log("id为空");
    }

    // 如果 id 不为空
    // 设置浮窗为目标id，并移动到指定位置显示
    toolbar.subElement.innerHTML = `<div data-drag="true"><div class="block__icons block__icons--menu fn__flex" style="border-radius: var(--b3-border-radius-b) var(--b3-border-radius-b) 0 0;">
    <span class="fn__flex-1 resize__move">
        批注
    </span>
    <span class="fn__space"></span>
    <button data-type="before" class="block__icon block__icon--show b3-tooltips b3-tooltips__nw${protyle.disabled ? " fn__none" : ""}" aria-label="${window.siyuan.languages["insert-before"]}"><svg><use xlink:href="#iconBefore"></use></svg></button>
    <span class="fn__space${protyle.disabled ? " fn__none" : ""}"></span>
    <button data-type="after" class="block__icon block__icon--show b3-tooltips b3-tooltips__nw${protyle.disabled ? " fn__none" : ""}" aria-label="${window.siyuan.languages["insert-after"]}"><svg><use xlink:href="#iconAfter"></use></svg></button>
    <span class="fn__space${protyle.disabled ? " fn__none" : ""}"></span>
    <button data-type="export" class="block__icon block__icon--show b3-tooltips b3-tooltips__nw" aria-label="${window.siyuan.languages.export} ${window.siyuan.languages.image}"><svg><use xlink:href="#iconImage"></use></svg></button>
    <span class="fn__space"></span>
    <button data-type="close" class="block__icon block__icon--show b3-tooltips b3-tooltips__nw" aria-label="${window.siyuan.languages.close}"><svg style="width: 10px;margin: 0 2px;"><use xlink:href="#iconClose"></use></svg></button>
</div><div class="mux-annotation-content"><div id="protyle"></div></div></div>`;

    // 加上事件
    const exportImg = () => {
        const msgId = showMessage(window.siyuan.languages.exporting, 0);
        if (renderElement.getAttribute("data-subtype") === "plantuml") {
            fetch(renderElement.querySelector("img").getAttribute("src")).then(function (response) {
                return response.blob();
            }).then(function (blob) {
                const formData = new FormData();
                formData.append("file", blob);
                formData.append("type", "image/png");
                fetchPost("/api/export/exportAsFile", formData, (response) => {
                    openByMobile(response.data.file);
                    hideMessage(msgId);
                });
            });
            return;
        }
        setTimeout(() => {
            addScript("/stage/protyle/js/html-to-image.min.js?v=1.11.13", "protyleHtml2image").then(() => {
                window.htmlToImage.toCanvas(renderElement).then((canvas) => {
                    canvas.toBlob((blob: Blob) => {
                        const formData = new FormData();
                        formData.append("file", blob);
                        formData.append("type", "image/png");
                        fetchPost("/api/export/exportAsFile", formData, (response) => {
                            openByMobile(response.data.file);
                            hideMessage(msgId);
                        });
                    });
                });
            });
        }, Constants.TIMEOUT_LOAD);
    };

    const headerElement = toolbar.subElement.querySelector(".block__icons");
    headerElement.addEventListener("click", (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const btnElement = hasClosestByClassName(target, "b3-tooltips");
        if (!btnElement) {
            if (event.detail === 2) {
                const pingElement = headerElement.querySelector('[data-type="pin"]');
                if (pingElement.getAttribute("aria-label") === window.siyuan.languages.unpin) {
                    pingElement.querySelector("svg use").setAttribute("xlink:href", "#iconPin");
                    pingElement.setAttribute("aria-label", window.siyuan.languages.pin);
                } else {
                    pingElement.querySelector("svg use").setAttribute("xlink:href", "#iconUnpin");
                    pingElement.setAttribute("aria-label", window.siyuan.languages.unpin);
                }
                event.preventDefault();
                event.stopPropagation();
            }
            return;
        }
        event.stopPropagation();
        switch (btnElement.getAttribute("data-type")) {
            case "close":
                this.subElement.querySelector('[data-type="pin"]').setAttribute("aria-label", window.siyuan.languages.pin);
                hideElements(["util"], protyle);
                break;
            case "pin":
                if (btnElement.getAttribute("aria-label") === window.siyuan.languages.unpin) {
                    btnElement.querySelector("svg use").setAttribute("xlink:href", "#iconPin");
                    btnElement.setAttribute("aria-label", window.siyuan.languages.pin);
                } else {
                    btnElement.querySelector("svg use").setAttribute("xlink:href", "#iconUnpin");
                    btnElement.setAttribute("aria-label", window.siyuan.languages.unpin);
                }
                break;
            case "refresh":
                btnElement.classList.toggle("block__icon--active");
                break;
            case "before":
                insertEmptyBlock(protyle, "beforebegin", id);
                hideElements(["util"], protyle);
                break;
            case "after":
                insertEmptyBlock(protyle, "afterend", id);
                hideElements(["util"], protyle);
                break;
            case "export":
                exportImg();
                break;
        }
    });

    // 挂载protyle
    const protyleElement = toolbar.subElement.querySelector("#protyle") as HTMLElement;
    new Protyle(protyle.app, protyleElement, {
        action: [],
        after: () => {
            console.log("after");
        },
        blockId: id,
        render: {
            breadcrumb: false
        },
    });
    const autoHeight = () => {
        protyleElement.style.height = protyleElement.scrollHeight + "px";
        if (toolbar.subElement.firstElementChild.getAttribute("data-drag") === "true") {
            if (protyleElement.getBoundingClientRect().bottom > window.innerHeight) {
                toolbar.subElement.style.top = window.innerHeight - toolbar.subElement.clientHeight + "px";
            }
            return;
        }
        const bottom = nodeRect.bottom === nodeRect.top ? nodeRect.bottom + 26 : nodeRect.bottom;
        if (toolbar.subElement.clientHeight <= window.innerHeight - bottom || toolbar.subElement.clientHeight <= nodeRect.top) {
            setPosition(toolbar.subElement, nodeRect.left, bottom, nodeRect.height || 26);
        } else {
            setPosition(toolbar.subElement, nodeRect.right, bottom);
        }
    };
    toolbar.subElement.style.zIndex = (++window.siyuan.zIndex).toString();
    toolbar.subElement.classList.remove("fn__none");
    toolbar.element.classList.add("fn__none");
    autoHeight();
}
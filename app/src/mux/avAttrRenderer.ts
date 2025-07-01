import { fetchSyncPost } from "../util/fetch";
import { genUUID } from "../util/genID";
import { av在客户端渲染template } from "./utils";

function extractIDFromInlineElement(inlineElement: HTMLElement) {
    // 1. 获取av id
    const avID = inlineElement.getAttribute("data-av-id");
    const blockID = inlineElement.parentElement.parentElement.parentElement.getAttribute("data-node-id");
    return {
        avID,
        blockID,
    };
}

function getExistingSlibingElement(inlineElement: HTMLElement, avID: string, blockID: string, avBlockID: string) {
    const avInlineElement = inlineElement.parentElement;
    // 检查是否存在目标元素
    const existingElement = avInlineElement.parentElement.querySelector(`[data-av-id="${avID}"][data-block-id="${blockID}"][data-av-block-id="${avBlockID}"]`);
    if (existingElement) {
        return existingElement;
    }

    // create slibing element
    // 使用HTML模板格式创建sibling元素
    const slibingElementTemplate = `
            <div class="mux-av-attr-inline protyle-custom" data-av-id="${avID}" data-block-id="${blockID}" data-av-block-id="${avBlockID}">
                <svg><use xlink:href="#iconDatabase"></use></svg>
                <span class="popover__block"></span>
            </div>
        `;
    // 将模板转换为DOM元素
    const template = document.createElement("template");
    template.innerHTML = slibingElementTemplate.trim();
    const slibingElement = template.content.firstChild as HTMLElement;
    // 将sibling元素插入到inlineElement之后
    avInlineElement.after(slibingElement);
    return slibingElement;
}


export function avAttrRender(protyleElement: HTMLElement) {
    // 1. 找到数据库的inline属性
    const inlineAvs = protyleElement.querySelectorAll(".protyle-attr--av");

    if (inlineAvs.length === 0) {
        return;
    }

    // 2. 挂载
    inlineAvs.forEach(async (inlineAv) => {
        const popoverBlocks = inlineAv.querySelectorAll(".popover__block");
        popoverBlocks.forEach(async (inlineElement) => {
            const { avID, blockID } = extractIDFromInlineElement(inlineElement as HTMLElement);
            if (!avID || !blockID) {
                console.warn("avID or blockID is not found");
                return;
            }
            // 3. 赋值
            const attributeViews = (await fetchSyncPost("/api/av/getAttributeViewKeys", {
                id: blockID,
            })).data;

            // 首先找到对应的attributeView
            const attributeView = attributeViews.find((view: any) => view.avID === avID);
            if (!attributeView) {
                console.warn("attributeView is not found");
                return;
            }

            // avID 是attributeView的id，avBlockID 是装载了attributeView的block的id
            const avBlockID = attributeView.blockIDs[0];
            const attrElement = getExistingSlibingElement(inlineElement as HTMLElement, avID, blockID, avBlockID);

            const avName = attributeView.avName;
            let inlineContent = "";
            const popoverBlock = attrElement.querySelector(".popover__block")!;
            const dataId = "temp-" + genUUID();
            popoverBlock.id = dataId;
            // 查找特定规则的列：以i: 开头的
            for (const column of attributeView.keyValues) {
                if (column.key.name.startsWith("i:") && column.key.type === "template") {
                    let value = column.values[0].template["content"];
                    // https://x.transmux.top/j/20250503191757-i6m4hjb 渲染 html=
                    value = av在客户端渲染template(value, dataId);
                    inlineContent += `${column.key.name.replace("i:", "")}${value}`;
                }
            }
            popoverBlock.innerHTML = `${avName} ${inlineContent}`;
        });
    });
}

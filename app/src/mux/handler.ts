import { fetchSyncPost } from "../util/fetch";

async function muxAVhandler_物品记录_打印(block_id: string) {
    const avID = "20250324180303-i0al422";
    console.log("muxAVhandler_物品记录_打印", block_id);
    // const attributeViews = (await fetchSyncPost("/api/av/getAttributeViewKeys", {
    //     id: block_id,
    // })).data;

    // // 首先找到对应的attributeView
    // const attributeView = attributeViews.find((view: any) => view.avID === avID);
    // if (!attributeView) {
    //     console.warn("attributeView is not found");
    //     return;
    // }

    // // avID 是attributeView的id，avBlockID 是装载了attributeView的block的id
    // const avBlockID = attributeView.blockIDs[0];
    // const attrElement = getExistingSlibingElement(inlineElement as HTMLElement, avID, blockID, avBlockID);

    // const avName = attributeView.avName;
    // let inlineContent = "";
    // // 查找特定规则的列：以i: 开头的
    // for (const column of attributeView.keyValues) {
    //     if (column.key.name.startsWith("i:") && column.key.type === "template") {
    //         const value = column.values[0].template["content"];
    //         inlineContent += `${column.key.name.replace("i:", "")}${value}`;
    //     }
    // }
}

window.muxAVhandler_物品记录_打印 = muxAVhandler_物品记录_打印

// 用来import这个文件...
export function foo() { }
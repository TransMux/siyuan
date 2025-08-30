import { App } from "..";
import { showMessage } from "../dialog/message";
import { openFileById } from "../editor/util";
import { initEditor } from "../mobile/settings/editor";
import { get } from "../mux/settings";
import { 获取当前ISO周数 } from "../mux/utils";
import { fetchPost, fetchSyncPost } from "./fetch";

function randomBlockId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let randomStr = '';
    for (let i = 0; i < 7; i++) {
        randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${new Date().toISOString().replace(/[-:.TZ]/g, "").substring(0, 14)}-${randomStr}`;
}


function updatedTime() {
    return new Date().toISOString().replace(/[-:.TZ]/g, "").substring(0, 14);
}



export function muxInsertAnnotationAfterBlock(blockId: string, idPath: string, content: string, callback: (newBlockId: string) => void) {
    // 检查 blockId 是否存在
    fetchSyncPost("/api/block/getBlockInfo", {
        id: blockId
    }).then((response) => {
        if (response.code === 0 && response.data) {
            fetchPost("/api/block/insertBlock", {
                previousID: blockId,
                dataType: "DOM",
                data: `<div data-marker="*" data-subtype="u" data-node-id="${randomBlockId()}" data-type="NodeListItem" class="li" updated="${updatedTime()}"><div class="protyle-action" draggable="true"><svg><use xlink:href="#iconDot"></use></svg></div><div data-node-id="${randomBlockId()}" data-type="NodeParagraph" class="p" updated="${updatedTime()}"><div contenteditable="true" spellcheck="false"><span data-type="file-annotation-ref" data-id="${idPath}">${content}</span></div><div class="protyle-attr" contenteditable="false">&ZeroWidthSpace;</div></div><div class="protyle-attr" contenteditable="false"></div></div>`
            },
                (response: any) => {
                    const newBlockId = response.data[0]["doOperations"][0]["id"];
                    callback(newBlockId);
                }
            );
        } else {
            showMessage(`Block with ID ${blockId} does not exist`, 1000, "error");
            callback("");
        }
    }).catch((error) => {
        showMessage(`Error checking block existence: ${error}`, 1000, "error");
        callback("");
    });
}


export function muxInsertPictureAnnotationAfterBlock(blockId: string, idPath: string, firstImageUrl: string, callback: (newBlockId: string) => void) {
    const nowTimestring = new Date().toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    
    // 检查 blockId 是否存在
    fetchSyncPost("/api/block/getBlockInfo", {
        id: blockId
    }).then((response) => {
        if (response.code === 0 && response.data) {
            fetchPost("/api/block/insertBlock", {
                previousID: blockId,
                dataType: "DOM",
                data: `<div data-marker="*" data-subtype="u" data-node-id="${randomBlockId()}" data-type="NodeListItem" class="li" updated="${updatedTime()}"><div class="protyle-action" draggable="true"><svg><use xlink:href="#iconDot"></use></svg></div><div data-node-id="${randomBlockId()}" data-node-index="1" data-type="NodeParagraph" class="p" updated="${updatedTime()}"><div contenteditable="true" spellcheck="false"><span data-type="file-annotation-ref" data-id="${idPath}">${nowTimestring}</span><span contenteditable="false" data-type="img" class="img"><span> </span><span><span class="protyle-action protyle-icons"><span class="protyle-icon protyle-icon--only"><svg class="svg"><use xlink:href="#iconMore"></use></svg></span></span><img src="${firstImageUrl}" data-src="${firstImageUrl}" loading="lazy"><span class="protyle-action__drag"></span><span class="protyle-action__title"><span></span></span></span><span> </span></span>&ZeroWidthSpace;</div><div class="protyle-attr" contenteditable="false"></div></div><div class="protyle-attr" contenteditable="false"></div></div>`
            },
                (response: any) => {
                    const newBlockId = response.data[0]["doOperations"][0]["id"];
                    callback(newBlockId);
                }
            );
        } else {
            showMessage(`Block with ID ${blockId} does not exist`, 1000, "error");
            callback("");
        }
    }).catch((error) => {
        showMessage(`Error checking block existence: ${error}`, 1000, "error");
        callback("");
    });
}


export function openUnreadArticle(app: App) {
    fetchSyncPost("/api/av/renderAttributeView", {
        id: "20250102171020-4cqqonx",
        pageSize: 5,
        groupPaging: {},
        viewID: "20250830162522-lzvfn3k",
        query: ""
    }).then((response) => {
        // 假设第一个row的值为id
        const blockIds = response.data.view.cards.map((item: any) => item.values[0].value.block.id)
        if (blockIds.length === 0) {
            showMessage("已无未读文章", 1000, "error");
            return;
        }
        for (const blockId of blockIds) {
            openFileById({
                app,
                id: blockId,
            });
        }
    });
}
import { App } from "..";
import { showMessage } from "../dialog/message";
import { openFileById } from "../editor/util";
import { 未读笔记本 } from "../mux/settings";
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
                dataType: "dom",
                data: `<div data-marker="*" data-subtype="u" data-node-id="${randomBlockId()}" data-type="NodeListItem" class="li" updated="${updatedTime()}"><div class="protyle-action" draggable="true"><svg><use xlink:href="#iconDot"></use></svg></div><div data-node-id="${randomBlockId()}" data-type="NodeParagraph" class="p block-focus" updated="${updatedTime()}"><div contenteditable="true" spellcheck="false"><span data-type="file-annotation-ref" data-id="${idPath}">${content}</span></div><div class="protyle-attr" contenteditable="false">&ZeroWidthSpace;</div></div><div class="protyle-attr" contenteditable="false">&ZeroWidthSpace;</div></div>`
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
                dataType: "dom",
                data: `<div data-marker="*" data-subtype="u" data-node-id="${randomBlockId()}" data-type="NodeListItem" class="li" updated="${updatedTime()}"><div class="protyle-action" draggable="true"><svg><use xlink:href="#iconDot"></use></svg></div><div data-node-id="${randomBlockId()}" data-node-index="1" data-type="NodeParagraph" class="p block-focus" updated="${updatedTime()}"><div contenteditable="true" spellcheck="false"><span data-type="file-annotation-ref" data-id="${idPath}">${nowTimestring}</span><span contenteditable="false" data-type="img" class="img"><span> </span><span><span class="protyle-action protyle-icons"><span class="protyle-icon protyle-icon--only"><svg class="svg"><use xlink:href="#iconMore"></use></svg></span></span><img src="${firstImageUrl}" data-src="${firstImageUrl}" loading="lazy"><span class="protyle-action__drag"></span><span class="protyle-action__title"><span></span></span></span><span> </span></span>&ZeroWidthSpace;</div><div class="protyle-attr" contenteditable="false">&ZeroWidthSpace;</div></div><div class="protyle-attr" contenteditable="false"></div></div>`
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


export function openUnreadWeekArticle(app: App) {
    const 当前周数 = 获取当前ISO周数();
    // const stmt = `SELECT * FROM blocks WHERE box = '${未读笔记本}' AND hpath like '/Week ${当前周数}%' limit 5`;
    fetchSyncPost("/api/filetree/listDocsByPath", {
        notebook: 未读笔记本,
        // TODO: 获取当前周数对应的文件id，难点：不在索引中，所以无法从数据库中sql获取
        path: `/20250331203117-2qmbks6.sy`,
    }).then((response) => {
        const blockIds = response.data.files.map((item: any) => item.id).slice(0, 5);
        console.log(blockIds);
        for (const blockId of blockIds) {
            openFileById({
                app,
                id: blockId,
            });
        }
    });
}
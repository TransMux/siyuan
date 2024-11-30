import { fetchPost } from "./fetch";

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
}

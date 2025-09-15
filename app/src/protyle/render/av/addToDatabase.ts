import {openSearchAV} from "./relation";
import {transaction} from "../../wysiwyg/transaction";
import {focusByRange} from "../../util/selection";
import {hasClosestBlock} from "../../util/hasClosest";
import * as dayjs from "dayjs";

export const addFilesToDatabase = (fileLiElements: Element[]) => {
    const srcs: IOperationSrcs[] = [];
    fileLiElements.forEach(item => {
        const id = item.getAttribute("data-node-id");
        if (id) {
            srcs.push({
                itemID: Lute.NewNodeID(),
                id,
                isDetached: false
            });
        }
    });
    if (srcs.length > 0) {
        openSearchAV("", fileLiElements[0] as HTMLElement, (listItemElement) => {
            const avID = listItemElement.dataset.avId;
            const viewID = listItemElement.dataset.viewId;
            transaction(undefined, [{
                action: "insertAttrViewBlock",
                ignoreDefaultFill: viewID ? false : true,
                viewID,
                avID,
                srcs,
                blockID: listItemElement.dataset.blockId
            }, {
                action: "doUpdateUpdated",
                id: listItemElement.dataset.blockId,
                data: dayjs().format("YYYYMMDDHHmmss"),
            }]);
        });
    }
};

export const addEditorToDatabase = (protyle: IProtyle, range: Range, type?: string) => {
    if ((range && protyle.title?.editElement?.contains(range.startContainer)) || type === "title") {
        // 20250102172746-yygfcw5
        openSearchAV("", protyle.breadcrumb.element, (listItemElement) => {
            const avID = listItemElement.dataset.avId;
            const viewID = listItemElement.dataset.viewId;
            transaction(protyle, [{
                action: "insertAttrViewBlock",
                ignoreDefaultFill: viewID ? false : true,
                viewID,
                avID,
                srcs: [{
                    itemID: Lute.NewNodeID(),
                    id: protyle.block.rootID,
                    isDetached: false
                }],
                blockID: listItemElement.dataset.blockId
            }, {
                action: "doUpdateUpdated",
                id: listItemElement.dataset.blockId,
                data: dayjs().format("YYYYMMDDHHmmss"),
            }], [{
                action: "removeAttrViewBlock",
                srcIDs: [protyle.block.rootID],
                avID,
            }]);
            focusByRange(range);
        });
    } else {
        let targetElement: HTMLElement;
        const ids: string[] = [];
        // [SiYuan在聚焦 / 查询属性视图的时候，针对列表，最好是针对列表项进行添加，而不是中间的段落，因为段落的块标无法选中](siyuan://blocks/20241030180132-2uc3epb)
        protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select").forEach((item: HTMLElement) => {
            let toBeAddItem = item;
            const parent = item.parentElement;

            if (parent.dataset.type === "NodeListItem") {
                // 找到parent中第一个data-type="NodeParagraph"的子元素
                const firstParagraphChild = Array.from(parent.children).find(
                    (child: HTMLElement) => child.dataset.type === "NodeParagraph"
                ) as HTMLElement;

                // 如果当前item是这个第一个NodeParagraph子元素
                if (firstParagraphChild === item) {
                    toBeAddItem = parent;
                }
            }

            if (!targetElement) {
                targetElement = toBeAddItem;
            }
            ids.push(toBeAddItem.getAttribute("data-node-id"));
        });
        if (!targetElement) {
            const nodeElement = hasClosestBlock(range.startContainer);
            if (nodeElement) {
                if (nodeElement.parentElement.dataset.type === "NodeListItem") {
                    targetElement = nodeElement.parentElement;
                } else {
                    targetElement = nodeElement;
                }
                ids.push(targetElement.getAttribute("data-node-id"));
            }
        }
        if (!targetElement) {
            targetElement = protyle.wysiwyg.element;
            ids.push(protyle.block.rootID);
        }
        openSearchAV("", targetElement, (listItemElement) => {
            const srcIDs: string[] = [];
            const srcs: IOperationSrcs[] = [];
            ids.forEach(item => {
                srcIDs.push(item);
                srcs.push({
                    itemID: Lute.NewNodeID(),
                    id: item,
                    isDetached: false
                });
            });
            const avID = listItemElement.dataset.avId;
            const viewID = listItemElement.dataset.viewId;
            transaction(protyle, [{
                action: "insertAttrViewBlock",
                ignoreDefaultFill: viewID ? false : true,
                viewID,
                avID,
                srcs,
                blockID: listItemElement.dataset.blockId
            }, {
                action: "doUpdateUpdated",
                id: listItemElement.dataset.blockId,
                data: dayjs().format("YYYYMMDDHHmmss"),
            }], [{
                action: "removeAttrViewBlock",
                srcIDs,
                avID,
            }]);
            focusByRange(range);
        });
    }
};

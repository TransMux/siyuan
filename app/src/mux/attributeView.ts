import { fetchPost, fetchSyncPost } from "../util/fetch";
import { getBlockInfoByIDSQL } from "./utils";

const 知识单元avID = "20250101005818-yb4stwq";
const 知识单元目录 = "20250101010126-gjm1cwx";

const 关系笔记avID = "20250101233539-mitgexi";
const 关系笔记目录 = "20250101010038-81wd8r8";

const 标签之树avID = "20250101001630-x03k4te";
const 标签之树目录 = "20250101005307-7384qo5";

const 外部输入avID = "20250102171020-4cqqonx";
const 外部输入目录 = "20250102171013-zzcyz96";

export async function afterAddedFileToDatabase(file_ids: Array<string>, avID: string) {
    console.log("添加文档到数据库callback: ", file_ids, avID);

    // 先检测是否已经在这个目录下了
    const filteredFileIDs = [];

    for (const file_id of file_ids) {
        const blockInfo = await getBlockInfoByIDSQL(file_id);

        // 如果 path 不包含任何关键字，则保留该 file_id
        if (![知识单元目录, 关系笔记目录, 标签之树目录].some(keyword => blockInfo[0].path.includes(keyword))) {
            filteredFileIDs.push(file_id);
        }
    }

    file_ids = filteredFileIDs;

    if (!file_ids || file_ids.length === 0) {
        return;
    }

    // 如果是添加到知识单元 / 关系笔记数据库，那么分别移动笔记到目录下
    if (avID === 知识单元avID) {
        fetchPost("/api/filetree/moveDocsByID", {
            "fromIDs": file_ids,
            "toID": 知识单元目录
        });
    }

    if (avID === 关系笔记avID) {
        fetchPost("/api/filetree/moveDocsByID", {
            "fromIDs": file_ids,
            "toID": 关系笔记目录
        });
    }

    if (avID === 标签之树avID) {
        fetchPost("/api/filetree/moveDocsByID", {
            "fromIDs": file_ids,
            "toID": 标签之树目录
        });
    }

    if (avID === 外部输入avID) {
        fetchPost("/api/filetree/moveDocsByID", {
            "fromIDs": file_ids,
            "toID": 外部输入目录
        });

        // 设置 icon
        for (const file_id of file_ids) {
            fetchPost("/api/attr/setBlockAttrs", {
                "id": file_id,
                "attrs": {
                    "icon": "2705"
                }
            });
        }
    }
}

const bindAttrInput = (inputElement: HTMLInputElement, id: string) => {
    inputElement.addEventListener("change", () => {
        fetchPost("/api/attr/setBlockAttrs", {
            id,
            attrs: {[inputElement.dataset.name]: inputElement.value}
        });
    });
};

export async function renderCustomAttr(customAttrElement: Element, block_id: string, focusName = "bookmark") {
    // javascript
    // export const openFileAttr = (attrs: IObject, focusName = "bookmark", protyle?: IProtyle) => {
    const response = await fetchSyncPost("/api/attr/getBlockAttrs", {id: block_id})
    const attrs = response.data;

    customAttrElement.innerHTML = `<div class="fn__flex-column">
    <div class="fn__flex-1 custom-attr" style="display: flex; align-items: center; gap: 10px;">
        <span style="flex-shrink: 0;">${window.siyuan.languages.name}：</span>
        <input spellcheck="${window.siyuan.config.editor.spellcheck}" class="b3-text-field fn__block" placeholder="${window.siyuan.languages.attrNameTip}" data-name="name">
        <span style="flex-shrink: 0;">${window.siyuan.languages.alias}：</span>
        <input spellcheck="${window.siyuan.config.editor.spellcheck}" class="b3-text-field fn__block" placeholder="${window.siyuan.languages.attrAliasTip}" data-name="alias">
    </div>
</div>`;

    (customAttrElement.querySelector('.b3-text-field[data-name="name"]') as HTMLInputElement).value = attrs.name || "";
    (customAttrElement.querySelector('.b3-text-field[data-name="alias"]') as HTMLInputElement).value = attrs.alias || "";

    customAttrElement.querySelectorAll(".b3-text-field").forEach((item: HTMLInputElement) => {
        if (focusName !== "av" && focusName === item.getAttribute("data-name")) {
            item.focus();
        }
        bindAttrInput(item, attrs.id);
    });
}
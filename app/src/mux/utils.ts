import { showMessage } from "../dialog/message";
import { hintMoveBlock } from "../protyle/hint/extend";
import { transaction } from "../protyle/wysiwyg/transaction";
import { fetchPost, fetchSyncPost } from "../util/fetch";
import { get } from "./settings";

export async function getBlockInfoByIDSQL(block_id: string) {
    const response = await fetchSyncPost("/api/query/sql", {
        "stmt": `SELECT * FROM blocks WHERE id = '${block_id}'`,
    });
    return response.data;
}

export async function 自定义获取av主键的所有值(data: any, callback: any) {
    // https://x.transmux.top/j/20250218023611-lr6dt1n
    const 标签之树ID = get<string>("标签之树avID");
    if (data.id === 标签之树ID) {
        data["pageSize"] = 10000;
    }

    const cb = (response: any) => {
        if (data.id === 标签之树ID) {
            let filteredValues: any[] = [];
            // https://x.transmux.top/j/20250312114757-uvd6k0j
            if (!response.data.rows.values) {
                // 没有检索出数据
                callback(response);
                return;
            }
            if (data.keyword === "") {
                // 默认展示全部根标签
                filteredValues = response.data.rows.values.filter((item: any) => item.block.content.match(/^[A-Z] - /));
            } else {
                // 先假设输入标签，那么检索所有 keyword+数字 - 的子标签
                filteredValues = response.data.rows.values.filter((item: any) => item.block.content.match(new RegExp(`^${data.keyword}\\d - `)));
            }
            if (filteredValues && filteredValues.length != 0) {
                response.data.rows.values = filteredValues;
            }
        }

        // 多级标签排序
        response.data.rows.values.sort((a: any, b: any) => {
            return a.block.content.localeCompare(b.block.content);
        });
        callback(response);
        return;
    }

    fetchPost("/api/av/getAttributeViewPrimaryKeyValues", data, cb);
}

export function 获取当前ISO周数() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    // 调整到最近的周四：ISO周从周一开始，但计算基于周四的年份
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    // 计算与年份第一天的差异（天数），然后计算周数
    // @ts-ignore
    const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNumber;
}

export async function 获取文件ID(笔记本ID: string, hpath: string) {
    // 保证文件存在
    const response = await fetchSyncPost("/api/query/sql", {
        "stmt": `SELECT * FROM blocks WHERE box = '${笔记本ID}' AND hpath = '${hpath}'`,
    });
    if (response.data.length === 0) {
        // 创建文档
        const createDocResponse = await fetchSyncPost("/api/filetree/createDocWithMd", {
            "notebook": 笔记本ID,
            "path": hpath,
            "markdown": "",
        });
        showMessage(`创建文档 ${hpath}`, 1000);
        return createDocResponse.data;
    }
    return response.data[0].id;
}

export async function 发送到第一个反链(selectsElement: Element[], protyle: IProtyle) {
    // 1. 获取第一个反链
    let firstBacklink = null;
    for (const element of selectsElement) {
        const backlink = element.querySelector('[data-type="block-ref"]');
        if (backlink) {
            firstBacklink = backlink;
            break;
        }
    }
    if (!firstBacklink) {
        showMessage("没有找到反链", 3000);
        return;
    }
    // 2. 移除所有指向这个data-id的反链
    const targetBlockID = firstBacklink.getAttribute("data-id");
    for (const element of selectsElement) {
        await 移除反链(element, targetBlockID, protyle);
    }
    hintMoveBlock(undefined, selectsElement, protyle, targetBlockID);
    showMessage("发送成功", 3000);
}

async function 移除反链(element: Element, targetBlockID: string, protyle: IProtyle) {
    // 查找元素 span data-type="block-ref" data-id="{blockId}"
    // 全部把这个元素直接去掉，只留下文本
    const refEls = element.querySelectorAll(
        `span[data-type*="block-ref"][data-id="${targetBlockID}"]`
    );
    // 替换文本
    refEls.forEach((el) => {
        // 如果data-subtype="d"，那么为静态锚文本，直接移除整个引用
        if (el.getAttribute("data-subtype") === "d") {
            el.remove();
        } else {
            let dataType = el.getAttribute("data-type");
            // 去除"block-ref"，并添加"u"
            let newTypes = dataType
                .split(" ")
                .filter((type) => type !== "block-ref"); // 移除"block-ref"
            newTypes.push("u"); // 添加"u"

            // 将修改后的数组转回字符串，并设置为新的data-type值
            el.setAttribute("data-type", newTypes.join(" "));

            // 移除data-id属性
            el.removeAttribute("data-id");

            // 移除data-subtype属性
            el.removeAttribute("data-subtype");
        }
    });

    transaction(protyle,
        [{
            action: "update",
            id: element.getAttribute("data-node-id"),
            data: element.outerHTML
        }]
    );
}
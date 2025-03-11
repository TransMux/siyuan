import { showMessage } from "../dialog/message";
import { fetchPost, fetchSyncPost } from "../util/fetch";
import { 标签之树avID } from "./settings";

export async function getBlockInfoByIDSQL(block_id: string) {
    const response = await fetchSyncPost("/api/query/sql", {
        "stmt": `SELECT * FROM blocks WHERE id = '${block_id}'`,
    });
    return response.data;
}

export async function 自定义获取av主键的所有值(data: any, callback: any) {
    // https://x.transmux.top/j/20250218023611-lr6dt1n
    if (data.id === 标签之树avID) {
        data["pageSize"] = 10000;
    }

    const cb = (response: any) => {
        if (data.id === 标签之树avID) {
            let filteredValues: any[] = [];
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
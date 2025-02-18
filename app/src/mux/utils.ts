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

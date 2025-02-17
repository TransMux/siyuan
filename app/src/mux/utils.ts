import { fetchPost, fetchSyncPost } from "../util/fetch";
import { 标签之树avID } from "./settings";

export async function getBlockInfoByIDSQL(block_id: string) {
    const response = await fetchSyncPost("/api/query/sql", {
        "stmt": `SELECT * FROM blocks WHERE id = '${block_id}'`,
    });
    return response.data;
}

export async function 自定义获取av主键的所有值(data: any, callback: any) {
    if (data.id === 标签之树avID) {
        data["pageSize"] = 10000;
    }

    const cb = (response: any) => {
        debugger;
        // 空query的时候，只给出 "* - ..." 一级标签
        if (data.keyword === "") {
            const filteredValues = response.data.rows.values.filter((item: any) => item.block.content.match(/^[A-Z] - /));
            response.data.rows.values = filteredValues;
        }
        // order by content
        response.data.rows.values.sort((a: any, b: any) => a.block.content.localeCompare(b.block.content));

        callback(response);
    }

    fetchPost("/api/av/getAttributeViewPrimaryKeyValues", data, cb);
}

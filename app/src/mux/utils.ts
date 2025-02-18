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
    // 克隆传入的日期对象
    const tmpDate = new Date();
    // 设置时间为午夜，避免时区影响
    tmpDate.setHours(0, 0, 0, 0);
    // 获取当前周的星期几（注意：JavaScript中星期日返回0，所以调整为7）
    const day = tmpDate.getDay() === 0 ? 7 : tmpDate.getDay();
    // 将日期调整到本周的星期四（ISO周数规则依据星期四）
    tmpDate.setDate(tmpDate.getDate() + 4 - day);
    // 计算当年第一周的开始日期，1月4日一定在第一周内
    const yearStart = new Date(tmpDate.getFullYear(), 0, 4);
    // 计算第一周偏移量（调整yearStart的星期数，同样星期日返回0时作调整）
    const yearStartDay = yearStart.getDay() === 0 ? 7 : yearStart.getDay();
    // 计算天数差，并转换为周数，注意除以一天的毫秒数
    const diffInDays = (tmpDate.getTime() - yearStart.getTime()) / 86400000;
    const week = Math.floor((diffInDays - (yearStartDay - 1)) / 7) + 1;
    return week;
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
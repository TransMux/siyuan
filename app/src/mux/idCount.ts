// https://x.transmux.top/j/20250502210411-dyq3auf
import { fetchPost } from "../util/fetch";
import { get } from "./settings";
import { extraDBSQL } from "./utils";

const _idClickCounts: Record<string, number> = {}
let isInit = false;

export const addIDClickCount = (id: string) => {
    initIDCount().then(() => {
        if (_idClickCounts[id]) {
            _idClickCounts[id]++
        } else {
            _idClickCounts[id] = 1
        }
        saveIDCount(id, _idClickCounts[id])
    })
}

export const getIDClickCounts = (id: string) => {
    initIDCount()
    return _idClickCounts[id] || 0
}

export async function initIDCount() {
    if (isInit) {
        return;
    }
    isInit = true;
    await extraDBSQL({
        stmt: `CREATE TABLE IF NOT EXISTS mux_id_count (
            id TEXT PRIMARY KEY,
            count INTEGER NOT NULL
        )`
    });
    // Load all settings into the cache
    const allSettings = await extraDBSQL({
        stmt: `SELECT * FROM mux_id_count`
    });
    allSettings.forEach(setting => {
        _idClickCounts[setting.id] = setting.count;
    });

    console.log("idCount initialized and loaded into cache");
}

export async function saveIDCount(id: string, count: number) {
    await extraDBSQL({
        stmt: `INSERT OR REPLACE INTO mux_id_count (id, count) VALUES (?, ?)`,
        args: [id, count]
    });
}

export const 带排序的searchRefBlock = (data?: any, cb?: (response: any) => void, headers?: any) => {
    fetchPost("/api/search/searchRefBlock", data, (response) => {
        if (get<boolean>("ref-search-order-by-frequency")) {
            response.data.blocks.sort((a: any, b: any) => {
                return getIDClickCounts(b.id) - getIDClickCounts(a.id)
            })
        }
        cb(response)
    }, headers)
}
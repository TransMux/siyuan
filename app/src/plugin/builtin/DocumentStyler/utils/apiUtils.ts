/**
 * API 调用工具函数
 */

import { fetchPost } from "../../../../util/fetch";

/**
 * 获取思源版本号
 * @returns 版本号字符串
 */
export async function getVersion(): Promise<string> {
    return new Promise((resolve) => {
        fetchPost("/api/system/version", {}, (response) => {
            if (response.code === 0 && response.data) {
                resolve(response.data);
            } else {
                resolve("0.0.0");
            }
        });
    });
}

/**
 * 批量更新块内容
 * @param updates 更新内容映射 {blockId: content}
 * @param dataType 数据类型 "dom" | "markdown"
 * @param useBulkApi 是否使用批量API
 */
export async function batchUpdateBlockContent(
    updates: Record<string, string>,
    dataType: "dom" | "markdown" = "dom",
    useBulkApi: boolean = false
): Promise<void> {
    const blockIds = Object.keys(updates);
    if (blockIds.length === 0) return;

    if (useBulkApi && blockIds.length > 1) {
        // 使用批量更新API（需要思源版本 >= 3.1.25）
        const transactions = blockIds.map(blockId => ({
            id: blockId,
            data: updates[blockId],
            dataType: dataType
        }));

        return new Promise((resolve, reject) => {
            fetchPost("/api/block/updateBlocks", {
                transactions: transactions
            }, (response) => {
                if (response.code === 0) {
                    resolve();
                } else {
                    reject(new Error(response.msg || "批量更新失败"));
                }
            });
        });
    } else {
        // 逐个更新
        const promises = blockIds.map(blockId => 
            updateBlockContent(blockId, updates[blockId], dataType)
        );
        await Promise.all(promises);
    }
}

/**
 * 更新单个块内容
 * @param blockId 块ID
 * @param content 内容
 * @param dataType 数据类型
 */
export function updateBlockContent(
    blockId: string, 
    content: string, 
    dataType: "dom" | "markdown" = "dom"
): Promise<void> {
    return new Promise((resolve, reject) => {
        fetchPost("/api/block/updateBlock", {
            id: blockId,
            data: content,
            dataType: dataType
        }, (response) => {
            if (response.code === 0) {
                resolve();
            } else {
                reject(new Error(response.msg || "更新块失败"));
            }
        });
    });
}

/**
 * 获取块属性
 * @param blockId 块ID
 * @returns 块属性对象
 */
export function getBlockAttrs(blockId: string): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
        fetchPost("/api/attr/getBlockAttrs", {
            id: blockId
        }, (response) => {
            if (response.code === 0) {
                resolve(response.data || {});
            } else {
                reject(new Error(response.msg || "获取块属性失败"));
            }
        });
    });
}

/**
 * 设置块属性
 * @param blockId 块ID
 * @param attrs 属性对象
 */
export function setBlockAttrs(blockId: string, attrs: Record<string, string>): Promise<void> {
    return new Promise((resolve, reject) => {
        fetchPost("/api/attr/setBlockAttrs", {
            id: blockId,
            attrs: attrs
        }, (response) => {
            if (response.code === 0) {
                resolve();
            } else {
                reject(new Error(response.msg || "设置块属性失败"));
            }
        });
    });
}

/**
 * 执行SQL查询
 * @param sql SQL语句
 * @returns 查询结果
 */
export function querySQL(sql: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
        fetchPost("/api/query/sql", {
            stmt: sql
        }, (response) => {
            if (response.code === 0) {
                resolve(response.data || []);
            } else {
                reject(new Error(response.msg || "SQL查询失败"));
            }
        });
    });
}

/**
 * 查询文档中的图片和表格
 * @param docId 文档ID
 * @returns 图片和表格信息数组
 */
export async function queryDocumentFigures(docId: string): Promise<any[]> {
    const results: any[] = [];
    
    try {
        // 查询表格块
        const tables = await querySQL(
            `SELECT id, type, subtype, content FROM blocks WHERE root_id = '${docId}' AND type = 't' ORDER BY sort`
        );
        results.push(...tables.map(item => ({ ...item, figureType: 'table' })));

        // 查询包含图片的段落块
        const images = await querySQL(
            `SELECT id, type, subtype, content FROM blocks WHERE root_id = '${docId}' AND type = 'p' AND markdown LIKE '![%' ORDER BY sort`
        );
        results.push(...images.map(item => ({ ...item, figureType: 'image' })));

    } catch (error) {
        console.error('查询文档图片表格失败:', error);
    }

    return results;
}

/**
 * 获取文档标题
 * @param docId 文档ID
 * @returns 文档标题
 */
export function getDocumentTitle(docId: string): Promise<string> {
    return new Promise((resolve) => {
        fetchPost("/api/block/getBlockInfo", {
            id: docId
        }, (response) => {
            if (response.code === 0 && response.data) {
                resolve(response.data.name || "未命名文档");
            } else {
                resolve("未命名文档");
            }
        });
    });
}

/**
 * 获取块信息
 * @param blockId 块ID
 * @returns 块信息
 */
export function getBlockInfo(blockId: string): Promise<any> {
    return new Promise((resolve, reject) => {
        fetchPost("/api/block/getBlockInfo", {
            id: blockId
        }, (response) => {
            if (response.code === 0) {
                resolve(response.data);
            } else {
                reject(new Error(response.msg || "获取块信息失败"));
            }
        });
    });
}

/**
 * 检查API是否可用
 * @param apiPath API路径
 * @returns 是否可用
 */
export async function checkApiAvailable(apiPath: string): Promise<boolean> {
    try {
        const response = await fetch(apiPath, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * 获取文档大纲
 * @param docId 文档ID
 * @param preview 是否为预览模式
 * @returns 大纲数据
 */
export function getDocumentOutline(docId: string, preview: boolean = false): Promise<any[]> {
    return new Promise((resolve, reject) => {
        fetchPost("/api/outline/getDocOutline", {
            id: docId,
            preview: preview
        }, (response) => {
            if (response.code === 0) {
                resolve(response.data || []);
            } else {
                reject(new Error(response.msg || "获取文档大纲失败"));
            }
        });
    });
}

/**
 * 安全地执行API调用
 * @param apiCall API调用函数
 * @param fallback 失败时的回调函数
 * @returns API调用结果
 */
export async function safeApiCall<T>(
    apiCall: () => Promise<T>,
    fallback?: (error: Error) => T
): Promise<T | undefined> {
    try {
        return await apiCall();
    } catch (error) {
        console.error('API调用失败:', error);
        if (fallback) {
            return fallback(error as Error);
        }
        return undefined;
    }
}

/**
 * 获取文档属性
 * @param docId 文档ID
 * @param attrName 属性名
 * @returns 属性值
 */
export async function getDocumentAttr(docId: string, attrName: string): Promise<string | null> {
    try {
        const attrs = await getBlockAttrs(docId);
        return attrs[attrName] || null;
    } catch (error) {
        console.error('获取文档属性失败:', error);
        return null;
    }
}

/**
 * 设置文档属性
 * @param docId 文档ID
 * @param attrs 属性对象
 * @returns 是否成功
 */
export async function setDocumentAttr(docId: string, attrs: Record<string, string>): Promise<boolean> {
    try {
        await setBlockAttrs(docId, attrs);
        return true;
    } catch (error) {
        console.error('设置文档属性失败:', error);
        return false;
    }
}



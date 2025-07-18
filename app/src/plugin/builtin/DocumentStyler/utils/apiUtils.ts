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
            `SELECT id, type, subtype, content FROM blocks WHERE root_id = '${docId}' AND type = 't'`
        );
        results.push(...tables.map(item => ({ ...item, figureType: 'table' })));

        // 查询包含图片的段落块
        const images = await querySQL(
            `SELECT id, type, subtype, content FROM blocks WHERE root_id = '${docId}' AND type = 'p' AND markdown LIKE '![%'`
        );
        results.push(...images.map(item => ({ ...item, figureType: 'image' })));

    } catch (error) {
        console.error('查询文档图片表格失败:', error);
    }

    return results;
}

/**
 * 获取文档中所有块的真实顺序映射
 * @param protyle 编辑器实例
 * @returns 块ID到真实顺序的映射
 */
export function getDocumentBlockOrderFromDOM(protyle: any): Record<string, number> {
    const orderMap: Record<string, number> = {};

    if (!protyle?.wysiwyg?.element) {
        return orderMap;
    }

    // 遍历DOM中所有具有data-node-id属性的块级元素
    const blockElements = protyle.wysiwyg.element.querySelectorAll('[data-node-id]');

    blockElements.forEach((element: Element, index: number) => {
        const nodeId = element.getAttribute('data-node-id');
        if (nodeId) {
            orderMap[nodeId] = index;
        }
    });

    return orderMap;
}

/**
 * 获取文档的完整内容和结构
 * @param docId 文档ID
 * @returns 文档的完整DOM内容
 */
export async function getDocumentFullContent(docId: string): Promise<string> {
    return new Promise((resolve, reject) => {
        fetchPost("/api/filetree/getDoc", {
            id: docId,
            mode: 3, // 上下都加载
            size: 2147483647, // 最大值，加载所有内容
            isBacklink: false
        }, (response) => {
            if (response.code === 0) {
                resolve(response.data.content || "");
            } else {
                reject(new Error(response.msg || "获取文档内容失败"));
            }
        });
    });
}

/**
 * 从HTML内容中提取块的真实顺序
 * @param htmlContent 文档的HTML内容
 * @returns 块ID到真实顺序的映射
 */
export function extractBlockOrderFromHTML(htmlContent: string): Record<string, number> {
    const orderMap: Record<string, number> = {};

    try {
        // 创建一个临时的DOM解析器
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        // 查找所有具有data-node-id属性的元素
        const blockElements = doc.querySelectorAll('[data-node-id]');

        blockElements.forEach((element, index) => {
            const nodeId = element.getAttribute('data-node-id');
            if (nodeId) {
                orderMap[nodeId] = index;
            }
        });

        console.log('CrossReference: 从HTML提取的块顺序:', Object.keys(orderMap).length, '个块');

    } catch (error) {
        console.error('解析HTML内容失败:', error);
    }

    return orderMap;
}

/**
 * 获取文档中所有块的真实顺序映射（通过API）
 * @param docId 文档ID
 * @returns 块ID到真实顺序的映射
 */
export async function getDocumentBlockOrder(docId: string): Promise<Record<string, number>> {
    try {
        // 首先尝试通过API获取完整文档内容
        const htmlContent = await getDocumentFullContent(docId);
        if (htmlContent) {
            const orderMap = extractBlockOrderFromHTML(htmlContent);
            if (Object.keys(orderMap).length > 0) {
                console.log('CrossReference: 成功通过API获取文档块顺序');
                return orderMap;
            }
        }

        // 如果API方法失败，回退到SQL查询
        console.log('CrossReference: API方法失败，回退到SQL查询');
        const allBlocks = await querySQL(
            `SELECT id FROM blocks WHERE root_id = '${docId}' AND type != 'd' ORDER BY sort`
        );

        const orderMap: Record<string, number> = {};
        allBlocks.forEach((block, index) => {
            orderMap[block.id] = index;
        });

        return orderMap;
    } catch (error) {
        console.error('获取文档块顺序失败:', error);
        return {};
    }
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



import {Constants} from "../constants";
/// #if !BROWSER
import {ipcRenderer} from "electron";
/// #endif
import {processMessage} from "./processMessage";
import {kernelError} from "../dialog/processSystem";
import { get } from "../mux/settings";

// Cache duration constant (milliseconds)
const CACHE_DURATION_MS = 100;

// Determine if a URL should bypass cache (e.g., transactions)
function shouldBypassCache(url: string): boolean {
    return url.includes('transactions');
}

// Generate a cache key for URL and data, or null if not cacheable
function createCacheKey(url: string, data?: any): string | null {
    // feature toggle for fetch caching
    if (!get<boolean>("fetch-request-cache") || shouldBypassCache(url) || data instanceof FormData) {
        return null;
    }
    try {
        return `${url}::${JSON.stringify(data ?? '')}`;
    } catch {
        return null;
    }
}

// Helper to set cache entry with automatic cleanup after duration
function cacheEntryWithTimeout<T>(cache: Map<string, T>, key: string, entry: T, duration: number) {
    cache.set(key, entry);
    setTimeout(() => {
        if (cache.get(key) === entry) {
            cache.delete(key);
        }
    }, duration);
}

// Cache entry type for fetchPost
interface FetchPostCacheEntry {
    timestamp: number;
    ready: boolean;
    result?: IWebSocketData | string;
    callbacks: Array<(resp: IWebSocketData | string) => void>;
}
const fetchPostCache: Map<string, FetchPostCacheEntry> = new Map();

// Add caching constants and map for fetchSyncPost responses
interface FetchSyncPostCacheEntry {
    timestamp: number;
    promise: Promise<IWebSocketData>;
}
const fetchSyncPostCache: Map<string, FetchSyncPostCacheEntry> = new Map();

export const fetchPost = (url: string, data?: any, cb?: (response: IWebSocketData | string) => void, headers?: IObject) => {
    // Prepare cache key or bypass caching
    const cacheKey = createCacheKey(url, data);
    if (cacheKey) {
        const existing = fetchPostCache.get(cacheKey);
        if (existing && Date.now() - existing.timestamp < CACHE_DURATION_MS) {
            if (existing.ready) {
                cb?.(existing.result!);
            } else if (cb) {
                existing.callbacks.push(cb);
            }
            return;
        }
        fetchPostCache.delete(cacheKey);
    }
    // Initialize new cache entry
    const now = Date.now();
    const entry: FetchPostCacheEntry = { timestamp: now, ready: false, callbacks: [] };
    if (cacheKey) {
        cacheEntryWithTimeout(fetchPostCache, cacheKey, entry, CACHE_DURATION_MS);
    }
    const init: RequestInit = {
        method: "POST",
    };
    if (data) {
        if (["/api/search/searchRefBlock", "/api/graph/getGraph", "/api/graph/getLocalGraph",
            "/api/block/getRecentUpdatedBlocks", "/api/search/fullTextSearchBlock"].includes(url)) {
            window.siyuan.reqIds[url] = new Date().getTime();
            if (data.type === "local" && url === "/api/graph/getLocalGraph") {
                // 当打开文档A的关系图、关系图、文档A后刷新，由于防止请求重复处理，文档A关系图无法渲染。
            } else {
                data.reqId = window.siyuan.reqIds[url];
            }
        }
        // 并发导出后端接受顺序不一致
        if (url === "/api/transactions") {
            data.reqId = new Date().getTime();
        }
        if (data instanceof FormData) {
            init.body = data;
        } else {
            init.body = JSON.stringify(data);
        }
    }
    if (headers) {
        init.headers = headers;
    }
    fetch(url, init).then((response) => {
        switch (response.status) {
            case 403:
            case 404:
                return {
                    data: null,
                    msg: response.statusText,
                    code: -response.status,
                } as IWebSocketData;
            default:
                if (response.headers.get("content-type")?.indexOf("application/json") > -1) {
                    return response.json();
                } else {
                    return response.text();
                }
        }
    }).then((response: IWebSocketData) => {
        if (typeof response === "string") {
            if (cb) {
                cb(response);
            }
            return;
        }
        if (["/api/search/searchRefBlock", "/api/graph/getGraph", "/api/graph/getLocalGraph",
            "/api/block/getRecentUpdatedBlocks", "/api/search/fullTextSearchBlock"].includes(url)) {
            if (response.data.reqId && window.siyuan.reqIds[url] && window.siyuan.reqIds[url] > response.data.reqId) {
                return;
            }
        }
        if (typeof response === "object" && typeof response.msg === "string" && typeof response.code === "number") {
            if (processMessage(response) && cb) {
                cb(response);
            }
        } else if (cb) {
            cb(response);
        }
        // flush queued callbacks for cached requests
        if (cacheKey) {
            entry.result = response;
            entry.ready = true;
            entry.callbacks.forEach(callback => callback(response));
            entry.callbacks = [];
        }
    }).catch((e) => {
        console.warn("fetch post failed [" + e + "], url [" + url + "]");
        if (url === "/api/transactions" && (e.message === "Failed to fetch" || e.message === "Unexpected end of JSON input")) {
            kernelError();
            return;
        }
        /// #if !BROWSER
        if (url === "/api/system/exit" || url === "/api/system/setWorkspaceDir" || (
            ["/api/system/setUILayout"].includes(url) && data.errorExit // 内核中断，点关闭处理
        )) {
            ipcRenderer.send(Constants.SIYUAN_QUIT, location.port);
        }
        /// #endif
    });
};

export const fetchSyncPost = async (url: string, data?: any) => {
    // Compute cache key or bypass cache
    const cacheKey = createCacheKey(url, data);
    const now = Date.now();
    if (cacheKey) {
        const existing = fetchSyncPostCache.get(cacheKey);
        if (existing && now - existing.timestamp < CACHE_DURATION_MS) {
            return existing.promise;
        }
        fetchSyncPostCache.delete(cacheKey);
    }
    // Perform network request
    const promise = (async () => {
        const init: RequestInit = { method: "POST" };
        if (data) {
            init.body = data instanceof FormData ? data : JSON.stringify(data);
        }
        const res = await fetch(url, init);
        const res2 = (await res.json()) as IWebSocketData;
        processMessage(res2);
        return res2;
    })();
    // Cache the promise result if applicable
    if (cacheKey) {
        cacheEntryWithTimeout(fetchSyncPostCache, cacheKey, { timestamp: now, promise }, CACHE_DURATION_MS);
    }
    return promise;
};

export const fetchGet = (url: string, cb: (response: IWebSocketData | IObject | string) => void) => {
    fetch(url).then((response) => {
        if (response.headers.get("content-type")?.indexOf("application/json") > -1) {
            return response.json();
        } else {
            return response.text();
        }
    }).then((response) => {
        cb(response);
    });
};

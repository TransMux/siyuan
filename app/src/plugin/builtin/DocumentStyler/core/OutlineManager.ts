/**
 * 大纲管理器
 * 负责获取和管理文档大纲数据
 */

import { IModule } from "../types";
import { getDocumentOutline } from "../utils/apiUtils";
import { 
    IOutlineNode, 
    IHeadingNumberMap, 
    parseOutlineToNumberMap,
    hasHeadingsInOutline,
    getHeadingNodesFromOutline
} from "../utils/outlineUtils";

export class OutlineManager implements IModule {
    private outlineCache: Map<string, IOutlineNode[]> = new Map();
    private numberMapCache: Map<string, IHeadingNumberMap> = new Map();
    private lastUpdateTime: Map<string, number> = new Map();
    
    // 缓存有效期（毫秒）
    private static readonly CACHE_DURATION = 30000; // 30秒

    async init(): Promise<void> {
        // 初始化时清空缓存
        this.clearCache();
    }

    destroy(): void {
        this.clearCache();
    }

    /**
     * 获取文档大纲数据
     * @param docId 文档ID
     * @param forceRefresh 是否强制刷新缓存
     * @returns 大纲数据
     */
    async getOutline(docId: string, forceRefresh: boolean = false): Promise<IOutlineNode[]> {
        // 检查缓存
        if (!forceRefresh && this.isCacheValid(docId)) {
            const cached = this.outlineCache.get(docId);
            if (cached) {
                return cached;
            }
        }

        try {
            // 从API获取大纲数据
            const outlineData = await getDocumentOutline(docId, false);
            
            // 更新缓存
            this.outlineCache.set(docId, outlineData);
            this.lastUpdateTime.set(docId, Date.now());
            
            return outlineData;
        } catch (error) {
            console.error('获取文档大纲失败:', error);
            // 如果有缓存数据，返回缓存
            const cached = this.outlineCache.get(docId);
            if (cached) {
                console.warn('使用缓存的大纲数据');
                return cached;
            }
            throw error;
        }
    }

    /**
     * 获取标题编号映射
     * @param docId 文档ID
     * @param formats 编号格式配置
     * @param useChineseNumbers 是否使用中文数字配置
     * @param forceRefresh 是否强制刷新
     * @returns 标题编号映射
     */
    async getHeadingNumberMap(
        docId: string,
        formats: string[],
        useChineseNumbers: boolean[],
        forceRefresh: boolean = false
    ): Promise<IHeadingNumberMap> {
        const cacheKey = `${docId}_${JSON.stringify(formats)}_${JSON.stringify(useChineseNumbers)}`;
        
        // 检查缓存
        if (!forceRefresh && this.isNumberMapCacheValid(cacheKey)) {
            const cached = this.numberMapCache.get(cacheKey);
            if (cached) {
                return cached;
            }
        }

        try {
            // 获取大纲数据
            const outlineData = await this.getOutline(docId, forceRefresh);
            
            // 解析生成编号映射
            const numberMap = parseOutlineToNumberMap(outlineData, formats, useChineseNumbers);
            
            // 更新缓存
            this.numberMapCache.set(cacheKey, numberMap);
            
            return numberMap;
        } catch (error) {
            console.error('生成标题编号映射失败:', error);
            throw error;
        }
    }

    /**
     * 检查文档是否包含标题
     * @param docId 文档ID
     * @returns 是否包含标题
     */
    async hasHeadings(docId: string): Promise<boolean> {
        try {
            const outlineData = await this.getOutline(docId);
            return hasHeadingsInOutline(outlineData);
        } catch (error) {
            console.error('检查文档标题失败:', error);
            return false;
        }
    }

    /**
     * 获取文档中的所有标题节点
     * @param docId 文档ID
     * @returns 标题节点列表
     */
    async getHeadingNodes(docId: string): Promise<IOutlineNode[]> {
        try {
            const outlineData = await this.getOutline(docId);
            return getHeadingNodesFromOutline(outlineData);
        } catch (error) {
            console.error('获取标题节点失败:', error);
            return [];
        }
    }

    /**
     * 获取文档的标题统计信息
     * @param docId 文档ID
     * @returns 标题统计信息
     */
    async getHeadingStats(docId: string): Promise<{
        totalCount: number;
        levelCounts: Record<number, number>;
        maxLevel: number;
        minLevel: number;
    }> {
        try {
            const headingNodes = await this.getHeadingNodes(docId);
            const levelCounts: Record<number, number> = {};
            let maxLevel = 0;
            let minLevel = 7;

            headingNodes.forEach(node => {
                const level = parseInt(node.subType.substring(1));
                if (level >= 1 && level <= 6) {
                    levelCounts[level] = (levelCounts[level] || 0) + 1;
                    maxLevel = Math.max(maxLevel, level);
                    minLevel = Math.min(minLevel, level);
                }
            });

            return {
                totalCount: headingNodes.length,
                levelCounts,
                maxLevel: maxLevel || 0,
                minLevel: minLevel === 7 ? 0 : minLevel
            };
        } catch (error) {
            console.error('获取标题统计失败:', error);
            return {
                totalCount: 0,
                levelCounts: {},
                maxLevel: 0,
                minLevel: 0
            };
        }
    }

    /**
     * 刷新文档大纲缓存
     * @param docId 文档ID
     */
    async refreshOutline(docId: string): Promise<void> {
        try {
            await this.getOutline(docId, true);
            // 清除相关的编号映射缓存
            this.clearNumberMapCacheForDoc(docId);
        } catch (error) {
            console.error('刷新大纲缓存失败:', error);
        }
    }

    /**
     * 批量刷新多个文档的大纲缓存
     * @param docIds 文档ID列表
     */
    async batchRefreshOutlines(docIds: string[]): Promise<void> {
        const promises = docIds.map(docId => this.refreshOutline(docId));
        await Promise.allSettled(promises);
    }

    /**
     * 检查大纲缓存是否有效
     * @param docId 文档ID
     * @returns 是否有效
     */
    private isCacheValid(docId: string): boolean {
        const lastUpdate = this.lastUpdateTime.get(docId);
        if (!lastUpdate) return false;
        
        return Date.now() - lastUpdate < OutlineManager.CACHE_DURATION;
    }

    /**
     * 检查编号映射缓存是否有效
     * @param cacheKey 缓存键
     * @returns 是否有效
     */
    private isNumberMapCacheValid(cacheKey: string): boolean {
        // 编号映射缓存依赖于大纲缓存，所以检查对应文档的大纲缓存是否有效
        const docId = cacheKey.split('_')[0];
        return this.isCacheValid(docId);
    }

    /**
     * 清空所有缓存
     */
    private clearCache(): void {
        this.outlineCache.clear();
        this.numberMapCache.clear();
        this.lastUpdateTime.clear();
    }

    /**
     * 清除指定文档的编号映射缓存
     * @param docId 文档ID
     */
    private clearNumberMapCacheForDoc(docId: string): void {
        const keysToDelete: string[] = [];
        for (const key of this.numberMapCache.keys()) {
            if (key.startsWith(`${docId}_`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.numberMapCache.delete(key));
    }

    /**
     * 清除过期的缓存
     */
    private cleanExpiredCache(): void {
        const now = Date.now();
        const expiredDocs: string[] = [];

        for (const [docId, lastUpdate] of this.lastUpdateTime.entries()) {
            if (now - lastUpdate >= OutlineManager.CACHE_DURATION) {
                expiredDocs.push(docId);
            }
        }

        expiredDocs.forEach(docId => {
            this.outlineCache.delete(docId);
            this.lastUpdateTime.delete(docId);
            this.clearNumberMapCacheForDoc(docId);
        });
    }

    /**
     * 获取缓存统计信息
     * @returns 缓存统计
     */
    getCacheStats(): {
        outlineCacheSize: number;
        numberMapCacheSize: number;
        validCacheCount: number;
    } {
        this.cleanExpiredCache();
        
        let validCacheCount = 0;
        for (const docId of this.outlineCache.keys()) {
            if (this.isCacheValid(docId)) {
                validCacheCount++;
            }
        }

        return {
            outlineCacheSize: this.outlineCache.size,
            numberMapCacheSize: this.numberMapCache.size,
            validCacheCount
        };
    }
}

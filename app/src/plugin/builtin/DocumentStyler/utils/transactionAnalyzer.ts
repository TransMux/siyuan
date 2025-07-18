/**
 * Transaction事件分析器
 * 用于分析WebSocket transaction事件，识别需要更新的内容
 */

/**
 * Transaction操作接口
 */
export interface ITransactionOperation {
    /** 操作类型 */
    action: string;
    /** 块ID */
    id?: string;
    /** 操作数据 */
    data?: string;
    /** 父块ID */
    parentID?: string;
    /** 前一个兄弟块ID */
    previousID?: string;
    /** 下一个兄弟块ID */
    nextID?: string;
    /** 属性 */
    attrs?: Record<string, string>;
}

/**
 * Transaction数据接口
 */
export interface ITransactionData {
    /** 执行操作列表 */
    doOperations: ITransactionOperation[];
    /** 撤销操作列表 */
    undoOperations?: ITransactionOperation[];
}

/**
 * 分析结果接口
 */
export interface ITransactionAnalysisResult {
    /** 是否需要更新标题编号 */
    needUpdateHeadings: boolean;
    /** 是否需要更新图片表格索引 */
    needUpdateFigures: boolean;
    /** 受影响的文档ID列表 */
    affectedDocIds: string[];
    /** 变更的标题块ID列表 */
    changedHeadingIds: string[];
    /** 变更的图片块ID列表 */
    changedImageIds: string[];
    /** 变更的表格块ID列表 */
    changedTableIds: string[];
    /** 变更类型 */
    changeTypes: string[];
}

/**
 * Transaction分析器类
 */
export class TransactionAnalyzer {
    /**
     * 分析transaction事件数据
     * @param eventData WebSocket事件数据
     * @returns 分析结果
     */
    static analyzeTransactionEvent(eventData: any): ITransactionAnalysisResult {
        const result: ITransactionAnalysisResult = {
            needUpdateHeadings: false,
            needUpdateFigures: false,
            affectedDocIds: [],
            changedHeadingIds: [],
            changedImageIds: [],
            changedTableIds: [],
            changeTypes: []
        };

        // 检查事件数据格式
        if (!eventData || !eventData.data || !Array.isArray(eventData.data)) {
            return result;
        }

        // 分析每个transaction
        for (const transaction of eventData.data) {
            if (!transaction.doOperations || !Array.isArray(transaction.doOperations)) {
                continue;
            }

            this.analyzeTransaction(transaction, result);
        }

        // 去重
        result.affectedDocIds = [...new Set(result.affectedDocIds)];
        result.changedHeadingIds = [...new Set(result.changedHeadingIds)];
        result.changedImageIds = [...new Set(result.changedImageIds)];
        result.changedTableIds = [...new Set(result.changedTableIds)];
        result.changeTypes = [...new Set(result.changeTypes)];

        return result;
    }

    /**
     * 分析单个transaction
     * @param transaction Transaction数据
     * @param result 分析结果（会被修改）
     */
    private static analyzeTransaction(transaction: ITransactionData, result: ITransactionAnalysisResult): void {
        for (const operation of transaction.doOperations) {
            this.analyzeOperation(operation, result);
        }
    }

    /**
     * 分析单个操作
     * @param operation 操作数据
     * @param result 分析结果（会被修改）
     */
    private static analyzeOperation(operation: ITransactionOperation, result: ITransactionAnalysisResult): void {
        const { action, id, data, attrs } = operation;

        // 记录变更类型
        if (action && !result.changeTypes.includes(action)) {
            result.changeTypes.push(action);
        }

        switch (action) {
            case 'insert':
                this.handleInsertOperation(operation, result);
                break;
            case 'update':
                this.handleUpdateOperation(operation, result);
                break;
            case 'delete':
                this.handleDeleteOperation(operation, result);
                break;
            case 'move':
                this.handleMoveOperation(operation, result);
                break;
            case 'setAttrs':
                this.handleSetAttrsOperation(operation, result);
                break;
            default:
                // 其他操作类型的通用处理
                if (id && data) {
                    this.analyzeBlockData(id, data, result);
                }
                break;
        }
    }

    /**
     * 处理插入操作
     */
    private static handleInsertOperation(operation: ITransactionOperation, result: ITransactionAnalysisResult): void {
        const { id, data } = operation;
        if (id && data) {
            this.analyzeBlockData(id, data, result);
            this.extractDocId(data, result);
        }
    }

    /**
     * 处理更新操作
     */
    private static handleUpdateOperation(operation: ITransactionOperation, result: ITransactionAnalysisResult): void {
        const { id, data } = operation;
        if (id && data) {
            this.analyzeBlockData(id, data, result);
            this.extractDocId(data, result);
        }
    }

    /**
     * 处理删除操作
     */
    private static handleDeleteOperation(operation: ITransactionOperation, result: ITransactionAnalysisResult): void {
        const { id, data } = operation;
        if (id && data) {
            // 删除操作也需要分析，因为可能影响编号
            this.analyzeBlockData(id, data, result);
            this.extractDocId(data, result);
        }
    }

    /**
     * 处理移动操作
     */
    private static handleMoveOperation(operation: ITransactionOperation, result: ITransactionAnalysisResult): void {
        const { id, data } = operation;
        if (id && data) {
            // 移动操作可能影响标题层级结构
            this.analyzeBlockData(id, data, result);
            this.extractDocId(data, result);
        }
    }

    /**
     * 处理属性设置操作
     */
    private static handleSetAttrsOperation(operation: ITransactionOperation, result: ITransactionAnalysisResult): void {
        const { id, attrs } = operation;
        if (id && attrs) {
            // 属性变更可能影响块类型
            // 这里可以根据需要添加更具体的逻辑
        }
    }

    /**
     * 分析块数据
     * @param blockId 块ID
     * @param blockData 块数据（HTML字符串）
     * @param result 分析结果
     */
    private static analyzeBlockData(blockId: string, blockData: string, result: ITransactionAnalysisResult): void {
        // 检查是否是标题块
        if (this.isHeadingBlock(blockData)) {
            result.needUpdateHeadings = true;
            result.changedHeadingIds.push(blockId);
        }

        // 检查是否包含图片
        if (this.hasImageContent(blockData)) {
            result.needUpdateFigures = true;
            result.changedImageIds.push(blockId);
        }

        // 检查是否是表格块
        if (this.isTableBlock(blockData)) {
            result.needUpdateFigures = true;
            result.changedTableIds.push(blockId);
        }
    }

    /**
     * 提取文档ID
     * @param blockData 块数据
     * @param result 分析结果
     */
    private static extractDocId(blockData: string, result: ITransactionAnalysisResult): void {
        // 尝试从data-root-id属性中提取文档ID
        const rootIdMatch = blockData.match(/data-root-id="([^"]+)"/);
        if (rootIdMatch && rootIdMatch[1]) {
            result.affectedDocIds.push(rootIdMatch[1]);
        }
    }

    /**
     * 检查是否是标题块
     * @param blockData 块数据
     * @returns 是否是标题块
     */
    private static isHeadingBlock(blockData: string): boolean {
        return /data-type="NodeHeading"/.test(blockData) || /data-subtype="h[1-6]"/.test(blockData);
    }

    /**
     * 检查是否包含图片内容
     * @param blockData 块数据
     * @returns 是否包含图片
     */
    private static hasImageContent(blockData: string): boolean {
        return /<img[^>]*>/.test(blockData) || /!\[.*\]\(.*\)/.test(blockData);
    }

    /**
     * 检查是否是表格块
     * @param blockData 块数据
     * @returns 是否是表格块
     */
    private static isTableBlock(blockData: string): boolean {
        return /data-type="NodeTable"/.test(blockData) || /<table[^>]*>/.test(blockData);
    }

    /**
     * 检查是否需要更新
     * @param analysisResult 分析结果
     * @returns 是否需要更新
     */
    static needsUpdate(analysisResult: ITransactionAnalysisResult): boolean {
        return analysisResult.needUpdateHeadings || analysisResult.needUpdateFigures;
    }

    /**
     * 获取需要更新的文档ID列表
     * @param analysisResult 分析结果
     * @returns 文档ID列表
     */
    static getAffectedDocuments(analysisResult: ITransactionAnalysisResult): string[] {
        return analysisResult.affectedDocIds;
    }

    /**
     * 检查是否只是标题内容变更（不影响结构）
     * @param analysisResult 分析结果
     * @returns 是否只是内容变更
     */
    static isContentOnlyChange(analysisResult: ITransactionAnalysisResult): boolean {
        // 如果只有update操作，且没有insert/delete/move，可能只是内容变更
        const structuralChanges = ['insert', 'delete', 'move'];
        return !analysisResult.changeTypes.some(type => structuralChanges.includes(type));
    }

    /**
     * 创建调试信息
     * @param analysisResult 分析结果
     * @returns 调试信息字符串
     */
    static createDebugInfo(analysisResult: ITransactionAnalysisResult): string {
        return JSON.stringify({
            needUpdateHeadings: analysisResult.needUpdateHeadings,
            needUpdateFigures: analysisResult.needUpdateFigures,
            affectedDocs: analysisResult.affectedDocIds.length,
            changedHeadings: analysisResult.changedHeadingIds.length,
            changedImages: analysisResult.changedImageIds.length,
            changedTables: analysisResult.changedTableIds.length,
            changeTypes: analysisResult.changeTypes
        }, null, 2);
    }
}

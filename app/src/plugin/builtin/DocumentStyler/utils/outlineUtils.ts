/**
 * 大纲解析工具函数
 * 用于处理从API获取的大纲数据
 */

/**
 * 大纲节点接口
 */
export interface IOutlineNode {
    /** 节点ID */
    id: string;
    /** 节点名称/内容 */
    name: string;
    /** 节点类型 */
    nodeType: string;
    /** 子类型 */
    subType: string;
    /** 深度 */
    depth: number;
    /** 子节点数量 */
    count: number;
    /** 子节点列表 */
    blocks?: IOutlineNode[];
}

/**
 * 标题编号映射接口
 */
export interface IHeadingNumberMap {
    /** 块ID到编号的映射 */
    [blockId: string]: {
        /** 编号文本 */
        number: string;
        /** 标题级别 */
        level: number;
        /** 实际层级（基于存在的标题级别） */
        actualLevel: number;
    };
}

/**
 * 解析大纲数据，生成标题编号映射
 * @param outlineData 从API获取的大纲数据
 * @param formats 编号格式配置
 * @param useChineseNumbers 是否使用中文数字配置
 * @returns 标题编号映射
 */
export function parseOutlineToNumberMap(
    outlineData: IOutlineNode[],
    formats: string[],
    useChineseNumbers: boolean[]
): IHeadingNumberMap {
    const numberMap: IHeadingNumberMap = {};
    const counters: number[] = [0, 0, 0, 0, 0, 0];
    
    // 收集所有存在的标题级别
    const existingLevels = collectExistingLevels(outlineData);
    
    // 递归处理大纲节点
    function processNode(node: IOutlineNode): void {
        if (node.nodeType === 'NodeHeading') {
            const level = getHeadingLevelFromSubType(node.subType);
            if (level > 0) {
                const actualLevel = existingLevels.indexOf(level);
                if (actualLevel >= 0) {
                    // 生成编号
                    const [number, newCounters] = generateHeaderNumber(
                        level,
                        counters,
                        formats,
                        useChineseNumbers,
                        existingLevels
                    );
                    
                    // 更新计数器
                    Object.assign(counters, newCounters);
                    
                    // 保存到映射
                    numberMap[node.id] = {
                        number,
                        level,
                        actualLevel
                    };
                }
            }
        }
        
        // 处理子节点
        if (node.blocks && node.blocks.length > 0) {
            node.blocks.forEach(processNode);
        }
    }
    
    // 处理所有顶级节点
    outlineData.forEach(processNode);
    
    return numberMap;
}

/**
 * 收集大纲中存在的所有标题级别
 * @param outlineData 大纲数据
 * @returns 排序后的标题级别数组
 */
export function collectExistingLevels(outlineData: IOutlineNode[]): number[] {
    const levels = new Set<number>();
    
    function collectFromNode(node: IOutlineNode): void {
        if (node.nodeType === 'NodeHeading') {
            const level = getHeadingLevelFromSubType(node.subType);
            if (level > 0) {
                levels.add(level);
            }
        }
        
        if (node.blocks && node.blocks.length > 0) {
            node.blocks.forEach(collectFromNode);
        }
    }
    
    outlineData.forEach(collectFromNode);
    return Array.from(levels).sort((a, b) => a - b);
}

/**
 * 从子类型字符串中提取标题级别
 * @param subType 子类型字符串，如 "h1", "h2" 等
 * @returns 标题级别（1-6），如果不是标题则返回0
 */
export function getHeadingLevelFromSubType(subType: string): number {
    if (subType && subType.startsWith('h')) {
        const level = parseInt(subType.substring(1));
        if (level >= 1 && level <= 6) {
            return level;
        }
    }
    return 0;
}

/**
 * 生成标题序号（从numberUtils.ts复制并适配）
 * @param level 标题级别（1-6）
 * @param counters 当前计数器状态
 * @param formats 序号格式配置
 * @param useChineseNumbers 是否使用中文数字
 * @param existingLevels 文档中已存在的标题级别列表，必须是排序后的
 * @returns [生成的序号, 更新后的计数器]
 */
function generateHeaderNumber(
    level: number,
    counters: number[],
    formats: string[],
    useChineseNumbers: boolean[],
    existingLevels: number[] = []
): [string, number[]] {
    // 获取实际层级
    const actualLevel = existingLevels.length > 0 ? existingLevels.indexOf(level) : level - 1;
    
    // 复制计数器以避免修改原数组
    const newCounters = [...counters];
    
    // 增加当前级别的计数
    newCounters[actualLevel]++;
    
    // 重置所有低级别的计数
    for (let i = actualLevel + 1; i < newCounters.length; i++) {
        newCounters[i] = 0;
    }
    
    // 获取当前级别的格式
    const format = formats[actualLevel] || '{1}. ';
    
    // 生成序号
    let result = format;
    // 找出所有占位符
    const placeholders = format.match(/\{(\d+)\}/g) || [];

    for (const placeholder of placeholders) {
        // 获取占位符中的数字
        const match = placeholder.match(/\{(\d+)\}/);
        if (!match) continue;
        const placeholderLevel = parseInt(match[1]) - 1; // 占位符级别（0-based）

        // 确保占位符级别不超过当前实际级别
        if (placeholderLevel <= actualLevel && placeholderLevel < newCounters.length) {
            // 使用占位符对应级别的 useChineseNumbers 设置
            const shouldUseChinese = useChineseNumbers[placeholderLevel] || false;
            const num = newCounters[placeholderLevel];
            const numStr = shouldUseChinese ? num2Chinese(num) : num.toString();
            result = result.replace(placeholder, numStr);
        }
    }
    
    return [result, newCounters];
}

/**
 * 将数字转换为中文数字（从numberUtils.ts复制）
 * @param num 要转换的数字
 * @returns 转换后的中文数字
 */
function num2Chinese(num: number): string {
    const units = ['', '十', '百', '千', '万'];
    const numbers = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    
    if (num === 0) return numbers[0];
    if (num < 0) return '负' + num2Chinese(-num);
    if (num < 10) return numbers[num];
    
    let result = '';
    let temp = num;
    let unitIndex = 0;
    
    while (temp > 0) {
        const digit = temp % 10;
        if (digit === 0) {
            if (result && result[0] !== numbers[0]) {
                result = numbers[0] + result;
            }
        } else {
            result = numbers[digit] + units[unitIndex] + result;
        }
        temp = Math.floor(temp / 10);
        unitIndex++;
    }
    
    // 处理特殊情况
    result = result.replace(/零+$/, ''); // 移除末尾的零
    result = result.replace(/零+/g, '零'); // 多个零合并为一个
    
    // 处理"一十"开头的情况
    if (result.startsWith('一十')) {
        result = result.substring(1);
    }
    
    return result;
}

/**
 * 检查大纲数据是否包含标题
 * @param outlineData 大纲数据
 * @returns 是否包含标题
 */
export function hasHeadingsInOutline(outlineData: IOutlineNode[]): boolean {
    function checkNode(node: IOutlineNode): boolean {
        if (node.nodeType === 'NodeHeading') {
            return true;
        }
        
        if (node.blocks && node.blocks.length > 0) {
            return node.blocks.some(checkNode);
        }
        
        return false;
    }
    
    return outlineData.some(checkNode);
}

/**
 * 获取大纲中的所有标题节点
 * @param outlineData 大纲数据
 * @returns 标题节点列表
 */
export function getHeadingNodesFromOutline(outlineData: IOutlineNode[]): IOutlineNode[] {
    const headingNodes: IOutlineNode[] = [];
    
    function collectFromNode(node: IOutlineNode): void {
        if (node.nodeType === 'NodeHeading') {
            headingNodes.push(node);
        }
        
        if (node.blocks && node.blocks.length > 0) {
            node.blocks.forEach(collectFromNode);
        }
    }
    
    outlineData.forEach(collectFromNode);
    return headingNodes;
}

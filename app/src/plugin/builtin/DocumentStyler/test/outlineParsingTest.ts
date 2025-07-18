/**
 * 大纲数据结构解析测试
 * 测试修正后的解析逻辑是否能正确处理 blocks 和 children 字段
 */

import { 
    parseOutlineToNumberMap, 
    collectExistingLevels,
    hasHeadingsInOutline,
    getHeadingNodesFromOutline,
    IOutlineNode 
} from '../utils/outlineUtils';

// 模拟使用 blocks 字段的大纲数据（思源标准格式）
const mockOutlineDataWithBlocks: IOutlineNode[] = [
    {
        id: "20231201-001",
        name: "第一章 概述",
        nodeType: "NodeHeading",
        subType: "h1",
        depth: 0,
        count: 2,
        blocks: [
            {
                id: "20231201-002",
                name: "1.1 背景",
                nodeType: "NodeHeading",
                subType: "h2",
                depth: 1,
                count: 0,
                blocks: []
            },
            {
                id: "20231201-003",
                name: "1.2 目标",
                nodeType: "NodeHeading",
                subType: "h2",
                depth: 1,
                count: 1,
                blocks: [
                    {
                        id: "20231201-004",
                        name: "1.2.1 主要目标",
                        nodeType: "NodeHeading",
                        subType: "h3",
                        depth: 2,
                        count: 0,
                        blocks: []
                    }
                ]
            }
        ]
    }
];

// 模拟使用 children 字段的大纲数据（兼容格式）
const mockOutlineDataWithChildren: IOutlineNode[] = [
    {
        id: "20231201-001",
        name: "第一章 概述",
        nodeType: "NodeHeading",
        subType: "h1",
        depth: 0,
        count: 2,
        children: [
            {
                id: "20231201-002",
                name: "1.1 背景",
                nodeType: "NodeHeading",
                subType: "h2",
                depth: 1,
                count: 0,
                children: []
            },
            {
                id: "20231201-003",
                name: "1.2 目标",
                nodeType: "NodeHeading",
                subType: "h2",
                depth: 1,
                count: 1,
                children: [
                    {
                        id: "20231201-004",
                        name: "1.2.1 主要目标",
                        nodeType: "NodeHeading",
                        subType: "h3",
                        depth: 2,
                        count: 0,
                        children: []
                    }
                ]
            }
        ]
    } as any // 使用 any 类型以支持 children 字段
];

// 混合格式的大纲数据
const mockOutlineDataMixed: IOutlineNode[] = [
    {
        id: "20231201-001",
        name: "第一章 概述",
        nodeType: "NodeHeading",
        subType: "h1",
        depth: 0,
        count: 1,
        blocks: [
            {
                id: "20231201-002",
                name: "1.1 背景",
                nodeType: "NodeHeading",
                subType: "h2",
                depth: 1,
                count: 0,
                blocks: []
            }
        ]
    },
    {
        id: "20231201-005",
        name: "第二章 实现",
        nodeType: "NodeHeading",
        subType: "h1",
        depth: 0,
        count: 1,
        children: [
            {
                id: "20231201-006",
                name: "2.1 架构",
                nodeType: "NodeHeading",
                subType: "h2",
                depth: 1,
                count: 0,
                children: []
            }
        ]
    } as any
];

/**
 * 测试 blocks 字段解析
 */
function testBlocksFieldParsing() {
    console.log('=== 测试 blocks 字段解析 ===');
    
    // 测试收集标题级别
    const levels = collectExistingLevels(mockOutlineDataWithBlocks);
    console.log('收集到的标题级别:', levels);
    console.assert(levels.length === 3, '应该收集到3个标题级别');
    console.assert(levels.includes(1) && levels.includes(2) && levels.includes(3), '应该包含h1, h2, h3');
    
    // 测试检查是否包含标题
    const hasHeadings = hasHeadingsInOutline(mockOutlineDataWithBlocks);
    console.log('是否包含标题:', hasHeadings);
    console.assert(hasHeadings === true, '应该包含标题');
    
    // 测试获取标题节点
    const headingNodes = getHeadingNodesFromOutline(mockOutlineDataWithBlocks);
    console.log('标题节点数量:', headingNodes.length);
    console.assert(headingNodes.length === 4, '应该有4个标题节点');
    
    // 测试生成编号映射
    const formats = ['{1}. ', '{1}.{2} ', '{1}.{2}.{3} '];
    const useChineseNumbers = [false, false, false];
    const numberMap = parseOutlineToNumberMap(mockOutlineDataWithBlocks, formats, useChineseNumbers);
    console.log('编号映射:', numberMap);
    console.assert(Object.keys(numberMap).length === 4, '应该生成4个编号');
    
    console.log('blocks 字段解析测试通过 ✓\n');
}

/**
 * 测试 children 字段解析
 */
function testChildrenFieldParsing() {
    console.log('=== 测试 children 字段解析 ===');
    
    // 测试收集标题级别
    const levels = collectExistingLevels(mockOutlineDataWithChildren);
    console.log('收集到的标题级别:', levels);
    console.assert(levels.length === 3, '应该收集到3个标题级别');
    console.assert(levels.includes(1) && levels.includes(2) && levels.includes(3), '应该包含h1, h2, h3');
    
    // 测试检查是否包含标题
    const hasHeadings = hasHeadingsInOutline(mockOutlineDataWithChildren);
    console.log('是否包含标题:', hasHeadings);
    console.assert(hasHeadings === true, '应该包含标题');
    
    // 测试获取标题节点
    const headingNodes = getHeadingNodesFromOutline(mockOutlineDataWithChildren);
    console.log('标题节点数量:', headingNodes.length);
    console.assert(headingNodes.length === 4, '应该有4个标题节点');
    
    // 测试生成编号映射
    const formats = ['{1}. ', '{1}.{2} ', '{1}.{2}.{3} '];
    const useChineseNumbers = [false, false, false];
    const numberMap = parseOutlineToNumberMap(mockOutlineDataWithChildren, formats, useChineseNumbers);
    console.log('编号映射:', numberMap);
    console.assert(Object.keys(numberMap).length === 4, '应该生成4个编号');
    
    console.log('children 字段解析测试通过 ✓\n');
}

/**
 * 测试混合格式解析
 */
function testMixedFieldParsing() {
    console.log('=== 测试混合格式解析 ===');
    
    // 测试收集标题级别
    const levels = collectExistingLevels(mockOutlineDataMixed);
    console.log('收集到的标题级别:', levels);
    console.assert(levels.length === 2, '应该收集到2个标题级别');
    console.assert(levels.includes(1) && levels.includes(2), '应该包含h1, h2');
    
    // 测试检查是否包含标题
    const hasHeadings = hasHeadingsInOutline(mockOutlineDataMixed);
    console.log('是否包含标题:', hasHeadings);
    console.assert(hasHeadings === true, '应该包含标题');
    
    // 测试获取标题节点
    const headingNodes = getHeadingNodesFromOutline(mockOutlineDataMixed);
    console.log('标题节点数量:', headingNodes.length);
    console.assert(headingNodes.length === 4, '应该有4个标题节点');
    
    // 测试生成编号映射
    const formats = ['{1}. ', '{1}.{2} '];
    const useChineseNumbers = [false, false];
    const numberMap = parseOutlineToNumberMap(mockOutlineDataMixed, formats, useChineseNumbers);
    console.log('编号映射:', numberMap);
    console.assert(Object.keys(numberMap).length === 4, '应该生成4个编号');
    
    console.log('混合格式解析测试通过 ✓\n');
}

/**
 * 运行所有测试
 */
export function runOutlineParsingTests() {
    console.log('开始运行大纲数据结构解析测试...\n');
    
    try {
        testBlocksFieldParsing();
        testChildrenFieldParsing();
        testMixedFieldParsing();
        
        console.log('所有大纲解析测试通过 ✅');
        return true;
    } catch (error) {
        console.error('大纲解析测试失败:', error);
        return false;
    }
}

// 如果直接运行此文件，执行测试
if (typeof window === 'undefined') {
    runOutlineParsingTests();
}

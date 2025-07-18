/**
 * 集成测试
 * 测试新的标题编号架构
 */

import { OutlineManager } from "../core/OutlineManager";
import { CSSGenerator } from "../utils/cssGenerator";
import { TransactionAnalyzer } from "../utils/transactionAnalyzer";
import { parseOutlineToNumberMap, collectExistingLevels } from "../utils/outlineUtils";

// 模拟大纲数据
const mockOutlineData = [
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
    },
    {
        id: "20231201-005",
        name: "第二章 实现",
        nodeType: "NodeHeading",
        subType: "h1",
        depth: 0,
        count: 1,
        blocks: [
            {
                id: "20231201-006",
                name: "2.1 技术选型",
                nodeType: "NodeHeading",
                subType: "h2",
                depth: 1,
                count: 2,
                blocks: [
                    {
                        id: "20231201-007",
                        name: "2.1.1 前端技术",
                        nodeType: "NodeHeading",
                        subType: "h3",
                        depth: 2,
                        count: 0,
                        blocks: []
                    },
                    {
                        id: "20231201-008",
                        name: "2.1.2 后端技术",
                        nodeType: "NodeHeading",
                        subType: "h3",
                        depth: 2,
                        count: 0,
                        blocks: []
                    }
                ]
            },
            {
                id: "20231201-009",
                name: "2.2 架构设计",
                nodeType: "NodeHeading",
                subType: "h2",
                depth: 1,
                count: 0,
                blocks: []
            }
        ]
    }
];

// 模拟transaction事件数据
const mockTransactionEvent = {
    cmd: "transactions",
    data: [
        {
            doOperations: [
                {
                    action: "update",
                    id: "20231201-001",
                    data: '<div data-node-id="20231201-001" data-type="NodeHeading" data-subtype="h1" data-root-id="20231201-root">第一章 概述（修改）</div>'
                }
            ]
        }
    ]
};

/**
 * 测试大纲解析功能
 */
function testOutlineParsing(): void {
    console.log("=== 测试大纲解析功能 ===");
    
    try {
        // 测试收集存在的标题级别
        const existingLevels = collectExistingLevels(mockOutlineData);
        console.log("存在的标题级别:", existingLevels);
        
        // 测试生成编号映射
        const formats = ["{1}. ", "{1}.{2} ", "{1}.{2}.{3} "];
        const useChineseNumbers = [false, false, false];
        
        const numberMap = parseOutlineToNumberMap(mockOutlineData, formats, useChineseNumbers);
        console.log("标题编号映射:", numberMap);
        
        // 验证编号是否正确
        const expectedNumbers = {
            "20231201-001": "1. ",
            "20231201-002": "1.1 ",
            "20231201-003": "1.2 ",
            "20231201-004": "1.2.1 ",
            "20231201-005": "2. ",
            "20231201-006": "2.1 ",
            "20231201-007": "2.1.1 ",
            "20231201-008": "2.1.2 ",
            "20231201-009": "2.2 "
        };
        
        let allCorrect = true;
        for (const [blockId, expected] of Object.entries(expectedNumbers)) {
            const actual = numberMap[blockId]?.number;
            if (actual !== expected) {
                console.error(`编号错误: ${blockId} 期望 "${expected}" 实际 "${actual}"`);
                allCorrect = false;
            }
        }
        
        if (allCorrect) {
            console.log("✅ 大纲解析测试通过");
        } else {
            console.error("❌ 大纲解析测试失败");
        }
        
    } catch (error) {
        console.error("❌ 大纲解析测试异常:", error);
    }
}

/**
 * 测试CSS生成功能
 */
function testCSSGeneration(): void {
    console.log("\n=== 测试CSS生成功能 ===");
    
    try {
        // 创建测试用的编号映射
        const testNumberMap = {
            "20231201-001": { number: "1. ", level: 1, actualLevel: 0 },
            "20231201-002": { number: "1.1 ", level: 2, actualLevel: 1 },
            "20231201-003": { number: "1.2 ", level: 2, actualLevel: 1 }
        };
        
        // 生成CSS
        const css = CSSGenerator.generateHeadingNumberCSS(testNumberMap);
        console.log("生成的CSS:", css);
        
        // 验证CSS包含必要的选择器
        const expectedSelectors = [
            '[data-node-id="20231201-001"][data-type="NodeHeading"]',
            '[data-node-id="20231201-002"][data-type="NodeHeading"]',
            '[data-node-id="20231201-003"][data-type="NodeHeading"]'
        ];
        
        let allSelectorsPresent = true;
        for (const selector of expectedSelectors) {
            if (!css.includes(selector)) {
                console.error(`CSS中缺少选择器: ${selector}`);
                allSelectorsPresent = false;
            }
        }
        
        // 验证CSS包含编号内容
        const expectedContents = ['content: "1. "', 'content: "1.1 "', 'content: "1.2 "'];
        let allContentsPresent = true;
        for (const content of expectedContents) {
            if (!css.includes(content)) {
                console.error(`CSS中缺少内容: ${content}`);
                allContentsPresent = false;
            }
        }
        
        if (allSelectorsPresent && allContentsPresent) {
            console.log("✅ CSS生成测试通过");
        } else {
            console.error("❌ CSS生成测试失败");
        }
        
    } catch (error) {
        console.error("❌ CSS生成测试异常:", error);
    }
}

/**
 * 测试Transaction分析功能
 */
function testTransactionAnalysis(): void {
    console.log("\n=== 测试Transaction分析功能 ===");
    
    try {
        // 分析模拟的transaction事件
        const result = TransactionAnalyzer.analyzeTransactionEvent(mockTransactionEvent);
        console.log("分析结果:", result);
        
        // 验证分析结果
        const expectedResults = {
            needUpdateHeadings: true,
            needUpdateFigures: false,
            affectedDocIds: ["20231201-root"],
            changedHeadingIds: ["20231201-001"],
            changeTypes: ["update"]
        };
        
        let allCorrect = true;
        
        if (result.needUpdateHeadings !== expectedResults.needUpdateHeadings) {
            console.error(`needUpdateHeadings 错误: 期望 ${expectedResults.needUpdateHeadings} 实际 ${result.needUpdateHeadings}`);
            allCorrect = false;
        }
        
        if (result.needUpdateFigures !== expectedResults.needUpdateFigures) {
            console.error(`needUpdateFigures 错误: 期望 ${expectedResults.needUpdateFigures} 实际 ${result.needUpdateFigures}`);
            allCorrect = false;
        }
        
        if (!result.affectedDocIds.includes(expectedResults.affectedDocIds[0])) {
            console.error(`affectedDocIds 错误: 期望包含 ${expectedResults.affectedDocIds[0]}`);
            allCorrect = false;
        }
        
        if (!result.changedHeadingIds.includes(expectedResults.changedHeadingIds[0])) {
            console.error(`changedHeadingIds 错误: 期望包含 ${expectedResults.changedHeadingIds[0]}`);
            allCorrect = false;
        }
        
        if (!result.changeTypes.includes(expectedResults.changeTypes[0])) {
            console.error(`changeTypes 错误: 期望包含 ${expectedResults.changeTypes[0]}`);
            allCorrect = false;
        }
        
        if (allCorrect) {
            console.log("✅ Transaction分析测试通过");
        } else {
            console.error("❌ Transaction分析测试失败");
        }
        
    } catch (error) {
        console.error("❌ Transaction分析测试异常:", error);
    }
}

/**
 * 测试性能
 */
function testPerformance(): void {
    console.log("\n=== 测试性能 ===");
    
    try {
        // 创建大量测试数据
        const largeOutlineData = [];
        for (let i = 1; i <= 100; i++) {
            largeOutlineData.push({
                id: `test-${i}`,
                name: `标题 ${i}`,
                nodeType: "NodeHeading",
                subType: "h1",
                depth: 0,
                count: 0,
                blocks: []
            });
        }
        
        // 测试大纲解析性能
        const startTime = performance.now();
        const formats = ["{1}. ", "{1}.{2} ", "{1}.{2}.{3} "];
        const useChineseNumbers = [false, false, false];
        
        for (let i = 0; i < 10; i++) {
            parseOutlineToNumberMap(largeOutlineData, formats, useChineseNumbers);
        }
        
        const endTime = performance.now();
        const avgTime = (endTime - startTime) / 10;
        
        console.log(`大纲解析平均耗时: ${avgTime.toFixed(2)}ms (100个标题)`);
        
        if (avgTime < 50) {
            console.log("✅ 性能测试通过");
        } else {
            console.warn("⚠️ 性能可能需要优化");
        }
        
    } catch (error) {
        console.error("❌ 性能测试异常:", error);
    }
}

/**
 * 运行所有测试
 */
export function runIntegrationTests(): void {
    console.log("开始运行集成测试...\n");
    
    testOutlineParsing();
    testCSSGeneration();
    testTransactionAnalysis();
    testPerformance();
    
    console.log("\n集成测试完成");
}

// 如果直接运行此文件，执行测试
if (typeof window !== 'undefined' && (window as any).runDocumentStylerTests) {
    runIntegrationTests();
}

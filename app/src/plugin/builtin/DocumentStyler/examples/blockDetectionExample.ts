/**
 * 块检测逻辑示例
 * 展示基于块ID的精确文档影响检测
 */

import { DocumentManager } from '../core/DocumentManager';

/**
 * 示例：演示新的块检测逻辑
 */
export function demonstrateBlockDetection() {
    console.log('=== 块检测逻辑示例 ===\n');

    // 假设我们有一个 DocumentManager 实例
    const documentManager = getDocumentManagerInstance();
    
    if (!documentManager) {
        console.log('DocumentManager 实例不可用');
        return;
    }

    // 示例1：检测当前文档的块变更
    console.log('1. 检测当前文档的块变更');
    
    const currentDocMessage = {
        cmd: 'transactions',
        data: [{
            doOperations: [{
                action: 'update',
                id: '20231201-heading-001', // 假设这个块存在于当前文档
                data: '<div data-type="NodeHeading" data-subtype="h1">更新的标题</div>'
            }]
        }]
    };

    const isCurrentDocAffected = documentManager.isCurrentDocumentAffected(currentDocMessage);
    console.log('当前文档是否受影响:', isCurrentDocAffected);

    // 示例2：检测其他文档的块变更
    console.log('\n2. 检测其他文档的块变更');
    
    const otherDocMessage = {
        cmd: 'transactions',
        data: [{
            doOperations: [{
                action: 'update',
                id: '20231201-other-block', // 假设这个块不存在于当前文档
                data: '<div data-type="NodeParagraph">其他文档的段落</div>'
            }]
        }]
    };

    const isOtherDocAffected = documentManager.isCurrentDocumentAffected(otherDocMessage);
    console.log('其他文档变更是否影响当前文档:', isOtherDocAffected);

    // 示例3：检测混合变更
    console.log('\n3. 检测混合变更');
    
    const mixedMessage = {
        cmd: 'transactions',
        data: [
            {
                doOperations: [{
                    action: 'update',
                    id: '20231201-heading-001', // 当前文档的块
                    data: '<div data-type="NodeHeading" data-subtype="h2">当前文档标题</div>'
                }]
            },
            {
                doOperations: [{
                    action: 'insert',
                    id: '20231201-other-block', // 其他文档的块
                    data: '<div data-type="NodeParagraph">其他文档段落</div>'
                }]
            }
        ]
    };

    const isMixedAffected = documentManager.isCurrentDocumentAffected(mixedMessage);
    console.log('混合变更是否影响当前文档:', isMixedAffected);

    // 示例4：检测特定文档
    console.log('\n4. 检测特定文档');
    
    const targetDocId = '20231201-target-doc';
    const isTargetDocAffected = documentManager.isDocumentAffected(currentDocMessage, targetDocId);
    console.log(`文档 ${targetDocId} 是否受影响:`, isTargetDocAffected);

    // 示例5：获取受影响的文档列表
    console.log('\n5. 获取受影响的文档列表');
    
    const affectedDocs = documentManager.getAffectedDocumentIds(mixedMessage);
    console.log('受影响的文档ID列表:', affectedDocs);
}

/**
 * 示例：对比新旧检测逻辑
 */
export function compareDetectionMethods() {
    console.log('=== 新旧检测逻辑对比 ===\n');

    const sampleMessage = {
        cmd: 'transactions',
        data: [{
            doOperations: [{
                action: 'update',
                id: '20231201-heading-001',
                data: '<div data-type="NodeHeading" data-subtype="h1" data-root-id="20231201-doc-A">标题内容</div>'
            }]
        }]
    };

    console.log('示例消息:', JSON.stringify(sampleMessage, null, 2));

    // 旧方法：基于 data-root-id 检测
    console.log('\n旧方法（基于 data-root-id）:');
    const oldMethodResult = checkByRootId(sampleMessage, '20231201-doc-A');
    console.log('- 检查 data-root-id="20231201-doc-A":', oldMethodResult);
    console.log('- 问题：只要 root-id 匹配就认为影响文档，不够精确');

    // 新方法：基于块ID在protyle中的存在性
    console.log('\n新方法（基于块ID存在性）:');
    const documentManager = getDocumentManagerInstance();
    if (documentManager) {
        const newMethodResult = documentManager.isCurrentDocumentAffected(sampleMessage);
        console.log('- 检查块ID "20231201-heading-001" 是否在当前protyle中:', newMethodResult);
        console.log('- 优势：精确检测块是否真实存在于当前编辑器中');
    }
}

/**
 * 示例：实际使用场景
 */
export function realWorldUsageExample() {
    console.log('=== 实际使用场景示例 ===\n');

    const documentManager = getDocumentManagerInstance();
    if (!documentManager) {
        console.log('DocumentManager 实例不可用');
        return;
    }

    // 场景1：用户编辑标题时的实时更新
    console.log('场景1：用户编辑标题时的实时更新');
    
    const headingEditMessage = {
        cmd: 'transactions',
        data: [{
            doOperations: [{
                action: 'update',
                id: getCurrentHeadingBlockId(), // 获取当前正在编辑的标题块ID
                data: '<div data-type="NodeHeading" data-subtype="h1">新的标题内容</div>'
            }]
        }]
    };

    if (documentManager.isCurrentDocumentAffected(headingEditMessage)) {
        console.log('✅ 检测到当前文档的标题变更，触发编号更新');
        // 这里会触发标题编号的重新计算和应用
    } else {
        console.log('❌ 变更不影响当前文档，跳过更新');
    }

    // 场景2：多文档同时打开时的精确更新
    console.log('\n场景2：多文档同时打开时的精确更新');
    
    const multiDocMessage = {
        cmd: 'transactions',
        data: [
            {
                doOperations: [{
                    action: 'insert',
                    id: 'doc-A-block-001',
                    data: '<div data-type="NodeParagraph">文档A的新段落</div>'
                }]
            },
            {
                doOperations: [{
                    action: 'update',
                    id: 'doc-B-heading-001',
                    data: '<div data-type="NodeHeading" data-subtype="h2">文档B的标题</div>'
                }]
            }
        ]
    };

    // 检查每个可能受影响的文档
    const openDocuments = ['doc-A', 'doc-B', 'doc-C'];
    
    openDocuments.forEach(docId => {
        const isAffected = documentManager.isDocumentAffected(multiDocMessage, docId);
        console.log(`文档 ${docId} 是否受影响: ${isAffected ? '✅' : '❌'}`);
        
        if (isAffected) {
            console.log(`  → 为文档 ${docId} 触发相应的更新逻辑`);
        }
    });

    // 场景3：性能优化 - 避免不必要的处理
    console.log('\n场景3：性能优化示例');
    
    const irrelevantMessage = {
        cmd: 'transactions',
        data: [{
            doOperations: [{
                action: 'update',
                id: 'completely-different-doc-block',
                data: '<div data-type="NodeParagraph">完全无关的文档内容</div>'
            }]
        }]
    };

    const startTime = performance.now();
    const isRelevant = documentManager.isCurrentDocumentAffected(irrelevantMessage);
    const endTime = performance.now();

    console.log(`检测耗时: ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`是否相关: ${isRelevant ? '是' : '否'}`);
    
    if (!isRelevant) {
        console.log('✅ 快速跳过不相关的变更，节省处理时间');
    }
}

/**
 * 旧方法：基于 data-root-id 的检测（用于对比）
 */
function checkByRootId(msg: any, targetRootId: string): boolean {
    if (!msg.data || !Array.isArray(msg.data)) {
        return false;
    }

    return msg.data.some((transaction: any) => {
        if (!transaction.doOperations || !Array.isArray(transaction.doOperations)) {
            return false;
        }

        return transaction.doOperations.some((operation: any) => {
            if (operation.data && typeof operation.data === 'string') {
                return operation.data.includes(`data-root-id="${targetRootId}"`);
            }
            return false;
        });
    });
}

/**
 * 获取当前正在编辑的标题块ID（模拟）
 */
function getCurrentHeadingBlockId(): string {
    // 在实际应用中，这里会从当前光标位置或选中的元素获取块ID
    return '20231201-current-heading';
}

/**
 * 获取 DocumentManager 实例
 */
function getDocumentManagerInstance(): DocumentManager | null {
    // 在实际使用中，这应该从插件实例中获取
    if ((window as any).documentStylerPlugin?.documentManager) {
        return (window as any).documentStylerPlugin.documentManager;
    }
    
    console.warn('DocumentManager 实例不可用');
    return null;
}

/**
 * 运行所有示例
 */
export function runBlockDetectionExamples() {
    console.log('开始运行块检测逻辑示例...\n');
    
    try {
        demonstrateBlockDetection();
        console.log('\n' + '='.repeat(50) + '\n');
        
        compareDetectionMethods();
        console.log('\n' + '='.repeat(50) + '\n');
        
        realWorldUsageExample();
        
        console.log('\n✅ 所有示例运行完成');
        
    } catch (error) {
        console.error('运行示例时出错:', error);
    }
}

// 如果直接运行此文件，执行示例
if (typeof window !== 'undefined') {
    runBlockDetectionExamples();
}

/**
 * 块检测逻辑测试
 * 测试基于块ID的文档影响检测逻辑
 */

import { DocumentManager } from '../core/DocumentManager';

/**
 * 模拟 WebSocket 消息数据（基于块ID）
 */
const mockTransactionMessages = {
    // 当前文档中存在的块变更
    existingBlockChange: {
        cmd: 'transactions',
        data: [{
            doOperations: [{
                action: 'update',
                id: '20231201-heading-001', // 存在于当前文档
                data: '<div data-type="NodeHeading" data-subtype="h1">修改后的标题</div>'
            }]
        }]
    },

    // 当前文档中不存在的块变更
    nonExistingBlockChange: {
        cmd: 'transactions',
        data: [{
            doOperations: [{
                action: 'update',
                id: '20231201-other-block', // 不存在于当前文档
                data: '<div data-type="NodeHeading" data-subtype="h1">其他文档标题</div>'
            }]
        }]
    },

    // 混合变更：包含存在和不存在的块
    mixedBlockChanges: {
        cmd: 'transactions',
        data: [
            {
                doOperations: [{
                    action: 'update',
                    id: '20231201-heading-001', // 存在于当前文档
                    data: '<div data-type="NodeHeading" data-subtype="h2">当前文档标题</div>'
                }]
            },
            {
                doOperations: [{
                    action: 'update',
                    id: '20231201-other-block', // 不存在于当前文档
                    data: '<div data-type="NodeHeading" data-subtype="h1">其他文档标题</div>'
                }]
            }
        ]
    },

    // 多个当前文档的块变更
    multipleExistingBlocks: {
        cmd: 'transactions',
        data: [{
            doOperations: [
                {
                    action: 'update',
                    id: '20231201-heading-001',
                    data: '<div data-type="NodeHeading" data-subtype="h1">标题1</div>'
                },
                {
                    action: 'update',
                    id: '20231201-para-001',
                    data: '<div data-type="NodeParagraph">段落1</div>'
                },
                {
                    action: 'insert',
                    id: '20231201-table-001',
                    data: '<div data-type="NodeTable"><table><tr><td>表格</td></tr></table></div>'
                }
            ]
        }]
    },

    // 没有ID的操作
    operationWithoutId: {
        cmd: 'transactions',
        data: [{
            doOperations: [{
                action: 'update',
                // 没有 id 字段
                data: '<div data-type="NodeParagraph">无ID的操作</div>'
            }]
        }]
    }
};

/**
 * 创建模拟的 DocumentManager 和相关依赖
 */
function createMockDocumentManager(currentDocId: string = '20231201-current-doc') {
    // 模拟当前文档包含的块ID
    const currentDocBlocks = [
        '20231201-heading-001',
        '20231201-para-001',
        '20231201-table-001',
        '20231201-heading-002'
    ];

    // 模拟其他文档包含的块ID
    const otherDocBlocks = [
        '20231201-other-block',
        '20231201-other-heading',
        '20231201-other-para'
    ];

    // 模拟 protyle 实例
    const mockProtyle = {
        wysiwyg: {
            element: {
                querySelector: jest.fn().mockImplementation((selector: string) => {
                    const blockIdMatch = selector.match(/data-node-id="([^"]+)"/);
                    if (blockIdMatch) {
                        const blockId = blockIdMatch[1];
                        return currentDocBlocks.includes(blockId) ? { id: blockId } : null;
                    }
                    return null;
                })
            }
        },
        block: {
            rootID: currentDocId
        }
    };

    // 模拟 App 实例
    const mockApp = {
        layout: {
            layout: {
                models: {
                    editor: [{
                        protyle: mockProtyle
                    }]
                }
            }
        }
    } as any;

    const documentManager = new DocumentManager(mockApp);
    
    // 设置当前文档状态
    (documentManager as any).currentDocId = currentDocId;
    (documentManager as any).currentProtyle = mockProtyle;

    return {
        documentManager,
        mockProtyle,
        currentDocBlocks,
        otherDocBlocks
    };
}

/**
 * 测试块检测逻辑
 */
describe('Block Detection Logic', () => {
    let mockSetup: any;

    beforeEach(() => {
        mockSetup = createMockDocumentManager();
    });

    test('应该检测到当前文档中存在的块变更', () => {
        const { documentManager } = mockSetup;

        const isAffected = documentManager.isCurrentDocumentAffected(
            mockTransactionMessages.existingBlockChange
        );

        expect(isAffected).toBe(true);
    });

    test('应该忽略当前文档中不存在的块变更', () => {
        const { documentManager } = mockSetup;

        const isAffected = documentManager.isCurrentDocumentAffected(
            mockTransactionMessages.nonExistingBlockChange
        );

        expect(isAffected).toBe(false);
    });

    test('应该正确处理混合块变更', () => {
        const { documentManager } = mockSetup;

        const isAffected = documentManager.isCurrentDocumentAffected(
            mockTransactionMessages.mixedBlockChanges
        );

        // 因为包含当前文档的块，所以应该返回 true
        expect(isAffected).toBe(true);
    });

    test('应该检测到多个当前文档的块变更', () => {
        const { documentManager } = mockSetup;

        const isAffected = documentManager.isCurrentDocumentAffected(
            mockTransactionMessages.multipleExistingBlocks
        );

        expect(isAffected).toBe(true);
    });

    test('应该忽略没有ID的操作', () => {
        const { documentManager } = mockSetup;

        const isAffected = documentManager.isCurrentDocumentAffected(
            mockTransactionMessages.operationWithoutId
        );

        expect(isAffected).toBe(false);
    });

    test('isBlockInProtyle 方法应该正确检测块是否存在', () => {
        const { documentManager, mockProtyle, currentDocBlocks } = mockSetup;

        // 测试存在的块
        const existingBlockId = currentDocBlocks[0];
        const isExisting = (documentManager as any).isBlockInProtyle(existingBlockId, mockProtyle);
        expect(isExisting).toBe(true);

        // 测试不存在的块
        const nonExistingBlockId = '20231201-non-existing';
        const isNonExisting = (documentManager as any).isBlockInProtyle(nonExistingBlockId, mockProtyle);
        expect(isNonExisting).toBe(false);
    });

    test('应该在没有 protyle 时返回 false', () => {
        const { documentManager } = mockSetup;

        // 模拟没有找到 protyle 的情况
        jest.spyOn(documentManager, 'getProtyleByDocId').mockReturnValue(null);

        const isAffected = documentManager.isCurrentDocumentAffected(
            mockTransactionMessages.existingBlockChange
        );

        expect(isAffected).toBe(false);
    });

    test('应该在没有当前文档ID时返回 false', () => {
        const { documentManager } = mockSetup;

        // 模拟没有当前文档ID的情况
        jest.spyOn(documentManager, 'getCurrentDocId').mockReturnValue(null);

        const isAffected = documentManager.isCurrentDocumentAffected(
            mockTransactionMessages.existingBlockChange
        );

        expect(isAffected).toBe(false);
    });

    test('应该正确处理指定文档的块检测', () => {
        const { documentManager } = mockSetup;
        const targetDocId = '20231201-current-doc';

        // 测试存在的块
        const isAffected = documentManager.isDocumentAffected(
            mockTransactionMessages.existingBlockChange,
            targetDocId
        );

        expect(isAffected).toBe(true);

        // 测试不存在的块
        const isNotAffected = documentManager.isDocumentAffected(
            mockTransactionMessages.nonExistingBlockChange,
            targetDocId
        );

        expect(isNotAffected).toBe(false);
    });

    test('应该处理 DOM 查询异常', () => {
        const { documentManager, mockProtyle } = mockSetup;

        // 模拟 DOM 查询抛出异常
        mockProtyle.wysiwyg.element.querySelector.mockImplementation(() => {
            throw new Error('DOM query failed');
        });

        const isAffected = documentManager.isCurrentDocumentAffected(
            mockTransactionMessages.existingBlockChange
        );

        // 应该返回 false 而不是抛出异常
        expect(isAffected).toBe(false);
    });

    test('应该处理无效的消息格式', () => {
        const { documentManager } = mockSetup;

        // 测试空消息
        expect(documentManager.isCurrentDocumentAffected(null)).toBe(false);
        expect(documentManager.isCurrentDocumentAffected({})).toBe(false);
        expect(documentManager.isCurrentDocumentAffected({ data: null })).toBe(false);
        expect(documentManager.isCurrentDocumentAffected({ data: [] })).toBe(false);

        // 测试无效的 transaction 结构
        const invalidMessage = {
            cmd: 'transactions',
            data: [{ /* 没有 doOperations */ }]
        };
        expect(documentManager.isCurrentDocumentAffected(invalidMessage)).toBe(false);
    });
});

/**
 * 性能测试
 */
describe('Block Detection Performance', () => {
    test('应该高效处理大量块操作', () => {
        const mockSetup = createMockDocumentManager();
        const { documentManager } = mockSetup;

        // 创建包含大量操作的消息
        const largeMessage = {
            cmd: 'transactions',
            data: [{
                doOperations: Array.from({ length: 1000 }, (_, i) => ({
                    action: 'update',
                    id: `block-${i}`,
                    data: `<div data-type="NodeParagraph">Block ${i}</div>`
                }))
            }]
        };

        const startTime = performance.now();
        const isAffected = documentManager.isCurrentDocumentAffected(largeMessage);
        const endTime = performance.now();

        // 应该在合理时间内完成（假设小于100ms）
        expect(endTime - startTime).toBeLessThan(100);
        expect(isAffected).toBe(false); // 因为这些块都不存在于当前文档
    });
});

/**
 * 运行块检测测试
 */
export function runBlockDetectionTests() {
    console.log('开始运行块检测逻辑测试...\n');
    
    console.log('块检测测试需要在 Jest 环境中运行');
    console.log('在思源环境中，请使用浏览器开发者工具测试块检测逻辑');
    
    return true;
}

// 如果直接运行此文件，执行测试
if (typeof window === 'undefined') {
    runBlockDetectionTests();
}

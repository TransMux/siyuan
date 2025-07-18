/**
 * 当前文档聚焦逻辑测试
 * 测试 WebSocketManager 是否正确处理当前聚焦文档的变更
 */

import { WebSocketManager } from '../core/WebSocketManager';

/**
 * 模拟 WebSocket 消息数据
 */
const mockTransactionMessages = {
    // 当前文档的标题变更
    currentDocHeadingChange: {
        cmd: 'transactions',
        data: [{
            doOperations: [{
                action: 'update',
                id: '20231201-heading-001',
                data: '<div data-type="NodeHeading" data-subtype="h1" data-root-id="20231201-current-doc">修改后的标题</div>'
            }]
        }]
    },

    // 其他文档的标题变更
    otherDocHeadingChange: {
        cmd: 'transactions',
        data: [{
            doOperations: [{
                action: 'update',
                id: '20231201-heading-002',
                data: '<div data-type="NodeHeading" data-subtype="h1" data-root-id="20231201-other-doc">其他文档标题</div>'
            }]
        }]
    },

    // 当前文档的段落变更（不影响标题）
    currentDocParagraphChange: {
        cmd: 'transactions',
        data: [{
            doOperations: [{
                action: 'update',
                id: '20231201-para-001',
                data: '<div data-type="NodeParagraph" data-root-id="20231201-current-doc">段落内容</div>'
            }]
        }]
    },

    // 当前文档的表格变更
    currentDocTableChange: {
        cmd: 'transactions',
        data: [{
            doOperations: [{
                action: 'insert',
                id: '20231201-table-001',
                data: '<div data-type="NodeTable" data-root-id="20231201-current-doc"><table><tr><td>表格内容</td></tr></table></div>'
            }]
        }]
    },

    // 混合变更：包含当前文档和其他文档
    mixedChanges: {
        cmd: 'transactions',
        data: [
            {
                doOperations: [{
                    action: 'update',
                    id: '20231201-heading-003',
                    data: '<div data-type="NodeHeading" data-subtype="h2" data-root-id="20231201-current-doc">当前文档标题</div>'
                }]
            },
            {
                doOperations: [{
                    action: 'update',
                    id: '20231201-heading-004',
                    data: '<div data-type="NodeHeading" data-subtype="h1" data-root-id="20231201-other-doc">其他文档标题</div>'
                }]
            }
        ]
    }
};

/**
 * 模拟依赖项
 */
function createMockDependencies(currentDocId: string = '20231201-current-doc') {
    const mockSettingsManager = {
        getSettings: jest.fn().mockReturnValue({
            realTimeUpdate: true,
            headingNumbering: true,
            crossReference: true
        }),
        isDocumentEnabled: jest.fn().mockReturnValue(true)
    } as any;

    const mockDocumentManager = {
        getCurrentDocId: jest.fn().mockReturnValue(currentDocId),
        isCurrentDocumentAffected: jest.fn().mockImplementation((msg: any) => {
            // 模拟 isCurrentDocumentAffected 的逻辑
            if (!msg.data || !Array.isArray(msg.data)) return false;
            return msg.data.some((transaction: any) =>
                transaction.doOperations?.some((operation: any) =>
                    operation.data?.includes(`data-root-id="${currentDocId}"`)
                )
            );
        }),
        isDocumentAffected: jest.fn().mockImplementation((msg: any, docId: string) => {
            // 模拟 isDocumentAffected 的逻辑
            if (!msg.data || !Array.isArray(msg.data)) return false;
            return msg.data.some((transaction: any) =>
                transaction.doOperations?.some((operation: any) =>
                    operation.data?.includes(`data-root-id="${docId}"`)
                )
            );
        })
    } as any;

    const mockHeadingNumbering = {
        updateNumberingForDoc: jest.fn().mockResolvedValue(undefined)
    } as any;

    const mockCrossReference = {
        applyCrossReference: jest.fn().mockResolvedValue(undefined)
    } as any;

    return {
        mockSettingsManager,
        mockDocumentManager,
        mockHeadingNumbering,
        mockCrossReference
    };
}

/**
 * 测试当前文档聚焦逻辑
 */
describe('Current Document Focus Logic', () => {
    let webSocketManager: WebSocketManager;
    let mockDependencies: any;

    beforeEach(() => {
        // 设置模拟环境
        mockDependencies = createMockDependencies();
        
        // 模拟 window.siyuan
        (global as any).window = {
            siyuan: {
                ws: {
                    ws: {
                        readyState: WebSocket.OPEN,
                        addEventListener: jest.fn(),
                        removeEventListener: jest.fn()
                    }
                }
            }
        };

        webSocketManager = new WebSocketManager(
            mockDependencies.mockSettingsManager,
            mockDependencies.mockDocumentManager,
            mockDependencies.mockHeadingNumbering,
            mockDependencies.mockCrossReference
        );
    });

    afterEach(() => {
        webSocketManager.destroy();
        delete (global as any).window;
    });

    test('应该处理当前文档的标题变更', async () => {
        await webSocketManager.init();

        // 模拟接收当前文档的标题变更消息
        const handleTransactionMessage = (webSocketManager as any).handleTransactionMessage.bind(webSocketManager);
        await handleTransactionMessage(mockTransactionMessages.currentDocHeadingChange);

        // 验证是否调用了标题更新
        expect(mockDependencies.mockHeadingNumbering.updateNumberingForDoc)
            .toHaveBeenCalledWith('20231201-current-doc');
    });

    test('应该忽略其他文档的标题变更', async () => {
        await webSocketManager.init();

        // 模拟接收其他文档的标题变更消息
        const handleTransactionMessage = (webSocketManager as any).handleTransactionMessage.bind(webSocketManager);
        await handleTransactionMessage(mockTransactionMessages.otherDocHeadingChange);

        // 验证没有调用标题更新
        expect(mockDependencies.mockHeadingNumbering.updateNumberingForDoc)
            .not.toHaveBeenCalled();
    });

    test('应该忽略当前文档的非标题变更', async () => {
        await webSocketManager.init();

        // 模拟接收当前文档的段落变更消息
        const handleTransactionMessage = (webSocketManager as any).handleTransactionMessage.bind(webSocketManager);
        await handleTransactionMessage(mockTransactionMessages.currentDocParagraphChange);

        // 验证没有调用标题更新
        expect(mockDependencies.mockHeadingNumbering.updateNumberingForDoc)
            .not.toHaveBeenCalled();
    });

    test('应该处理当前文档的表格变更', async () => {
        await webSocketManager.init();

        // 模拟接收当前文档的表格变更消息
        const handleTransactionMessage = (webSocketManager as any).handleTransactionMessage.bind(webSocketManager);
        await handleTransactionMessage(mockTransactionMessages.currentDocTableChange);

        // 验证没有调用标题更新（因为不是标题变更）
        expect(mockDependencies.mockHeadingNumbering.updateNumberingForDoc)
            .not.toHaveBeenCalled();
    });

    test('应该正确处理混合变更消息', async () => {
        await webSocketManager.init();

        // 模拟接收混合变更消息
        const handleTransactionMessage = (webSocketManager as any).handleTransactionMessage.bind(webSocketManager);
        await handleTransactionMessage(mockTransactionMessages.mixedChanges);

        // 验证只处理了当前文档的变更
        expect(mockDependencies.mockHeadingNumbering.updateNumberingForDoc)
            .toHaveBeenCalledWith('20231201-current-doc');
        expect(mockDependencies.mockHeadingNumbering.updateNumberingForDoc)
            .toHaveBeenCalledTimes(1);
    });

    test('DocumentManager.isCurrentDocumentAffected 方法应该正确识别当前文档变更', () => {
        // 测试当前文档变更
        expect(mockDependencies.mockDocumentManager.isCurrentDocumentAffected(
            mockTransactionMessages.currentDocHeadingChange
        )).toBe(true);

        // 测试其他文档变更
        expect(mockDependencies.mockDocumentManager.isCurrentDocumentAffected(
            mockTransactionMessages.otherDocHeadingChange
        )).toBe(false);

        // 测试混合变更
        expect(mockDependencies.mockDocumentManager.isCurrentDocumentAffected(
            mockTransactionMessages.mixedChanges
        )).toBe(true);
    });

    test('应该在没有当前文档时跳过处理', async () => {
        // 设置没有当前文档的情况
        mockDependencies.mockDocumentManager.getCurrentDocId.mockReturnValue(null);

        await webSocketManager.init();

        // 模拟接收消息
        const handleTransactionMessage = (webSocketManager as any).handleTransactionMessage.bind(webSocketManager);
        await handleTransactionMessage(mockTransactionMessages.currentDocHeadingChange);

        // 验证没有调用任何更新
        expect(mockDependencies.mockHeadingNumbering.updateNumberingForDoc)
            .not.toHaveBeenCalled();
    });

    test('应该在文档未启用编号时跳过处理', async () => {
        // 设置文档未启用编号
        mockDependencies.mockSettingsManager.isDocumentEnabled.mockReturnValue(false);

        await webSocketManager.init();

        // 模拟接收消息
        const handleTransactionMessage = (webSocketManager as any).handleTransactionMessage.bind(webSocketManager);
        await handleTransactionMessage(mockTransactionMessages.currentDocHeadingChange);

        // 验证没有调用更新
        expect(mockDependencies.mockHeadingNumbering.updateNumberingForDoc)
            .not.toHaveBeenCalled();
    });

    test('应该在实时更新关闭时跳过处理', async () => {
        // 设置实时更新关闭
        mockDependencies.mockSettingsManager.getSettings.mockReturnValue({
            realTimeUpdate: false,
            headingNumbering: true,
            crossReference: true
        });

        await webSocketManager.init();

        // 模拟接收消息
        const handleTransactionMessage = (webSocketManager as any).handleTransactionMessage.bind(webSocketManager);
        await handleTransactionMessage(mockTransactionMessages.currentDocHeadingChange);

        // 验证没有调用更新
        expect(mockDependencies.mockHeadingNumbering.updateNumberingForDoc)
            .not.toHaveBeenCalled();
    });
});

/**
 * 运行当前文档聚焦测试
 */
export function runCurrentDocumentFocusTests() {
    console.log('开始运行当前文档聚焦逻辑测试...\n');
    
    // 注意：这些测试需要 Jest 环境
    // 在实际的思源环境中，可以创建简化版本的测试
    
    console.log('当前文档聚焦测试需要在 Jest 环境中运行');
    console.log('在思源环境中，请使用浏览器开发者工具测试聚焦逻辑');
    
    return true;
}

// 如果直接运行此文件，执行测试
if (typeof window === 'undefined') {
    runCurrentDocumentFocusTests();
}

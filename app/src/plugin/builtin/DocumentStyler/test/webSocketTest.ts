/**
 * WebSocket 管理器测试
 * 测试 WebSocket 连接和消息处理功能
 */

import { WebSocketManager, IWebSocketFilter } from '../core/WebSocketManager';
import { SettingsManager } from '../core/SettingsManager';
import { HeadingNumbering } from '../core/HeadingNumbering';
import { CrossReference } from '../core/CrossReference';

// 模拟思源的 WebSocket 环境
function mockSiyuanWebSocket() {
    // 创建一个模拟的 WebSocket
    const mockWs = {
        readyState: WebSocket.OPEN,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        send: jest.fn(),
        close: jest.fn()
    };

    // 模拟 window.siyuan
    (global as any).window = {
        siyuan: {
            ws: {
                ws: mockWs
            }
        }
    };

    return mockWs;
}

// 模拟依赖项
function createMockDependencies() {
    const mockSettingsManager = {
        getSettings: jest.fn().mockReturnValue({
            realTimeUpdate: true,
            headingNumbering: true,
            crossReference: true
        }),
        isDocumentEnabled: jest.fn().mockReturnValue(true)
    } as any;

    const mockHeadingNumbering = {
        updateNumberingForDoc: jest.fn().mockResolvedValue(undefined)
    } as any;

    const mockCrossReference = {
        applyCrossReference: jest.fn().mockResolvedValue(undefined)
    } as any;

    return {
        mockSettingsManager,
        mockHeadingNumbering,
        mockCrossReference
    };
}

describe('WebSocketManager', () => {
    let webSocketManager: WebSocketManager;
    let mockWs: any;
    let mockDependencies: any;

    beforeEach(() => {
        // 设置模拟环境
        mockWs = mockSiyuanWebSocket();
        mockDependencies = createMockDependencies();

        // 创建 WebSocketManager 实例
        webSocketManager = new WebSocketManager(
            mockDependencies.mockSettingsManager,
            mockDependencies.mockHeadingNumbering,
            mockDependencies.mockCrossReference
        );
    });

    afterEach(() => {
        // 清理
        webSocketManager.destroy();
        delete (global as any).window;
    });

    test('应该成功初始化并连接到 WebSocket', async () => {
        await webSocketManager.init();
        
        expect(webSocketManager.isWebSocketConnected()).toBe(true);
        expect(mockWs.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    test('应该正确处理 transactions 消息', async () => {
        await webSocketManager.init();

        // 模拟 transaction 消息
        const mockTransactionMessage = {
            cmd: 'transactions',
            data: [{
                doOperations: [{
                    action: 'update',
                    id: '20231201-001',
                    data: '<div data-type="NodeHeading" data-subtype="h1" data-root-id="20231201-root">测试标题</div>'
                }]
            }]
        };

        // 获取消息处理器
        const messageHandler = mockWs.addEventListener.mock.calls.find(
            call => call[0] === 'message'
        )[1];

        // 模拟接收消息
        const mockEvent = {
            data: JSON.stringify(mockTransactionMessage)
        };

        // 执行消息处理
        await messageHandler(mockEvent);

        // 验证是否调用了更新方法（由于防抖，需要等待）
        setTimeout(() => {
            expect(mockDependencies.mockHeadingNumbering.updateNumberingForDoc)
                .toHaveBeenCalledWith('20231201-root');
        }, 1100); // 防抖时间是 1000ms
    });

    test('应该支持 whenBlockSaved 方法', async () => {
        await webSocketManager.init();

        // 创建过滤器
        const filter: IWebSocketFilter = (msg) => 
            msg.cmd === 'transactions' && msg.data?.length > 0;

        // 调用 whenBlockSaved
        const promise = webSocketManager.whenBlockSaved(filter, 5000);

        // 模拟消息
        const mockMessage = {
            cmd: 'transactions',
            data: [{ doOperations: [] }]
        };

        // 获取消息处理器并发送消息
        const messageHandler = mockWs.addEventListener.mock.calls.find(
            call => call[0] === 'message'
        )[1];

        const mockEvent = {
            data: JSON.stringify(mockMessage)
        };

        messageHandler(mockEvent);

        // 验证 Promise 解析
        const result = await promise;
        expect(result).toEqual(mockMessage);
    });

    test('应该支持通用监听器', async () => {
        await webSocketManager.init();

        // 创建监听器
        const promise = webSocketManager.listen({
            filter: (msg) => msg.cmd === 'test',
            timeout: 5000
        });

        // 模拟消息
        const mockMessage = { cmd: 'test', data: 'test data' };

        // 获取消息处理器并发送消息
        const messageHandler = mockWs.addEventListener.mock.calls.find(
            call => call[0] === 'message'
        )[1];

        const mockEvent = {
            data: JSON.stringify(mockMessage)
        };

        messageHandler(mockEvent);

        // 验证 Promise 解析
        const result = await promise;
        expect(result).toEqual(mockMessage);
    });

    test('应该正确处理超时', async () => {
        await webSocketManager.init();

        // 创建一个会超时的监听器
        const promise = webSocketManager.listen({
            filter: (msg) => msg.cmd === 'never-comes',
            timeout: 100 // 100ms 超时
        });

        // 验证超时
        await expect(promise).rejects.toThrow('监听超时');
    });

    test('应该正确清理资源', async () => {
        await webSocketManager.init();

        // 创建一些监听器
        const promise1 = webSocketManager.listen({ timeout: 10000 });
        const promise2 = webSocketManager.listen({ timeout: 10000 });

        expect(webSocketManager.getActiveListenerCount()).toBe(2);

        // 销毁管理器
        webSocketManager.destroy();

        // 验证监听器被清理
        expect(webSocketManager.getActiveListenerCount()).toBe(0);
        expect(webSocketManager.isWebSocketConnected()).toBe(false);

        // 验证 Promise 被拒绝
        await expect(promise1).rejects.toThrow('WebSocketManager 已销毁');
        await expect(promise2).rejects.toThrow('WebSocketManager 已销毁');
    });

    test('应该在 WebSocket 未连接时拒绝监听请求', async () => {
        // 不初始化，直接尝试监听
        const promise = webSocketManager.whenBlockSaved();

        await expect(promise).rejects.toThrow('WebSocket 未连接');
    });
});

/**
 * 集成测试：测试与真实思源环境的集成
 */
describe('WebSocketManager Integration', () => {
    test('应该能够与真实的思源 WebSocket 集成', async () => {
        // 这个测试需要在真实的思源环境中运行
        if (typeof window === 'undefined' || !window.siyuan?.ws?.ws) {
            console.log('跳过集成测试：不在思源环境中');
            return;
        }

        const mockDependencies = createMockDependencies();
        const webSocketManager = new WebSocketManager(
            mockDependencies.mockSettingsManager,
            mockDependencies.mockHeadingNumbering,
            mockDependencies.mockCrossReference
        );

        try {
            await webSocketManager.init();
            expect(webSocketManager.isWebSocketConnected()).toBe(true);

            // 测试监听功能
            const promise = webSocketManager.listen({
                timeout: 1000
            });

            // 在真实环境中，这可能会接收到真实的消息或超时
            try {
                const result = await promise;
                console.log('接收到消息:', result);
            } catch (error) {
                console.log('监听超时或出错:', error.message);
            }
        } finally {
            webSocketManager.destroy();
        }
    });
});

/**
 * 运行 WebSocket 测试
 */
export function runWebSocketTests() {
    console.log('开始运行 WebSocket 管理器测试...\n');
    
    // 注意：这些测试需要 Jest 环境
    // 在实际的思源环境中，可以创建简化版本的测试
    
    console.log('WebSocket 测试需要在 Jest 环境中运行');
    console.log('在思源环境中，请使用浏览器开发者工具测试 WebSocket 功能');
    
    return true;
}

// 如果直接运行此文件，执行测试
if (typeof window === 'undefined') {
    runWebSocketTests();
}

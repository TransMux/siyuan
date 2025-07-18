/**
 * WebSocket 管理器使用示例
 * 展示如何使用 WebSocketManager 监听文档变更事件
 */

import { WebSocketManager, IWebSocketFilter } from '../core/WebSocketManager';

/**
 * 示例1：监听块保存事件
 */
async function example1_WhenBlockSaved() {
    console.log('=== 示例1：监听块保存事件 ===');
    
    // 假设已经有了 WebSocketManager 实例
    const webSocketManager = getWebSocketManagerInstance();
    
    try {
        // 创建过滤器，只监听包含标题的 transaction
        const headingFilter: IWebSocketFilter = (msg) => {
            if (msg.cmd !== 'transactions') return false;
            
            // 检查是否包含标题相关的操作
            return msg.data?.some((transaction: any) => 
                transaction.doOperations?.some((op: any) => 
                    op.data?.includes('data-type="NodeHeading"')
                )
            );
        };
        
        console.log('开始监听标题块保存事件...');
        
        // 等待标题块被保存
        const result = await webSocketManager.whenBlockSaved(headingFilter, 30000);
        
        console.log('检测到标题块保存:', result);
        
        // 处理标题变更
        console.log('处理标题编号更新...');
        
    } catch (error) {
        console.error('监听标题块保存失败:', error);
    }
}

/**
 * 示例2：监听特定文档的变更
 */
async function example2_ListenToSpecificDocument() {
    console.log('=== 示例2：监听特定文档的变更 ===');
    
    const webSocketManager = getWebSocketManagerInstance();
    const targetDocId = '20231201-example-doc';
    
    try {
        // 创建文档特定的过滤器
        const docFilter: IWebSocketFilter = (msg) => {
            if (msg.cmd !== 'transactions') return false;
            
            return msg.data?.some((transaction: any) => 
                transaction.doOperations?.some((op: any) => 
                    op.data?.includes(`data-root-id="${targetDocId}"`)
                )
            );
        };
        
        console.log(`开始监听文档 ${targetDocId} 的变更...`);
        
        // 监听文档变更
        const result = await webSocketManager.listen({
            filter: docFilter,
            timeout: 60000 // 1分钟超时
        });
        
        console.log('检测到文档变更:', result);
        
        // 分析变更类型
        analyzeDocumentChanges(result);
        
    } catch (error) {
        console.error('监听文档变更失败:', error);
    }
}

/**
 * 示例3：连续监听多个事件
 */
async function example3_ContinuousListening() {
    console.log('=== 示例3：连续监听多个事件 ===');
    
    const webSocketManager = getWebSocketManagerInstance();
    let eventCount = 0;
    const maxEvents = 5;
    
    try {
        while (eventCount < maxEvents) {
            console.log(`等待第 ${eventCount + 1} 个事件...`);
            
            // 监听任何 transaction 事件
            const result = await webSocketManager.listen({
                filter: (msg) => msg.cmd === 'transactions',
                timeout: 10000 // 10秒超时
            });
            
            eventCount++;
            console.log(`接收到第 ${eventCount} 个事件:`, {
                cmd: result.cmd,
                dataLength: result.data?.length || 0,
                timestamp: new Date().toISOString()
            });
            
            // 简单分析事件
            if (result.data?.length > 0) {
                const operations = result.data.flatMap((t: any) => t.doOperations || []);
                const actions = operations.map((op: any) => op.action).filter(Boolean);
                console.log('操作类型:', [...new Set(actions)]);
            }
        }
        
        console.log(`成功监听了 ${eventCount} 个事件`);
        
    } catch (error) {
        console.error('连续监听失败:', error);
    }
}

/**
 * 示例4：监听特定类型的块操作
 */
async function example4_ListenToBlockTypes() {
    console.log('=== 示例4：监听特定类型的块操作 ===');
    
    const webSocketManager = getWebSocketManagerInstance();
    
    // 定义要监听的块类型
    const blockTypes = ['NodeHeading', 'NodeTable', 'NodeParagraph'];
    
    try {
        for (const blockType of blockTypes) {
            console.log(`监听 ${blockType} 类型的块操作...`);
            
            const typeFilter: IWebSocketFilter = (msg) => {
                if (msg.cmd !== 'transactions') return false;
                
                return msg.data?.some((transaction: any) => 
                    transaction.doOperations?.some((op: any) => 
                        op.data?.includes(`data-type="${blockType}"`)
                    )
                );
            };
            
            try {
                const result = await webSocketManager.listen({
                    filter: typeFilter,
                    timeout: 5000 // 5秒超时
                });
                
                console.log(`检测到 ${blockType} 操作:`, {
                    operationCount: result.data?.reduce((count: number, t: any) => 
                        count + (t.doOperations?.length || 0), 0
                    )
                });
                
            } catch (timeoutError) {
                console.log(`${blockType} 类型在5秒内无操作`);
            }
        }
        
    } catch (error) {
        console.error('监听块类型操作失败:', error);
    }
}

/**
 * 示例5：实现自定义的实时更新逻辑
 */
async function example5_CustomRealTimeUpdate() {
    console.log('=== 示例5：自定义实时更新逻辑 ===');
    
    const webSocketManager = getWebSocketManagerInstance();
    
    // 实现一个简单的实时更新循环
    const startRealTimeUpdate = () => {
        let isRunning = true;
        
        const updateLoop = async () => {
            while (isRunning) {
                try {
                    // 等待任何文档变更
                    const result = await webSocketManager.listen({
                        filter: (msg) => msg.cmd === 'transactions',
                        timeout: 30000 // 30秒超时
                    });
                    
                    // 分析变更并决定是否需要更新
                    const needsUpdate = analyzeIfUpdateNeeded(result);
                    
                    if (needsUpdate.headings) {
                        console.log('检测到标题变更，更新编号...');
                        // 这里调用标题编号更新逻辑
                    }
                    
                    if (needsUpdate.figures) {
                        console.log('检测到图片/表格变更，更新索引...');
                        // 这里调用图片表格索引更新逻辑
                    }
                    
                } catch (error) {
                    if (error.message.includes('监听超时')) {
                        console.log('30秒内无变更，继续监听...');
                    } else {
                        console.error('实时更新出错:', error);
                        break;
                    }
                }
            }
        };
        
        // 启动更新循环
        updateLoop();
        
        // 返回停止函数
        return () => {
            isRunning = false;
            console.log('停止实时更新');
        };
    };
    
    // 启动实时更新
    const stopUpdate = startRealTimeUpdate();
    
    // 10秒后停止
    setTimeout(stopUpdate, 10000);
}

/**
 * 辅助函数：获取 WebSocketManager 实例
 */
function getWebSocketManagerInstance(): WebSocketManager {
    // 在实际使用中，这应该从插件实例中获取
    // 这里只是示例，假设有全局访问方式
    if ((window as any).documentStylerPlugin?.webSocketManager) {
        return (window as any).documentStylerPlugin.webSocketManager;
    }
    
    throw new Error('WebSocketManager 实例不可用');
}

/**
 * 辅助函数：分析文档变更
 */
function analyzeDocumentChanges(result: any): void {
    if (!result.data) return;
    
    const operations = result.data.flatMap((t: any) => t.doOperations || []);
    const summary = {
        totalOperations: operations.length,
        actions: [...new Set(operations.map((op: any) => op.action))],
        blockTypes: [...new Set(operations.map((op: any) => {
            const match = op.data?.match(/data-type="([^"]+)"/);
            return match ? match[1] : null;
        }).filter(Boolean))]
    };
    
    console.log('变更分析:', summary);
}

/**
 * 辅助函数：分析是否需要更新
 */
function analyzeIfUpdateNeeded(result: any): { headings: boolean; figures: boolean } {
    if (!result.data) return { headings: false, figures: false };
    
    const operations = result.data.flatMap((t: any) => t.doOperations || []);
    
    const hasHeadingChanges = operations.some((op: any) => 
        op.data?.includes('data-type="NodeHeading"')
    );
    
    const hasFigureChanges = operations.some((op: any) => 
        op.data?.includes('data-type="NodeTable"') || 
        op.data?.includes('<img')
    );
    
    return {
        headings: hasHeadingChanges,
        figures: hasFigureChanges
    };
}

/**
 * 运行所有示例
 */
export async function runWebSocketExamples() {
    console.log('开始运行 WebSocket 使用示例...\n');
    
    try {
        // 检查环境
        if (!getWebSocketManagerInstance()) {
            console.log('WebSocketManager 不可用，跳过示例');
            return;
        }
        
        // 运行示例（注意：这些是异步的，在实际使用中可能需要按需调用）
        console.log('提示：这些示例展示了 WebSocketManager 的各种用法');
        console.log('在实际使用中，请根据需要选择合适的监听方式');
        
        // 可以取消注释来运行特定示例
        // await example1_WhenBlockSaved();
        // await example2_ListenToSpecificDocument();
        // await example3_ContinuousListening();
        // await example4_ListenToBlockTypes();
        // await example5_CustomRealTimeUpdate();
        
    } catch (error) {
        console.error('运行示例失败:', error);
    }
}

// 如果直接运行此文件，执行示例
if (typeof window !== 'undefined') {
    runWebSocketExamples();
}

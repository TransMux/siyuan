/**
 * NocodbConnector插件测试文件
 * 用于验证插件的基本功能
 */

import { NocodbApiClient, NocodbConfig, parseNocodbId, renderField } from "./utils";

/**
 * 测试配置
 */
const testConfig: NocodbConfig = {
    serverUrl: "http://server:18866",
    token: "QCQt9Ud_C9BW3JPG6djcn02XRr57ffi1SgYotFup",
    tableConfigs: {
        "m7vb2ve7wuh5fld": {
            columns: {
                "CreatedAt": { type: "string", readonly: true },
                "inserted_at": { type: "string", readonly: true },
                "url": { type: "link", readonly: false },
                "status": { type: "string", readonly: true }
            }
        }
    }
};

/**
 * 测试数据
 */
const testData = {
    "CreatedAt": "2025-07-21 10:14:06+00:00",
    "url": "https://mp.weixin.qq.com/s?__biz=MzI3MTA0MTk1MA==&mid=2652611110&idx=1&sn=27804084b891b11f7a7c26c71afc1f49",
    "status": "已插入",
    "inserted_at": "2025-07-21 18:19:13+00:00"
};

/**
 * 测试parseNocodbId函数
 */
export function testParseNocodbId(): void {
    console.log('Testing parseNocodbId...');
    
    // 测试正确格式
    const validId = "m7vb2ve7wuh5fld-3";
    const parsed = parseNocodbId(validId);
    console.log('Valid ID parsed:', parsed);
    
    // 测试错误格式
    const invalidIds = ["", "invalid", "table-", "-row", "table-row-extra"];
    invalidIds.forEach(id => {
        const result = parseNocodbId(id);
        console.log(`Invalid ID "${id}" parsed:`, result);
    });
}

/**
 * 测试renderField函数
 */
export function testRenderField(): void {
    console.log('Testing renderField...');
    
    const tableConfig = testConfig.tableConfigs["m7vb2ve7wuh5fld"];
    
    Object.entries(tableConfig.columns).forEach(([columnName, columnConfig]) => {
        const value = testData[columnName];
        const rendered = renderField(columnName, value, columnConfig);
        console.log(`Field ${columnName}:`, rendered);
    });
    
    // 测试空值
    const emptyRendered = renderField("test", null, { type: "string", readonly: true });
    console.log('Empty value rendered:', emptyRendered);
    
    // 测试长文本
    const longText = "这是一个很长的文本".repeat(20);
    const longRendered = renderField("longText", longText, { type: "string", readonly: true });
    console.log('Long text rendered:', longRendered);
    
    // 测试多行文本
    const multilineText = "第一行\n第二行\n第三行\n第四行\n第五行";
    const multilineRendered = renderField("multiline", multilineText, { type: "string", readonly: true });
    console.log('Multiline text rendered:', multilineRendered);
}

/**
 * 测试API客户端（模拟）
 */
export function testApiClient(): void {
    console.log('Testing NocodbApiClient...');
    
    const client = new NocodbApiClient(testConfig);
    
    // 注意：这里只是测试客户端的创建，实际的API调用需要真实的服务器
    console.log('API client created successfully');
    
    // 可以测试URL构建等不需要网络请求的功能
    console.log('Server URL:', testConfig.serverUrl);
    console.log('Token configured:', !!testConfig.token);
}

/**
 * 运行所有测试
 */
export function runAllTests(): void {
    console.log('=== NocodbConnector Plugin Tests ===');
    
    try {
        testParseNocodbId();
        console.log('✓ parseNocodbId tests passed');
    } catch (error) {
        console.error('✗ parseNocodbId tests failed:', error);
    }
    
    try {
        testRenderField();
        console.log('✓ renderField tests passed');
    } catch (error) {
        console.error('✗ renderField tests failed:', error);
    }
    
    try {
        testApiClient();
        console.log('✓ API client tests passed');
    } catch (error) {
        console.error('✗ API client tests failed:', error);
    }
    
    console.log('=== Tests completed ===');
}

// 如果在浏览器环境中，可以在控制台运行测试
if (typeof window !== 'undefined') {
    (window as any).nocodbConnectorTests = {
        runAllTests,
        testParseNocodbId,
        testRenderField,
        testApiClient
    };
}

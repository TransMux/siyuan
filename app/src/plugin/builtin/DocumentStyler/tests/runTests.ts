/**
 * 测试运行器
 * 用于运行DocumentStyler插件的所有测试
 */

import { runCrossReferenceTests } from './CrossReferenceTest';

/**
 * 运行所有测试
 */
export function runAllDocumentStylerTests(): void {
    console.log('='.repeat(50));
    console.log('DocumentStyler 插件测试套件');
    console.log('='.repeat(50));

    const testResults: { name: string; passed: boolean }[] = [];

    // 运行交叉引用测试
    try {
        const crossRefResult = runCrossReferenceTests();
        testResults.push({ name: '交叉引用系统', passed: crossRefResult });
    } catch (error) {
        console.error('交叉引用测试运行失败:', error);
        testResults.push({ name: '交叉引用系统', passed: false });
    }

    // 输出总结
    console.log('\n' + '='.repeat(50));
    console.log('测试总结');
    console.log('='.repeat(50));

    const passedCount = testResults.filter(r => r.passed).length;
    const totalCount = testResults.length;

    testResults.forEach(result => {
        const status = result.passed ? '✓ 通过' : '✗ 失败';
        console.log(`${result.name}: ${status}`);
    });

    console.log(`\n总计: ${passedCount}/${totalCount} 个测试套件通过`);

    if (passedCount === totalCount) {
        console.log('🎉 所有测试通过！新的交叉引用系统可以正常工作。');
    } else {
        console.log('❌ 部分测试失败，需要检查实现。');
    }
}

// 如果直接运行此文件，执行测试
if (typeof window !== 'undefined' && (window as any).runDocumentStylerTests) {
    runAllDocumentStylerTests();
}

// 导出给外部调用
(window as any).runDocumentStylerTests = runAllDocumentStylerTests;

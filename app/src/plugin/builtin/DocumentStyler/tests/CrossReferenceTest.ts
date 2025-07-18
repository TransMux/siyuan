/**
 * 交叉引用系统测试
 * 测试超级块中图片/表格自动标题识别功能
 */

import { CrossReference } from "../core/CrossReference";
import { DocumentManager } from "../core/DocumentManager";

/**
 * 模拟DOM环境的测试工具
 */
class MockDOMHelper {
    /**
     * 创建模拟的超级块DOM结构
     * @param layout 布局类型
     * @param children 子元素配置
     * @returns 模拟的DOM元素
     */
    static createMockSuperBlock(layout: 'row' | 'col', children: Array<{
        type: 'image' | 'table' | 'paragraph';
        id: string;
        content?: string;
    }>): Element {
        const sb = document.createElement('div');
        sb.setAttribute('data-type', 'NodeSuperBlock');
        sb.setAttribute('data-sb-layout', layout);
        sb.setAttribute('data-node-id', 'sb-' + Math.random().toString(36).substr(2, 9));
        sb.className = 'sb';

        children.forEach(child => {
            let childElement: Element;

            switch (child.type) {
                case 'image':
                    childElement = this.createMockImageParagraph(child.id, child.content);
                    break;
                case 'table':
                    childElement = this.createMockTable(child.id);
                    break;
                case 'paragraph':
                    childElement = this.createMockParagraph(child.id, child.content || '');
                    break;
            }

            sb.appendChild(childElement);
        });

        // 添加属性元素
        const attr = document.createElement('div');
        attr.className = 'protyle-attr';
        attr.setAttribute('contenteditable', 'false');
        attr.innerHTML = '&ZeroWidthSpace;';
        sb.appendChild(attr);

        return sb;
    }

    /**
     * 创建包含图片的段落元素
     */
    private static createMockImageParagraph(id: string, alt?: string): Element {
        const p = document.createElement('div');
        p.setAttribute('data-type', 'NodeParagraph');
        p.setAttribute('data-node-id', id);
        p.className = 'p';

        const editableDiv = document.createElement('div');
        editableDiv.setAttribute('contenteditable', 'true');
        editableDiv.innerHTML = `
            <span contenteditable="false" data-type="img" class="img">
                <img src="assets/test.png" alt="${alt || ''}" loading="lazy">
            </span>
        `;

        p.appendChild(editableDiv);
        return p;
    }

    /**
     * 创建表格元素
     */
    private static createMockTable(id: string): Element {
        const table = document.createElement('div');
        table.setAttribute('data-type', 'NodeTable');
        table.setAttribute('data-node-id', id);
        table.className = 'table';

        const tableContent = document.createElement('div');
        tableContent.innerHTML = `
            <table>
                <thead>
                    <tr><th>Header 1</th><th>Header 2</th></tr>
                </thead>
                <tbody>
                    <tr><td>Data 1</td><td>Data 2</td></tr>
                </tbody>
            </table>
        `;

        table.appendChild(tableContent);
        return table;
    }

    /**
     * 创建文本段落元素
     */
    private static createMockParagraph(id: string, text: string): Element {
        const p = document.createElement('div');
        p.setAttribute('data-type', 'NodeParagraph');
        p.setAttribute('data-node-id', id);
        p.className = 'p';

        const editableDiv = document.createElement('div');
        editableDiv.setAttribute('contenteditable', 'true');
        editableDiv.textContent = text;

        p.appendChild(editableDiv);
        return p;
    }

    /**
     * 创建模拟的protyle环境
     */
    static createMockProtyle(superBlocks: Element[]): any {
        const container = document.createElement('div');
        container.className = 'protyle-wysiwyg';

        superBlocks.forEach(sb => container.appendChild(sb));

        return {
            wysiwyg: {
                element: container
            }
        };
    }
}

/**
 * 交叉引用测试套件
 */
export class CrossReferenceTest {
    private crossReference: CrossReference;
    private mockDocumentManager: DocumentManager;

    constructor() {
        // 创建模拟的DocumentManager
        this.mockDocumentManager = {
            getCurrentProtyle: () => null,
            isCurrentDocumentAffected: () => true
        } as any;

        this.crossReference = new CrossReference(this.mockDocumentManager);
    }

    /**
     * 测试竖直布局超级块中的图片-标题识别
     */
    testImageCaptionInVerticalSuperBlock(): boolean {
        console.log('测试: 竖直布局超级块中的图片-标题识别');

        // 创建包含图片和标题的竖直超级块
        const superBlock = MockDOMHelper.createMockSuperBlock('col', [
            { type: 'image', id: 'img-001' },
            { type: 'paragraph', id: 'caption-001', content: '这是图片的标题' }
        ]);

        const protyle = MockDOMHelper.createMockProtyle([superBlock]);

        // 使用私有方法测试（需要类型断言）
        const figures = (this.crossReference as any).parseSuperBlockFigures(protyle);

        // 验证结果
        const success = figures.length === 1 && 
                       figures[0].type === 'image' && 
                       figures[0].captionText === '这是图片的标题';

        console.log(success ? '✓ 测试通过' : '✗ 测试失败', { figures });
        return success;
    }

    /**
     * 测试竖直布局超级块中的表格-标题识别
     */
    testTableCaptionInVerticalSuperBlock(): boolean {
        console.log('测试: 竖直布局超级块中的表格-标题识别');

        const superBlock = MockDOMHelper.createMockSuperBlock('col', [
            { type: 'paragraph', id: 'caption-002', content: '数据统计表' },
            { type: 'table', id: 'table-001' }
        ]);

        const protyle = MockDOMHelper.createMockProtyle([superBlock]);
        const figures = (this.crossReference as any).parseSuperBlockFigures(protyle);

        const success = figures.length === 1 && 
                       figures[0].type === 'table' && 
                       figures[0].captionText === '数据统计表';

        console.log(success ? '✓ 测试通过' : '✗ 测试失败', { figures });
        return success;
    }

    /**
     * 测试水平布局超级块（应该被忽略）
     */
    testHorizontalSuperBlockIgnored(): boolean {
        console.log('测试: 水平布局超级块应该被忽略');

        const superBlock = MockDOMHelper.createMockSuperBlock('row', [
            { type: 'image', id: 'img-002' },
            { type: 'paragraph', id: 'caption-003', content: '这个标题应该被忽略' }
        ]);

        const protyle = MockDOMHelper.createMockProtyle([superBlock]);
        const figures = (this.crossReference as any).parseSuperBlockFigures(protyle);

        const success = figures.length === 0;

        console.log(success ? '✓ 测试通过' : '✗ 测试失败', { figures });
        return success;
    }

    /**
     * 测试超过两个子元素的超级块（应该被忽略）
     */
    testSuperBlockWithMoreThanTwoChildren(): boolean {
        console.log('测试: 超过两个子元素的超级块应该被忽略');

        const superBlock = MockDOMHelper.createMockSuperBlock('col', [
            { type: 'image', id: 'img-003' },
            { type: 'paragraph', id: 'caption-004', content: '标题1' },
            { type: 'paragraph', id: 'caption-005', content: '标题2' }
        ]);

        const protyle = MockDOMHelper.createMockProtyle([superBlock]);
        const figures = (this.crossReference as any).parseSuperBlockFigures(protyle);

        const success = figures.length === 0;

        console.log(success ? '✓ 测试通过' : '✗ 测试失败', { figures });
        return success;
    }

    /**
     * 测试两个图片段落的超级块（应该被忽略）
     */
    testSuperBlockWithTwoImages(): boolean {
        console.log('测试: 两个图片段落的超级块应该被忽略');

        const superBlock = MockDOMHelper.createMockSuperBlock('col', [
            { type: 'image', id: 'img-004' },
            { type: 'image', id: 'img-005' }
        ]);

        const protyle = MockDOMHelper.createMockProtyle([superBlock]);
        const figures = (this.crossReference as any).parseSuperBlockFigures(protyle);

        const success = figures.length === 0;

        console.log(success ? '✓ 测试通过' : '✗ 测试失败', { figures });
        return success;
    }

    /**
     * 运行所有测试
     */
    runAllTests(): boolean {
        console.log('开始运行交叉引用系统测试...\n');

        const tests = [
            this.testImageCaptionInVerticalSuperBlock(),
            this.testTableCaptionInVerticalSuperBlock(),
            this.testHorizontalSuperBlockIgnored(),
            this.testSuperBlockWithMoreThanTwoChildren(),
            this.testSuperBlockWithTwoImages()
        ];

        const passedTests = tests.filter(result => result).length;
        const totalTests = tests.length;

        console.log(`\n测试完成: ${passedTests}/${totalTests} 通过`);

        if (passedTests === totalTests) {
            console.log('🎉 所有测试通过！');
            return true;
        } else {
            console.log('❌ 部分测试失败');
            return false;
        }
    }
}

// 导出测试运行函数
export function runCrossReferenceTests(): boolean {
    const tester = new CrossReferenceTest();
    return tester.runAllTests();
}

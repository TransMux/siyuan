/**
 * DockPanel 设置更新逻辑测试
 * 验证设置更新时不会误伤其他功能
 */

import { DockPanel } from "../ui/DockPanel";
import { SettingsManager } from "../core/SettingsManager";
import { DocumentManager } from "../core/DocumentManager";
import { CrossReference } from "../core/CrossReference";

// Mock 插件实例
class MockPluginInstance {
    public applyHeadingNumberingCalled = false;
    public clearHeadingNumberingCalled = false;
    public applyCrossReferenceCalled = false;
    public clearCrossReferenceCalled = false;

    async applyHeadingNumbering(): Promise<void> {
        this.applyHeadingNumberingCalled = true;
        console.log('Mock: applyHeadingNumbering called');
    }

    async clearHeadingNumbering(): Promise<void> {
        this.clearHeadingNumberingCalled = true;
        console.log('Mock: clearHeadingNumbering called');
    }

    async applyCrossReference(): Promise<void> {
        this.applyCrossReferenceCalled = true;
        console.log('Mock: applyCrossReference called');
    }

    async clearCrossReference(): Promise<void> {
        this.clearCrossReferenceCalled = true;
        console.log('Mock: clearCrossReference called');
    }

    reset(): void {
        this.applyHeadingNumberingCalled = false;
        this.clearHeadingNumberingCalled = false;
        this.applyCrossReferenceCalled = false;
        this.clearCrossReferenceCalled = false;
    }
}

// Mock SettingsManager
class MockSettingsManager extends SettingsManager {
    private mockDocSettings = {
        headingNumberingEnabled: false,
        crossReferenceEnabled: false,
        numberingFormats: ["{1}. ", "{1}.{2} ", "{1}.{2}.{3} ", "{1}.{2}.{3}.{4} ", "{1}.{2}.{3}.{4}.{5} ", "{1}.{2}.{3}.{4}.{5}.{6} "],
        headingNumberStyles: ["arabic", "arabic", "arabic", "arabic", "arabic", "arabic"]
    };

    async getDocumentSettings(docId: string): Promise<any> {
        return { ...this.mockDocSettings };
    }

    async setDocumentSettings(docId: string, settings: any): Promise<void> {
        Object.assign(this.mockDocSettings, settings);
        console.log(`Mock: setDocumentSettings called for ${docId}`, settings);
    }
}

// Mock DocumentManager
class MockDocumentManager extends DocumentManager {
    getCurrentDocId(): string | null {
        return "test-doc-id";
    }
}

// Mock CrossReference
class MockCrossReference extends CrossReference {
    async getFiguresList(docId: string): Promise<any[]> {
        return [];
    }
}

/**
 * 测试设置更新逻辑
 */
export class DockPanelSettingsTest {
    private dockPanel: DockPanel;
    private mockPlugin: MockPluginInstance;
    private mockSettingsManager: MockSettingsManager;
    private mockDocumentManager: MockDocumentManager;
    private mockCrossReference: MockCrossReference;

    constructor() {
        this.mockPlugin = new MockPluginInstance();
        this.mockSettingsManager = new MockSettingsManager(null as any);
        this.mockDocumentManager = new MockDocumentManager(null as any);
        this.mockCrossReference = new MockCrossReference(null as any);
        
        this.dockPanel = new DockPanel(
            this.mockSettingsManager,
            this.mockDocumentManager,
            this.mockCrossReference,
            this.mockPlugin
        );
    }

    /**
     * 测试只应用标题编号设置
     */
    async testApplyHeadingNumberingSettingsOnly(): Promise<boolean> {
        console.log('\n=== 测试只应用标题编号设置 ===');
        
        this.mockPlugin.reset();
        
        // 调用 applyHeadingNumberingSettings 方法
        await (this.dockPanel as any).applyHeadingNumberingSettings("test-doc-id", true);
        
        // 验证只有标题编号相关方法被调用
        const success = this.mockPlugin.applyHeadingNumberingCalled && 
                       !this.mockPlugin.applyCrossReferenceCalled &&
                       !this.mockPlugin.clearHeadingNumberingCalled &&
                       !this.mockPlugin.clearCrossReferenceCalled;
        
        console.log('标题编号应用方法被调用:', this.mockPlugin.applyHeadingNumberingCalled);
        console.log('交叉引用应用方法被调用:', this.mockPlugin.applyCrossReferenceCalled);
        console.log('测试结果:', success ? '通过' : '失败');
        
        return success;
    }

    /**
     * 测试只应用交叉引用设置
     */
    async testApplyCrossReferenceSettingsOnly(): Promise<boolean> {
        console.log('\n=== 测试只应用交叉引用设置 ===');
        
        this.mockPlugin.reset();
        
        // 调用 applyCrossReferenceSettings 方法
        await (this.dockPanel as any).applyCrossReferenceSettings("test-doc-id", true);
        
        // 验证只有交叉引用相关方法被调用
        const success = !this.mockPlugin.applyHeadingNumberingCalled && 
                       this.mockPlugin.applyCrossReferenceCalled &&
                       !this.mockPlugin.clearHeadingNumberingCalled &&
                       !this.mockPlugin.clearCrossReferenceCalled;
        
        console.log('标题编号应用方法被调用:', this.mockPlugin.applyHeadingNumberingCalled);
        console.log('交叉引用应用方法被调用:', this.mockPlugin.applyCrossReferenceCalled);
        console.log('测试结果:', success ? '通过' : '失败');
        
        return success;
    }

    /**
     * 测试清除标题编号设置
     */
    async testClearHeadingNumberingSettingsOnly(): Promise<boolean> {
        console.log('\n=== 测试清除标题编号设置 ===');
        
        this.mockPlugin.reset();
        
        // 调用 applyHeadingNumberingSettings 方法（禁用）
        await (this.dockPanel as any).applyHeadingNumberingSettings("test-doc-id", false);
        
        // 验证只有标题编号清除方法被调用
        const success = !this.mockPlugin.applyHeadingNumberingCalled && 
                       !this.mockPlugin.applyCrossReferenceCalled &&
                       this.mockPlugin.clearHeadingNumberingCalled &&
                       !this.mockPlugin.clearCrossReferenceCalled;
        
        console.log('标题编号清除方法被调用:', this.mockPlugin.clearHeadingNumberingCalled);
        console.log('交叉引用清除方法被调用:', this.mockPlugin.clearCrossReferenceCalled);
        console.log('测试结果:', success ? '通过' : '失败');
        
        return success;
    }

    /**
     * 测试清除交叉引用设置
     */
    async testClearCrossReferenceSettingsOnly(): Promise<boolean> {
        console.log('\n=== 测试清除交叉引用设置 ===');
        
        this.mockPlugin.reset();
        
        // 调用 applyCrossReferenceSettings 方法（禁用）
        await (this.dockPanel as any).applyCrossReferenceSettings("test-doc-id", false);
        
        // 验证只有交叉引用清除方法被调用
        const success = !this.mockPlugin.applyHeadingNumberingCalled && 
                       !this.mockPlugin.applyCrossReferenceCalled &&
                       !this.mockPlugin.clearHeadingNumberingCalled &&
                       this.mockPlugin.clearCrossReferenceCalled;
        
        console.log('标题编号清除方法被调用:', this.mockPlugin.clearHeadingNumberingCalled);
        console.log('交叉引用清除方法被调用:', this.mockPlugin.clearCrossReferenceCalled);
        console.log('测试结果:', success ? '通过' : '失败');
        
        return success;
    }

    /**
     * 运行所有测试
     */
    async runAllTests(): Promise<void> {
        console.log('开始运行 DockPanel 设置更新逻辑测试...\n');
        
        const tests = [
            this.testApplyHeadingNumberingSettingsOnly(),
            this.testApplyCrossReferenceSettingsOnly(),
            this.testClearHeadingNumberingSettingsOnly(),
            this.testClearCrossReferenceSettingsOnly()
        ];
        
        const results = await Promise.all(tests);
        const passedCount = results.filter(r => r).length;
        const totalCount = results.length;
        
        console.log(`\n=== 测试总结 ===`);
        console.log(`通过: ${passedCount}/${totalCount}`);
        console.log(`状态: ${passedCount === totalCount ? '全部通过' : '部分失败'}`);
        
        if (passedCount === totalCount) {
            console.log('✅ 设置更新逻辑测试全部通过！');
        } else {
            console.log('❌ 部分测试失败，请检查代码逻辑。');
        }
    }
}

import { showMessage } from "../dialog/message";
import { DEFAULT_SETTINGS, get, resetToDefault, update } from "../mux/settings";
import { confirmDialog } from "../dialog/confirmDialog";

export class MuxConfig {
    public element: Element;
    private settingsContainer: HTMLElement;

    constructor() {
        this.element = undefined;
    }

    public genHTML(): string {
        return `<div class="config__tab-container" data-name="mux">
    <div class="b3-label config-label">
        <div class="fn__flex">
            <div class="fn__flex-1">
                <h3 class="config-heading">文档 ID 设置</h3>
                <div class="b3-label__text">文档和数据库 ID 相关设置，用于特殊功能的实现</div>
            </div>
        </div>
    </div>
    <div id="mux-doc-settings" class="settings-section"></div>
    <div class="fn__hr"></div>
    <div class="b3-label config-label">
        <div class="fn__flex">
            <div class="fn__flex-1">
                <h3 class="config-heading">样式设置</h3>
                <div class="b3-label__text">UI 和样式相关的设置项</div>
            </div>
        </div>
    </div>
    <div id="mux-style-settings" class="settings-section"></div>
    <div class="fn__hr"></div>
    <div class="b3-label config-label">
        <div class="fn__flex">
            <div class="fn__flex-1">
                <h3 class="config-heading">其他设置</h3>
                <div class="b3-label__text">其他额外的设置项</div>
            </div>
        </div>
    </div>
    <div id="mux-misc-settings" class="settings-section"></div>
</div>
<style>
.settings-section {
    padding: 8px 16px;
}
.setting-item {
    display: flex;
    align-items: center;
    margin-bottom: 16px;
    padding: 8px;
    border-radius: 4px;
    transition: background-color 0.2s;
}
.setting-item:hover {
    background-color: var(--b3-theme-background-light);
}
.setting-item-left {
    flex: 1;
    margin-right: 16px;
}
.setting-item-title {
    font-weight: 500;
    margin-bottom: 4px;
}
.setting-item-description {
    font-size: 0.9em;
    color: var(--b3-theme-on-surface);
}
.setting-item-right {
    min-width: 200px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
}
.setting-item-right input[type="text"] {
    width: 100%;
}
.color-preview {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: inline-block;
    margin-right: 4px;
    border: 1px solid var(--b3-theme-on-surface-light);
}
.color-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
}
.color-item {
    display: flex;
    align-items: center;
    padding: 4px 8px;
    border-radius: 4px;
    background-color: var(--b3-theme-background-light);
}
</style>`;
    }

    public bindEvent(): void {
        this.settingsContainer = this.element.querySelector("#mux-doc-settings") as HTMLElement;

        // Render the settings
        this.renderDocumentSettings();
        this.renderStyleSettings();
        this.renderMiscSettings();
    }

    private renderDocumentSettings(): void {
        const container = this.element.querySelector("#mux-doc-settings") as HTMLElement;
        container.innerHTML = "";

        // Document ID Settings
        const docSettings = [
            "知识单元avID", "知识单元目录", "关系笔记avID", "关系笔记目录",
            "标签之树avID", "标签之树目录", "外部输入avID", "外部输入目录",
            "未读笔记本", "已读目录", "主页ID"
        ];

        docSettings.forEach(key => {
            this.createSettingItem(container, key);
        });
    }

    private renderStyleSettings(): void {
        const container = this.element.querySelector("#mux-style-settings") as HTMLElement;
        container.innerHTML = "";

        // Style Settings
        this.createColorSettingItem(container, "altx上色顺序Keys", "altx上色顺序Values");
    }

    private renderMiscSettings(): void {
        const container = this.element.querySelector("#mux-misc-settings") as HTMLElement;
        container.innerHTML = "";

        // Add future miscellaneous settings here
    }
    private createSettingItem(container: HTMLElement, key: string): void {
        const setting = DEFAULT_SETTINGS[key];
        if (!setting) return;

        const value = get<string>(key);

        const item = document.createElement("div");
        item.className = "setting-item";
        item.innerHTML = `
            <div class="setting-item-left">
                <div class="setting-item-title">${setting.label}</div>
                <div class="setting-item-description">${setting.description ? setting.description : ""}</div>
            </div>
            <div class="setting-item-right">
                <input type="text" class="b3-text-field fn__flex-center" value="${value}" data-key="${key}">
            </div>
        `;

        // Bind events
        const input = item.querySelector('input') as HTMLInputElement;
        input.addEventListener('change', async () => {
            const newValue = input.value;
            await update(key, newValue);
            showMessage(`已更新设置 ${setting.label}`, 2000);
        });

        container.appendChild(item);
    }

    private createColorSettingItem(container: HTMLElement, keysKey: string, valuesKey: string): void {
        const keysSetting = DEFAULT_SETTINGS[keysKey];
        const valuesSetting = DEFAULT_SETTINGS[valuesKey];

        if (!keysSetting || !valuesSetting) return;

        const keys = get<string[]>(keysKey);
        const values = get<any[]>(valuesKey);

        const item = document.createElement("div");
        item.className = "setting-item";
        
        // Create the main display section
        let html = `
            <div class="setting-item-left">
                <div class="setting-item-title">Alt+X 颜色循环设置</div>
                <div class="setting-item-description">Alt+X 快捷键可以循环设置文本颜色，此处设置颜色循环顺序</div>
                <div class="fn__flex" style="margin-top: 16px; gap: 16px;">
                    <div class="fn__flex-1">
                        <div class="setting-item-title">键值列表</div>
                        <textarea class="b3-text-field fn__block" data-key="${keysKey}" rows="4">${JSON.stringify(keys, null, 2)}</textarea>
                    </div>
                    <div class="fn__flex-1">
                        <div class="setting-item-title">颜色值列表</div>
                        <textarea class="b3-text-field fn__block" data-key="${valuesKey}" rows="4">${JSON.stringify(values, null, 2)}</textarea>
                    </div>
                </div>
            </div>
            <div class="setting-item-right">
                <button class="b3-button b3-button--outline fn__size200 reset-btn" data-key="${keysKey}">
                    <svg><use xlink:href="#iconUndo"></use></svg>
                    重置
                </button>
            </div>
        `;
        
        item.innerHTML = html;

        // Bind reset event
        const resetBtn = item.querySelector('.reset-btn') as HTMLButtonElement;
        resetBtn.addEventListener('click', async () => {
            await resetToDefault(keysKey);
            await resetToDefault(valuesKey);
            showMessage(`已重置颜色设置`, 2000);

            // Refresh this item
            this.renderStyleSettings();
        });
        
        // Bind textarea events
        const keysTextarea = item.querySelector(`textarea[data-key="${keysKey}"]`) as HTMLTextAreaElement;
        const valuesTextarea = item.querySelector(`textarea[data-key="${valuesKey}"]`) as HTMLTextAreaElement;
        
        keysTextarea.addEventListener('change', async () => {
            try {
                const newKeys = JSON.parse(keysTextarea.value);
                await update(keysKey, newKeys);
                showMessage(`已更新键值列表`, 2000);
                this.renderStyleSettings();
            } catch (error) {
                showMessage(`JSON 格式错误: ${error.message}`, 3000, "error");
            }
        });
        
        valuesTextarea.addEventListener('change', async () => {
            try {
                const newValues = JSON.parse(valuesTextarea.value);
                await update(valuesKey, newValues);
                showMessage(`已更新颜色值列表`, 2000);
                this.renderStyleSettings();
            } catch (error) {
                showMessage(`JSON 格式错误: ${error.message}`, 3000, "error");
            }
        });

        container.appendChild(item);
    }
}

export const mux = new MuxConfig(); 
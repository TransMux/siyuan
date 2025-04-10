import { showMessage } from "../dialog/message";
import { SETTING_ITEMS, get, update } from "../mux/settings";

// Define section configuration
const SECTIONS = [
    {
        id: "mux-doc-settings",
        title: "文档 ID 设置",
        description: "文档和数据库 ID 相关设置，用于特殊功能的实现",
        section: "document"
    },
    {
        id: "mux-style-settings",
        title: "样式设置",
        description: "UI 和样式相关的设置项",
        section: "style"
    },
    {
        id: "mux-misc-settings",
        title: "其他设置",
        description: "其他额外的设置项",
        section: "misc"
    }
];

export class MuxConfig {
    public element: Element;
    private settingsContainer: HTMLElement;

    constructor() {
        this.element = undefined;
    }

    public genHTML(): string {
        let sectionsHTML = '';

        SECTIONS.forEach((section, index) => {
            sectionsHTML += `
            <div class="b3-label config-label">
                <div class="fn__flex">
                    <div class="fn__flex-1">
                        <h3 class="config-heading">${section.title}</h3>
                        <div class="b3-label__text">${section.description}</div>
                    </div>
                </div>
            </div>
            <div id="${section.id}" class="settings-section"></div>
            ${index < SECTIONS.length - 1 ? '<div class="fn__hr"></div>' : ''}`;
        });

        return `<div class="config__tab-container" data-name="mux">
    ${sectionsHTML}
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
        // Render all sections
        SECTIONS.forEach(section => {
            this.renderSection(section.id, section.section);
        });
    }

    private renderSection(containerId: string, sectionType: string): void {
        const container = this.element.querySelector(`#${containerId}`) as HTMLElement;
        container.innerHTML = "";

        // Render all settings for this section
        Object.keys(SETTING_ITEMS).forEach(key => {
            if (SETTING_ITEMS[key].section === sectionType) {
                this.createSettingItem(container, key);
            }
        });
    }

    private createSettingItem(container: HTMLElement, key: string): void {
        const setting = SETTING_ITEMS[key];
        if (!setting) return;

        const value = get<string>(key);

        const item = document.createElement("div");
        item.className = "setting-item";

        let inputHTML = '';

        // Create different input types based on display property
        switch (setting.display) {
            case 'toggle':
                const isChecked = String(value).toLowerCase() === 'true' || value === '1';
                inputHTML = `<input class="b3-switch fn__flex-center" id="${key}" type="checkbox" ${isChecked ? 'checked' : ''} data-key="${key}">`;
                break;
            case 'textarea':
                inputHTML = `<textarea class="b3-text-field fn__block" style="min-width: 200px; width: 100%;" rows="3" id="${key}" data-key="${key}">${JSON.stringify(value)}</textarea>`;
                break;
            case 'input':
            default:
                inputHTML = `<input type="text" class="b3-text-field fn__flex-center" value="${value}" id="${key}" data-key="${key}">`;
                break;
        }

        item.innerHTML = `
            <div class="setting-item-left">
                <div class="setting-item-title">${setting.label}</div>
                <div class="setting-item-description">${setting.description ? setting.description : ""}</div>
            </div>
            <div class="setting-item-right">
                ${inputHTML}
            </div>
        `;

        // Bind events
        if (setting.display === 'toggle') {
            const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
            checkbox.addEventListener('change', async () => {
                const newValue = checkbox.checked;
                await update(key, newValue);
                showMessage(`已更新设置 ${setting.label}`, 2000);
            });
        } else if (setting.display === 'textarea') {
            const textarea = item.querySelector('textarea') as HTMLTextAreaElement;
            textarea.addEventListener('change', async () => {
                const newValue = textarea.value;
                await update(key, newValue);
                showMessage(`已更新设置 ${setting.label}`, 2000);
            });
        } else {
            const input = item.querySelector('input[type="text"]') as HTMLInputElement;
            input.addEventListener('change', async () => {
                const newValue = input.value;
                await update(key, newValue);
                showMessage(`已更新设置 ${setting.label}`, 2000);
            });
        }

        container.appendChild(item);
    }
}

export const mux = new MuxConfig();
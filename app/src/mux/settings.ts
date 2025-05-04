import { Constants } from "../constants";
import { Setting, SettingsDB } from "./settingsDB";

// Default values for settings
export const SETTING_ITEMS: { [key: string]: Setting } = {
    "protyle-support-bookmark-plus": {
        label: "编辑器支持BookMark+拖拽",
        type: "boolean",
        value: false,
        section: "function",
        display: "toggle"
    },
    "av-template-render-on-client": {
        label: "av模板 html= 在客户端渲染 eval",
        type: "boolean",
        value: false,
        section: "function",
        display: "toggle"
    },
    show_move_to_diary: {
        label: "文档界面显示'移动到日记下'按钮",
        type: "boolean",
        value: false,
        section: "function",
        display: "toggle"
    },
    "use-memo-as-annotation": {
        label: "使用内联备注作为批注",
        type: "boolean",
        value: false,
        section: "function",
        display: "toggle"
    },
    "ref-search-order-by-frequency": {
        label: "反链搜索结果按频率排序",
        type: "boolean",
        value: false,
        section: "function",
        display: "toggle"
    },
    "fetch-request-cache": {
        label: "fetch请求缓存",
        description: "缓存100ms内的重复请求，返回之前的结果，避免重复请求",
        type: "boolean",
        value: false,
        section: "function",
        display: "toggle"
    },
    知识单元avID: {
        label: "知识单元avID",
        type: "string",
        value: "",
        section: "document",
        display: "input"
    },
    知识单元目录: {
        label: "知识单元目录",
        type: "string",
        value: "",
        section: "document",
        display: "input"
    },
    关系笔记avID: {
        label: "关系笔记avID",
        type: "string",
        value: "",
        section: "document",
        display: "input"
    },
    关系笔记目录: {
        label: "关系笔记目录",
        type: "string",
        value: "",
        section: "document",
        display: "input"
    },
    标签之树avID: {
        label: "标签之树avID",
        type: "string",
        value: "",
        section: "document",
        display: "input"
    },
    标签之树目录: {
        label: "标签之树目录",
        type: "string",
        value: "",
        section: "document",
        display: "input"
    },
    外部输入avID: {
        label: "外部输入avID",
        type: "string",
        value: "",
        section: "document",
        display: "input"
    },
    外部输入目录: {
        label: "外部输入目录",
        type: "string",
        value: "",
        section: "document",
        display: "input"
    },
    批注avID: {
        label: "批注的数据库avID",
        description: "如果填写此项，那么在使用批注功能时，新创建的批注会自动添加到这个数据库中",
        type: "string",
        value: "",
        section: "document",
        display: "input"
    },
    未读笔记本: {
        label: "未读笔记本",
        type: "string",
        value: "",
        section: "document",
        display: "input"
    },
    已读目录: {
        label: "已读目录",
        description: "如果填写此项，会在文档标题上添加移动到已读按钮，移动到目标文档的 Week {week} 目录下",
        type: "string",
        value: "",
        section: "document",
        display: "input"
    },
    主页ID: {
        label: "主页ID",
        description: "如果填写此项，会在命令面板中添加打开主页按钮，点击后会打开目标文档",
        type: "string",
        value: "",
        section: "document",
        display: "input"
    },
    本周未读目录: {
        label: "本周未读目录",
        description: "用于定位未读笔记本下的本周文件夹，支持在起始页打开未读文章（如果这个文件夹没有加入索引的话无法获取）",
        type: "string",
        value: "",
        section: "document",
        display: "input"
    },
    altx上色顺序Keys: {
        label: "Alt+X上色顺序键",
        description: "已有颜色的匹配顺序",
        type: "array",
        value: [
            "var(--b3-card-info-color)",
            "var(--b3-card-warning-color)",
            "var(--b3-card-error-color)",
            "var(--b3-font-color5)",
            "var(--b3-font-color13)",
            "clear"
        ],
        section: "style",
        display: "textarea"
    },
    altx上色顺序Values: {
        label: "Alt+X上色顺序值",
        description: "每次匹配的顺序",
        type: "array",
        value: [
            { "type": "style1", "color": `var(--b3-card-info-background)${Constants.ZWSP}var(--b3-card-info-color)` }, // 最弱
            { "type": "style1", "color": `var(--b3-card-warning-background)${Constants.ZWSP}var(--b3-card-warning-color)` },
            { "type": "style1", "color": `var(--b3-card-error-background)${Constants.ZWSP}var(--b3-card-error-color)` },
            // 在有背景的情况下进行设置，会导致背景颜色和字体颜色同时存在，目前使用这个方案
            { "type": "style1", "color": `${Constants.ZWSP}var(--b3-font-color5)` },
            { "type": "style1", "color": `${Constants.ZWSP}var(--b3-font-color13)` },
            // { "type": "color", "color": "var(--b3-font-color5)" },
            // { "type": "color", "color": "var(--b3-font-color13)" }, // 最强
            { "type": "clear" }
        ],
        section: "style",
        display: "textarea"
    }
};

// Global settings cache
const SETTINGS_CACHE: { [key: string]: any } = {};

let isInit = false;
// Initialize settings in the database and load them into the cache
export async function initSettings() {
    if (isInit) {
        return;
    }
    isInit = true;
    // Load all settings into the cache
    const allSettings = await SettingsDB.listAllSettings();
    Object.keys(allSettings).forEach(key => {
        SETTINGS_CACHE[key] = allSettings[key];
    });

    console.log("Settings initialized and loaded into cache");
}
initSettings();

// Helper function to parse setting value based on its type
function parseSettingValue(value: any, type: string): any {
    if (value === null || value === undefined) {
        return value;
    }

    try {
        switch (type) {
            case "number":
                return Number(value);
            case "boolean":
                if (typeof value === 'string') {
                    return value === '1' || value === 'true';
                }
                return Boolean(value);
            case "object":
            case "array":
                if (typeof value === 'string') {
                    return JSON.parse(value);
                }
                return value;
            case "string":
            default:
                return String(value);
        }
    } catch (error) {
        console.error(`Error parsing setting value (${type}):`, error);
        return value;
    }
}

// Synchronous function to get a setting by key
export function get<T>(key: string): T {
    initSettings();
    if (!SETTINGS_CACHE[key]) {
        if (SETTING_ITEMS[key]) {
            return SETTING_ITEMS[key].value as T;
        }
        throw new Error(`Setting '${key}' not found`);
    }

    const setting = SETTING_ITEMS[key];
    if (!setting) {
        return SETTINGS_CACHE[key] as T;
    }

    const value = SETTINGS_CACHE[key];

    return parseSettingValue(value, setting.type) as T;
}

export function isExist(key: string): boolean {
    return SETTINGS_CACHE[key] !== undefined;
}

// Function to update a setting both in the cache and database
export async function update(key: string, value: any): Promise<boolean> {
    // Update the cache immediately
    if (!SETTINGS_CACHE[key]) {
        if (SETTING_ITEMS[key]) {
            await SettingsDB.createSetting({
                ...SETTING_ITEMS[key],
                key,
                value
            });
            SETTINGS_CACHE[key] = value;
        } else {
            console.warn(`Trying to update unknown setting: ${key}`);
            return false;
        }
    } else {
        SETTINGS_CACHE[key] = value;
        // Save to the database
        return await SettingsDB.saveSetting(key, value);
    }
}

// Function to update all settings in the UI
export function updateAllSettings(): void {
    // Update all setting inputs with current values from cache
    Object.keys(SETTING_ITEMS).forEach(key => {
        const setting = SETTING_ITEMS[key];
        const inputElement = document.getElementById(key) as HTMLInputElement;
        if (inputElement) {
            const value = get(key);
            if (setting.type === 'boolean') {
                inputElement.checked = Boolean(value);
            } else {
                inputElement.value = String(value);
            }
        }
    });
}

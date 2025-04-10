import { Constants } from "../constants";
import { SettingsDB } from "./settingsDB";

// Define the Settings interface
export interface Setting {
    key: string;
    label: string;
    description?: string;
    type: "string" | "object" | "array" | "number" | "boolean";
    value: any;
    default?: any; // Default value for reset purposes
}

// Default values for settings
export const DEFAULT_SETTINGS: { [key: string]: Setting } = {
    知识单元avID: {
        key: "知识单元avID",
        label: "知识单元avID",
        type: "string",
        value: ""
    },
    知识单元目录: {
        key: "知识单元目录",
        label: "知识单元目录",
        type: "string",
        value: ""
    },
    关系笔记avID: {
        key: "关系笔记avID",
        label: "关系笔记avID",
        type: "string",
        value: ""
    },
    关系笔记目录: {
        key: "关系笔记目录",
        label: "关系笔记目录",
        type: "string",
        value: ""
    },
    标签之树avID: {
        key: "标签之树avID",
        label: "标签之树avID",
        type: "string",
        value: ""
    },
    标签之树目录: {
        key: "标签之树目录",
        label: "标签之树目录",
        type: "string",
        value: ""
    },
    外部输入avID: {
        key: "外部输入avID",
        label: "外部输入avID",
        type: "string",
        value: ""
    },
    外部输入目录: {
        key: "外部输入目录",
        label: "外部输入目录",
        type: "string",
        value: ""
    },
    未读笔记本: {
        key: "未读笔记本",
        label: "未读笔记本",
        type: "string",
        value: ""
    },
    已读目录: {
        key: "已读目录",
        label: "已读目录",
        type: "string",
        value: ""
    },
    主页ID: {
        key: "主页ID",
        label: "主页ID",
        type: "string",
        value: ""
    },
    altx上色顺序Keys: {
        key: "altx上色顺序Keys",
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
        ]
    },
    altx上色顺序Values: {
        key: "altx上色顺序Values",
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
        ]
    }
};

// Global settings cache
const SETTINGS_CACHE: { [key: string]: any } = {};

// Initialize settings in the database and load them into the cache
export async function initSettings() {
    // Load all settings into the cache
    const allSettings = await SettingsDB.listAllSettings();
    Object.keys(allSettings).forEach(key => {
        SETTINGS_CACHE[key] = allSettings[key];
    });

    console.log("Settings initialized and loaded into cache");
}

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
    if (!SETTINGS_CACHE[key]) {
        if (DEFAULT_SETTINGS[key]) {
            return DEFAULT_SETTINGS[key].value as T;
        }
        throw new Error(`Setting '${key}' not found`);
    }

    const setting = DEFAULT_SETTINGS[key];
    if (!setting) {
        return SETTINGS_CACHE[key] as T;
    }

    const value = SETTINGS_CACHE[key];

    return parseSettingValue(value, setting.type) as T;
}

// Function to update a setting both in the cache and database
export async function update(key: string, value: any): Promise<boolean> {
    // Update the cache immediately
    SETTINGS_CACHE[key] = value;

    // Get the setting definition
    const setting = DEFAULT_SETTINGS[key];
    if (!setting) {
        console.warn(`Trying to update unknown setting: ${key}`);
        return false;
    }

    // Save to the database
    return await SettingsDB.saveSetting({
        ...setting,
        value
    });
}

// Function to reset a setting to its default value
export async function resetToDefault(key: string): Promise<boolean> {
    const setting = DEFAULT_SETTINGS[key];
    if (!setting) {
        console.warn(`Cannot reset unknown setting: ${key}`);
        return false;
    }

    return await update(key, setting.value);
}

// Function to update all settings in the UI
export function updateAllSettings(): void {
    // Update all setting inputs with current values from cache
    Object.keys(DEFAULT_SETTINGS).forEach(key => {
        const setting = DEFAULT_SETTINGS[key];
        const inputElement = document.getElementById(setting.key) as HTMLInputElement;
        if (inputElement) {
            const value = get(setting.key);
            if (setting.type === 'boolean') {
                inputElement.checked = Boolean(value);
            } else {
                inputElement.value = String(value);
            }
        }
    });
}

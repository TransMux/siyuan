import { Constants } from "../constants";
import { SettingsDB } from "./settingsDB";

// Define the Settings interface
export interface Setting {
    key: string;
    label: string;
    description: string;
    type: "string" | "object" | "array" | "number" | "boolean";
    value: any;
    default?: any; // Default value for reset purposes
}

// Default values for settings
const DEFAULT_SETTINGS: { [key: string]: Setting } = {
    知识单元avID: {
        key: "知识单元avID",
        label: "知识单元avID",
        description: "知识单元数据库的ID",
        type: "string",
        value: "20250101005818-yb4stwq"
    },
    知识单元目录: {
        key: "知识单元目录",
        label: "知识单元目录",
        description: "知识单元存放的目录ID",
        type: "string",
        value: "20250101010126-gjm1cwx"
    },
    关系笔记avID: {
        key: "关系笔记avID",
        label: "关系笔记avID",
        description: "关系笔记数据库的ID",
        type: "string",
        value: "20250101233539-mitgexi"
    },
    关系笔记目录: {
        key: "关系笔记目录",
        label: "关系笔记目录",
        description: "关系笔记存放的目录ID",
        type: "string",
        value: "20250101010038-81wd8r8"
    },
    标签之树avID: {
        key: "标签之树avID",
        label: "标签之树avID",
        description: "标签之树数据库的ID",
        type: "string",
        value: "20250101001630-x03k4te"
    },
    标签之树目录: {
        key: "标签之树目录",
        label: "标签之树目录",
        description: "标签之树存放的目录ID",
        type: "string",
        value: "20250101005307-7384qo5"
    },
    外部输入avID: {
        key: "外部输入avID",
        label: "外部输入avID",
        description: "外部输入数据库的ID",
        type: "string",
        value: "20250102171020-4cqqonx"
    },
    外部输入目录: {
        key: "外部输入目录",
        label: "外部输入目录",
        description: "外部输入存放的目录ID",
        type: "string",
        value: "20250102171013-zzcyz96"
    },
    未读笔记本: {
        key: "未读笔记本",
        label: "未读笔记本",
        description: "未读笔记本的ID",
        type: "string",
        value: "20250207201935-ho4pthi"
    },
    已读目录: {
        key: "已读目录",
        label: "已读目录",
        description: "已读文章存放的目录ID",
        type: "string",
        value: "20241231233427-ge48qdq"
    },
    主页ID: {
        key: "主页ID",
        label: "主页ID",
        description: "主页文档的ID",
        type: "string",
        value: "20250206142847-cbvnc9o"
    },
    altx上色顺序Keys: {
        key: "altx上色顺序Keys",
        label: "Alt+X上色顺序键",
        description: "Alt+X上色功能的颜色顺序匹配键",
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
        description: "Alt+X上色功能的颜色值设置",
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

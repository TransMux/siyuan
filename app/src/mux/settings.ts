const ZWSP = "\u200b";

// @ts-ignore
window.__muxSettings = {
    "protyle-support-bookmark-plus": true,
    "use-memo-as-annotation": true,
    "引用时先取消选区内的反链": true,
    "标签之树avID": "20250101001630-x03k4te",
    "批注avID": "20250402134337-w0qjsu0",
    "主页ID": "20250206142847-cbvnc9o",
    "altx上色顺序Keys": [
        "var(--b3-font-color11)",
        "var(--b3-font-color1)",
        "var(--b3-card-info-color)",
        "var(--b3-card-warning-color)",
        "var(--b3-card-info-color)",
        "clear"
    ]],
    "altx上色顺序Values": [
        {
            "type": "style1",
            "color": "​var(--b3-font-color11)"
        },
        {
            "type": "style1",
            "color": "​var(--b3-font-color1)"
        },
        {
            "type": "style1",
            "color": "var(--b3-card-info-background)​var(--b3-card-info-color)"
        },
        {
            "type": "style1",
            "color": "var(--b3-card-warning-background)​var(--b3-card-warning-color)"
        },
        {
            "type": "style1",
            "color": "var(--b3-card-error-background)​var(--b3-card-error-color)"
        },
        {
            "type": "clear"
        }
    ]
}

// Synchronous function to get a setting by key
export function get<T>(key: string): T {
    // @ts-ignore
    if (!window.__muxSettings) {
        return undefined as T;
    }
    // @ts-ignore
    if (window.__muxSettings[key] !== undefined) {
        // @ts-ignore
        return window.__muxSettings[key] as T;
    }
    // @ts-ignore
    return undefined;
}

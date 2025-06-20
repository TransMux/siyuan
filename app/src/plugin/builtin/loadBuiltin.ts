import { App } from "../../index";
import { Plugin } from "../index";
import { QuickAppendPlugin } from "./QuickAppendPlugin";

export interface IBuiltinPluginInfo {
    name: string;
    displayName: string;
    description?: string;
    iconURL?: string;
}

export const BUILTIN_PLUGIN_INFOS: IBuiltinPluginInfo[] = [
    {
        name: "quickAppend",
        displayName: "Quick Append",
        description: "快速追加每日任务",
        iconURL: "/stage/images/icon.png",
    },
];

// Map of builtin plugin classes
export const BUILTIN_PLUGIN_CLASSES: Record<string, new (options: { app: App; name: string; displayName: string; i18n: IObject }) => Plugin> = {
    quickAppend: QuickAppendPlugin,
};

/**
 * Dynamically instantiate builtin plugin and mount it just like external plugins.
 */
export const loadBuiltinPlugin = async (app: App, name: string): Promise<Plugin | undefined> => {
    const Cls = BUILTIN_PLUGIN_CLASSES[name];
    if (!Cls) {
        console.error(`Unknown builtin plugin: ${name}`);
        return;
    }
    const plugin = new Cls({
        app,
        name,
        displayName: BUILTIN_PLUGIN_INFOS.find((i) => i.name === name)?.displayName || name,
        i18n: {},
    });
    app.plugins.push(plugin);
    await plugin.onload?.();
    return plugin;
}; 
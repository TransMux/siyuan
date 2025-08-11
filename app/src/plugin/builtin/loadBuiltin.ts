import { App } from "../../index";
import { Plugin } from "../index";
import { QuickAppendPlugin } from "./QuickAppend";
import { MuxGlobalOverlayPlugin } from "./MuxGlobalOverlay";
import { QuickSearchPlugin } from "./QuickSearch";
import { GatewayConnectorPlugin } from "./GatewayConnector";

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
    {
        name: "muxGlobalOverlay",
        displayName: "Mux Global Overlay",
        description: "Integrate with Global Overlay application to start timers from blocks",
        iconURL: "/stage/images/icon.png",
    },
    {
        name: "quickSearch",
        displayName: "Quick Search",
        description: "快速全局搜索",
        iconURL: "/stage/images/icon.png",
    },
    {
        name: "gatewayConnector",
        displayName: "Gateway Connector",
        description: "连接 Gateway 服务",
        iconURL: "/stage/images/icon.png",
    },
];

// Map of builtin plugin classes
export const BUILTIN_PLUGIN_CLASSES: Record<string, new (options: { app: App; name: string; displayName: string; i18n: IObject }) => Plugin> = {
    quickAppend: QuickAppendPlugin,
    muxGlobalOverlay: MuxGlobalOverlayPlugin,
    quickSearch: QuickSearchPlugin,
    gatewayConnector: GatewayConnectorPlugin,
};

/**
 * Load a builtin plugin by name
 */
export async function loadBuiltinPlugin(app: App, name: string): Promise<Plugin | null> {
    const PluginClass = BUILTIN_PLUGIN_CLASSES[name];
    if (!PluginClass) {
        console.warn(`Unknown builtin plugin: ${name}`);
        return null;
    }

    const info = BUILTIN_PLUGIN_INFOS.find(p => p.name === name);
    if (!info) {
        console.warn(`No info found for builtin plugin: ${name}`);
        return null;
    }

    try {
        const plugin = new PluginClass({
            app,
            name,
            displayName: info.displayName,
            i18n: {}, // TODO: Load i18n data if needed
        });

        app.plugins.push(plugin);
        await plugin.onload();
        return plugin;
    } catch (e) {
        console.error(`Failed to load builtin plugin ${name}:`, e);
        return null;
    }
} 
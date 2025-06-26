import { App } from "../../index";
import { Plugin } from "../index";
import { QuickAppendPlugin } from "./QuickAppendPlugin";
import { MuxGlobalOverlayPlugin } from "./MuxGlobalOverlayPlugin";
import { QuickSearchPlugin } from "./QuickSearchPlugin";
import { GatewayConnectorPlugin } from "./GatewayConnectorPlugin";

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
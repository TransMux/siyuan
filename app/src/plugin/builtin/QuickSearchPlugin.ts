import { Plugin } from "../index";
import { Constants } from "../../constants";
import { isWindow } from "../../util/functions";
/// #if !BROWSER
import { BrowserWindow } from "@electron/remote";
/// #endif

/**
 * Built-in plugin: Quick Search
 * Quickly open a stand-alone global search window using ⌥⇧P.
 */
export class QuickSearchPlugin extends Plugin {
    private appRef: import("../../index").App;

    /// #if !BROWSER
    /** Cached BrowserWindow instance used for quick re-open */
    private win: InstanceType<typeof BrowserWindow> | null = null;
    private lastHideAt = 0;
    /// #endif

    constructor(options: { app: import("../../index").App; name: string; displayName: string; i18n: IObject }) {
        super(options);
        this.appRef = options.app;

        // Register command: ⌥⇧P Quick Search (global search)
        this.addCommand({
            langKey: "quickSearch",
            hotkey: "⌥⇧P",
            globalCallback: () => this.quickSearch(),
            callback: () => this.quickSearch(),
        });

        // Pre-create hidden window for faster first show
        /// #if !BROWSER
        this.createWindow();
        /// #endif
    }

    /// #if !BROWSER
    /** Lazily create BrowserWindow and cache it */
    private createWindow() {
        if (this.win && !this.win.isDestroyed()) {
            return;
        }
        this.win = new BrowserWindow({
            show: false,
            width: 800,
            height: 900,
            minWidth: 400,
            minHeight: 300,
            trafficLightPosition: { x: 8, y: 13 },
            frame: process.platform === "darwin",
            titleBarStyle: "hidden",
            webPreferences: {
                contextIsolation: false,
                nodeIntegration: true,
                webviewTag: true,
                webSecurity: false,
                autoplayPolicy: "user-gesture-required",
            },
        });

        // Intercept default close behaviour – just hide instead of destroy
        this.win.on("close", (e: any) => {
            e.preventDefault();
            this.win?.hide();
        });

        this.win.on("closed", () => {
            this.win = null;
        });

        this.win.on("hide", () => {
            this.lastHideAt = Date.now();
        });

        // Enable @electron/remote for this new window
        try {
            const remote = require("@electron/remote");
            const remoteMain = remote.require("@electron/remote/main");
            remoteMain.enable(this.win.webContents);
        } catch (e) {
            console.error("enable remote failed", e);
        }

        // Hide window when user presses ESC in this window
        this.win.webContents.on("before-input-event", (event: any, input: Electron.Input) => {
            if (input.key === "Escape" && !input.control && !input.meta && !input.alt && !input.shift) {
                event.preventDefault();
                this.win?.hide();
            }
        });
    }
    /// #endif

    /** Show quick search window (or bring to front) */
    private quickSearch() {
        // Do not open another search window in sub-windows
        if (isWindow()) {
            return;
        }

        /// #if !BROWSER
        this.createWindow();

        if (this.win && !this.win.isDestroyed()) {
            // Already visible → just focus
            if (this.win.isVisible()) {
                this.win.focus();
                return;
            }
            // Recently hidden (≤5 s) and already loaded → reuse without reload
            if (Date.now() - this.lastHideAt < 5000 && this.win.webContents.getURL() !== "about:blank") {
                this.win.show();
                this.win.focus();
                return;
            }
        }
        /// #endif

        // Build search tab configuration – reuse last local search data if available
        const localData = (window as any).siyuan?.storage?.[Constants.LOCAL_SEARCHDATA] || {};
        const searchConfig = {
            k: localData.k || "",
            r: "",
            hasReplace: false,
            method: localData.method ?? 0,
            hPath: "",
            idPath: [] as string[],
            group: localData.group ?? 0,
            sort: localData.sort ?? 0,
            types: { ...(localData.types || {}) },
            replaceTypes: { ...(localData.replaceTypes || {}) },
            removed: localData.removed ?? false,
            page: 1,
        } as Config.IUILayoutTabSearchConfig;

        const json = [
            {
                title: "Global Search",
                docIcon: "iconSearch",
                pin: false,
                active: true,
                instance: "Tab",
                action: "Tab",
                children: {
                    instance: "Search",
                    config: searchConfig,
                },
            },
        ];

        /// #if !BROWSER
        const url = `${window.location.protocol}//${window.location.host}/stage/build/app/window.html?v=${Constants.SIYUAN_VERSION}&json=${encodeURIComponent(
            JSON.stringify(json)
        )}`;

        this.win?.loadURL(url).then(() => {
            this.win?.show();
            this.lastHideAt = 0; // reset because window now visible
        });
        /// #endif
    }
} 
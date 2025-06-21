import { Plugin } from "../index";
import { fetchPost, fetchSyncPost } from "../../util/fetch";
import { Constants } from "../../constants";
import { showMessage } from "../../dialog/message";
import { newQuickAppendModel } from "./QuickAppendModel";
import { isWindow } from "../../util/functions";
/// #if !BROWSER
import { BrowserWindow } from "@electron/remote";
/// #endif

export class QuickAppendPlugin extends Plugin {
    private appRef: import("../../index").App;

    /// #if !BROWSER
    /** Persistent Quick-Append window */
    private win: InstanceType<typeof BrowserWindow> | null = null;
    private lastHideAt = 0; // timestamp when window was last hidden
    /// #endif

    constructor(options: { app: import("../../index").App; name: string; displayName: string; i18n: IObject }) {
        super(options);
        // Preserve app reference for creating models later
        this.appRef = options.app;

        // Register custom model type for Quick Append
        this.models["quick-append"] = ({ tab, data }) => newQuickAppendModel({
            app: this.appRef,
            tab,
            data,
        });

        // 注册命令：⌥⇧A 快速追加
        this.addCommand({
            langKey: "quickAppend",
            hotkey: "⌥⇧A",
            globalCallback: () => this.quickAppend(),
            callback: () => this.quickAppend(),
        });

        // 初始化创建 Quick Append 窗口（隐藏），避免首次触发等待
        /// #if !BROWSER
        this.createWindow();
        /// #endif
    }

    /// #if !BROWSER
    /** 创建并缓存窗口（首次加载调用） */
    private createWindow() {
        if (this.win && !this.win.isDestroyed()) {
            return;
        }
        this.win = new BrowserWindow({
            show: false,
            width: 480,
            height: 400,
            minWidth: 250,
            minHeight: 100,
            trafficLightPosition: { x: 8, y: 13 },
            frame: "darwin" === process.platform,
            titleBarStyle: "hidden",
            webPreferences: {
                contextIsolation: false,
                nodeIntegration: true,
                webviewTag: true,
                webSecurity: false,
                autoplayPolicy: "user-gesture-required",
            },
        });

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

        // 启用 remote 在子窗口可用，避免脚本错误导致白屏
        try {
            const remote = require("@electron/remote");
            // 通过 remote.require 访问主进程的 remote/main
            const remoteMain = remote.require("@electron/remote/main");
            remoteMain.enable(this.win.webContents);
        } catch (e) {
            console.error("enable remote failed", e);
        }
    }
    /// #endif

    /**
     * 追加空任务至 Daily Note 并在新窗口打开
     */
    private async quickAppend() {
        if (isWindow()) {
            return;
        }

        /// #if !BROWSER
        // 创建窗口或复用
        this.createWindow();

        if (this.win && !this.win.isDestroyed()) {
            // 若窗口已可见直接聚焦
            if (this.win.isVisible()) {
                this.win.focus();
                return;
            }
            // 若刚隐藏 ≤5 秒且内容已加载，直接复用
            if (Date.now() - this.lastHideAt < 5000 && this.win.webContents.getURL() !== "about:blank") {
                this.win.show();
                this.win.focus();
                return;
            }
        }
        /// #endif

        const notebookId = window.siyuan.storage[Constants.LOCAL_DAILYNOTEID];

        fetchPost(
            "/api/block/appendDailyNoteBlock",
            {
                notebook: notebookId,
                dataType: "markdown",
                data: "- [ ]",
            },
            async (response: any) => {
                if (typeof response === "string" || response.code !== 0) {
                    showMessage(typeof response === "string" ? response : response.msg);
                    return;
                }

                const newBlockId = response.data?.[0]?.doOperations?.[0]?.id;
                if (!newBlockId) {
                    return;
                }

                const infoRes = await fetchSyncPost("/api/block/getBlockInfo", { id: newBlockId });
                if (infoRes.code !== 0) {
                    showMessage(infoRes.msg);
                    return;
                }

                /// #if !BROWSER
                const json = [
                    {
                        title: infoRes.data.rootTitle,
                        docIcon: infoRes.data.rootIcon,
                        pin: false,
                        active: true,
                        instance: "Tab",
                        action: "Tab",
                        children: {
                            instance: "Custom",
                            customModelType: "quick-append",
                            customModelData: {
                                notebookId: infoRes.data.box,
                                blockId: newBlockId,
                                rootId: infoRes.data.rootID,
                            },
                        },
                    },
                ];

                const url = `${window.location.protocol}//${window.location.host}/stage/build/app/window.html?v=${Constants.SIYUAN_VERSION}&json=${encodeURIComponent(JSON.stringify(json))}`;

                // 此时窗口仍存在但需要刷新内容
                if (this.win?.webContents.getURL() && this.win.webContents.getURL() !== "about:blank") {
                    this.win.show();
                    this.win.focus();
                    this.win.webContents.send("quick-append-update", {
                        notebookId: infoRes.data.box,
                        blockId: newBlockId,
                        rootId: infoRes.data.rootID,
                    });
                } else {
                    // 首次加载页面
                    this.win?.loadURL(url).then(() => {
                        this.win?.show();
                        this.lastHideAt = 0; // reset because now window visible with new content
                    });
                }
                /// #endif
            }
        );
    }
} 
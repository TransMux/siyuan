import { Plugin } from "../index";
import { fetchPost, fetchSyncPost } from "../../util/fetch";
import { Constants } from "../../constants";
import { showMessage } from "../../dialog/message";
import { newQuickAppendModel } from "./QuickAppendModel";
/// #if !BROWSER
import { ipcRenderer } from "electron";
/// #endif

export class QuickAppendPlugin extends Plugin {
    private appRef: import("../../index").App;

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
    }

    /**
     * 追加空任务至 Daily Note 并在新窗口打开
     */
    private async quickAppend() {
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
                const op = response.data?.[0]?.doOperations?.[0];
                const newBlockId = op?.id;
                if (!newBlockId) {
                    return;
                }

                // Fetch block info for window metadata
                const infoRes = await fetchSyncPost("/api/block/getBlockInfo", { id: newBlockId });
                if (infoRes.code !== 0) {
                    showMessage(infoRes.msg);
                    return;
                }

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

                /// #if !BROWSER
                ipcRenderer.send(Constants.SIYUAN_OPEN_WINDOW, {
                    width: 480,
                    height: 400,
                    url: `${window.location.protocol}//${window.location.host}/stage/build/app/window.html?v=${Constants.SIYUAN_VERSION}&json=${encodeURIComponent(
                        JSON.stringify(json)
                    )}`,
                });
                /// #endif
            }
        );
    }
} 
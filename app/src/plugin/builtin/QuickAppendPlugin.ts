import { Plugin } from "../index";
import { fetchPost } from "../../util/fetch";
import { openNewWindowById } from "../../window/openNewWindow";
import { Constants } from "../../constants";
import { showMessage } from "../../dialog/message";

export class QuickAppendPlugin extends Plugin {
    constructor(options: { app: import("../../index").App; name: string; displayName: string; i18n: IObject }) {
        super(options);
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
    private quickAppend() {
        const notebookId = window.siyuan.storage[Constants.LOCAL_DAILYNOTEID];
        fetchPost(
            "/api/block/appendDailyNoteBlock",
            {
                notebook: notebookId,
                dataType: "markdown",
                data: "- [ ]",
            },
            (response: any) => {
                if (typeof response === "string" || response.code !== 0) {
                    showMessage(typeof response === "string" ? response : response.msg);
                    return;
                }
                const op = response.data?.[0]?.doOperations?.[0];
                const newBlockId = op?.id;
                if (newBlockId) {
                    openNewWindowById(newBlockId, { width: 750, height: 500 });
                }
            }
        );
    }
} 
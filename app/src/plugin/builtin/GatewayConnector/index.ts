import { Plugin } from "../../index";
import { fetchPost } from "../../../util/fetch";
import { getActiveTab } from "../../../layout/tabUtil";
import { Editor } from "../../../editor";
import { showMessage } from "../../../dialog/message";
import { copyBlockLink, openHomepage } from "./utils";

/**
 * Built-in plugin: Gateway Connector
 * Adds a command that sends the current document ID to external AI gateway for summarisation.
 */
export class GatewayConnectorPlugin extends Plugin {
    constructor(options: { app: import("../../../index").App; name: string; displayName: string; i18n: IObject }) {
        super(options);

        // Register command: 使用AI总结当前文章 (Summarise Current Doc)
        this.addCommand({
            langKey: "aiSummaryCurrentDoc",
            langText: "使用 AI 总结当前文章  (AI Summarise Current Doc)",
            hotkey: "", // no default hotkey
            globalCallback: () => this.summaryCurrentDoc(),
            callback: () => this.summaryCurrentDoc(),
        });

        this.addCommand({
            langKey: "copyBlockLink",
            langText: "复制当前所在块的超链接(copy-block-link)",
            hotkey: "⌥⌘L",
            callback: (event) => {
                copyBlockLink(event);
            },
        });

        this.addCommand({
            langKey: "openHomepage",
            langText: "打开首页(open-homepage)",
            hotkey: "",
            callback: () => {
                openHomepage();
            },
        });

        this.addCommand({
            langKey: "pullAllUnreadArticlesFromNocodb",
            langText: "从 Nocodb 数据库拉取所有未读文章 (pull-all-unread-articles-from-nocodb)",
            hotkey: "",
            callback: () => {
                this.pullAllUnreadArticlesFromNocodb();
            },
        });
    }

    /**
     * Collect current document root ID and send to gateway
     */
    private summaryCurrentDoc() {
        try {
            const activeTab = getActiveTab();
            let docId = "";
            if (activeTab && activeTab.model instanceof Editor && activeTab.model.editor?.protyle?.block?.rootID) {
                docId = activeTab.model.editor.protyle.block.rootID;
            }

            if (!docId) {
                showMessage("无法获取当前文档", 3000, "warning");
                return;
            }

            // Send POST request to gateway
            fetchPost(
                "http://100.74.82.128:6253/tools/siyuan/ai/summary-doc",
                { document_id: docId },
                (response: any) => {
                    if (typeof response === "object" && response.success) {
                        showMessage("AI 总结请求已发送", 3000, "info");
                    } else if (typeof response === "object") {
                        showMessage(response.msg || "AI 总结请求发送失败", 3000, "error");
                    }
                },
                { "Content-Type": "application/json" }
            );
        } catch (e) {
            console.error(e);
            showMessage("AI 总结请求失败: " + (e as Error).message, 3000, "error");
        }
    }

    private pullAllUnreadArticlesFromNocodb() {
        fetchPost(
            "http://100.74.82.128:6253/scripts/batch-insert-zhoukan-from-noco",
            {},
            (response: any) => {
                if (typeof response === "object" && response.success) {
                    showMessage("AI 总结请求已发送", 3000, "info");
                } else if (typeof response === "object") {
                    showMessage(response.msg || "AI 总结请求发送失败", 3000, "error");
                }
            },
            { "Content-Type": "application/json" }
        );
    }
} 
import { Tab } from "../../layout/Tab";
import { Custom } from "../../layout/dock/Custom";
import { Protyle } from "../../protyle";
import { App } from "../../index";
import { Constants } from "../../constants";
/// #if !BROWSER
import { ipcRenderer } from "electron";
/// #endif

/**
 * Create a Custom model instance which renders only a Protyle editor and a close button.
 * This is used by the builtin QuickAppend plugin.
 */
export const newQuickAppendModel = (options: {
    app: App;
    tab: Tab;
    data: {
        notebookId: string;
        blockId: string;
        rootId: string;
    };
}) => {
    let editor: Protyle | null = null;
    let destroyTimer: number | null = null;
    let editorContainer: HTMLElement;

    // Will be assigned later after `custom` is declared
    let custom: Custom;

    const renderEditor = (blockId: string, rootId: string) => {
        if (editor) {
            editor.destroy();
        }
        editor = new Protyle(options.app, editorContainer, {
            blockId,
            rootId,
            mode: "wysiwyg",
            action: [],
            render: {
                title: false,
                background: false,
                scroll: true,
            },
            after: () => {
                setTimeout(() => editor?.focus());
            },
        });
        if (custom) {
            // Ensure not duplicate reference
            if (!custom.editors.includes(editor)) {
                custom.editors.push(editor);
            }
        }
    };

    custom = new Custom({
        app: options.app,
        type: "quick-append",
        tab: options.tab,
        data: options.data,
        init() {
            // Build minimal layout: close button + editor container
            this.element.classList.add("quick-append__wrapper", "fn__flex-column", "fn__flex-1");

            editorContainer = document.createElement("div");
            editorContainer.className = "quick-append__editor fn__flex-1";

            this.element.appendChild(editorContainer);

            // initial render
            renderEditor(options.data.blockId, options.data.rootId);
            if (editor) {
                this.editors.push(editor);
            }

            /// #if !BROWSER
            // Listen for update messages to refresh editor content quickly
            ipcRenderer.on("quick-append-update", (_event, data) => {
                if (destroyTimer) {
                    clearTimeout(destroyTimer);
                    destroyTimer = null;
                }
                renderEditor(data.blockId, data.rootId);
            });

            // 拦截系统/按钮关闭：保存窗口内容后只隐藏，不销毁
            ipcRenderer.on(Constants.SIYUAN_SAVE_CLOSE, () => {
                ipcRenderer.send(Constants.SIYUAN_CMD, "hide");
            });

            window.addEventListener("beforeunload", (e) => {
                e.preventDefault();
                e.returnValue = false; // Important: cancel the unload
                ipcRenderer.send(Constants.SIYUAN_CMD, "hide");
            });

            // 覆盖 closeWindow 全局函数，使其仅隐藏窗口
            (window as any).closeWindow = () => {
                ipcRenderer.send(Constants.SIYUAN_CMD, "hide");
            };

            // 额外阻止工具栏关闭按钮默认 destroy 行为
            const closeBtn = document.getElementById("closeWindow");
            if (closeBtn) {
                closeBtn.addEventListener(
                    "click",
                    (ev) => {
                        ev.stopImmediatePropagation();
                        ipcRenderer.send(Constants.SIYUAN_CMD, "hide");
                    },
                    { capture: true }
                );
            }
            /// #endif
            // Allow user to quickly close the Quick Append window by pressing ESC or Ctrl+W
            const onKeydown = (ev: KeyboardEvent) => {
                if (ev.key === "Escape" || ev.key === "Esc" || (ev.ctrlKey && ev.key === "w")) {
                    // Prevent interfering with other handlers inside editor
                    ev.stopPropagation();
                    ev.preventDefault();
                    /// #if !BROWSER
                    ipcRenderer.send(Constants.SIYUAN_CMD, "hide");
                    /// #else
                    window.close();
                    /// #endif

                    if (destroyTimer) {
                        clearTimeout(destroyTimer);
                    }
                    destroyTimer = window.setTimeout(() => {
                        if (editor) {
                            editor.destroy();
                            editor = null;
                        }
                    }, 5000);
                }
            };
            window.addEventListener("keydown", onKeydown, { capture: true, once: false });

            // Cleanup listener when the model is destroyed
            custom.beforeDestroy = () => {
                window.removeEventListener("keydown", onKeydown);
            };
        },
        destroy() {
            if (editor) {
                editor.destroy();
            }
        },
        resize() {
            if (editor) {
                editor.resize();
            }
        },
    });

    return custom;
}; 
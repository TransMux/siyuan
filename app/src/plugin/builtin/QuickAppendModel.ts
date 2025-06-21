import { Tab } from "../../layout/Tab";
import { Custom } from "../../layout/dock/Custom";
import { Protyle } from "../../protyle";
import { App } from "../../index";

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
    let editor: Protyle;

    const custom = new Custom({
        app: options.app,
        type: "quick-append",
        tab: options.tab,
        data: options.data,
        init() {
            // Build minimal layout: close button + editor container
            this.element.classList.add("quick-append__wrapper", "fn__flex-column", "fn__flex-1");
            const editorContainer = document.createElement("div");
            editorContainer.className = "quick-append__editor fn__flex-1";

            this.element.appendChild(editorContainer);

            // Initialize Protyle editor
            editor = new Protyle(options.app, editorContainer, {
                blockId: options.data.blockId,
                rootId: options.data.rootId,
                mode: "wysiwyg",
                action: [],
                render: {
                    title: false,
                    background: false,
                    scroll: true,
                },
                after: () => {
                    // Focus the first block when ready
                    setTimeout(() => {
                        editor?.focus();
                    });
                },
            });
            custom.editors.push(editor);

            // Allow user to quickly close the Quick Append window by pressing ESC
            const onKeydown = (ev: KeyboardEvent) => {
                if (ev.key === "Escape" || ev.key === "Esc") {
                    // Prevent interfering with other handlers inside editor
                    ev.stopPropagation();
                    ev.preventDefault();
                    window.close();
                }
            };
            window.addEventListener("keydown", onKeydown, { once: false });

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
import { showMessage } from "../../dialog/message";
import { Plugin } from "../index";

/**
 * Built-in plugin: Mux Global Overlay
 * Adds an option to every block context menu that starts a timer in the
 * external Global Overlay application.
 */
export class MuxGlobalOverlayPlugin extends Plugin {
    /** Map container element -> MutationObserver */
    private observers: WeakMap<Element, MutationObserver> = new WeakMap();
    /** Per-protyle pending state */
    private protylePendingState: WeakMap<Element, { blocks: Set<HTMLElement>; rafId: number }> = new WeakMap();

    constructor(options: { app: import("../../index").App; name: string; displayName: string; i18n: IObject }) {
        super(options);

        // When protyle editors are loaded, attach observer and initial render
        const onProtyleLoad = (event: CustomEvent<{ protyle: IProtyle }>) => {
            const protyle = event.detail.protyle;
            if (!protyle || !protyle.wysiwyg?.element) return;
            this.observeProtyle(protyle);
        };

        this.eventBus.on("loaded-protyle-static", onProtyleLoad);
        this.eventBus.on("loaded-protyle-dynamic", onProtyleLoad);

        // 已经存在的 protyle (如主窗口初始) 需要手动扫描
        (window.siyuan as any)?.layout?.layout?.models?.editor?.forEach?.((editor: any) => {
            if (editor?.protyle) {
                this.observeProtyle(editor.protyle);
            }
        });

        // Register listener: extend block icon (block menu) when it opens
        this.eventBus.on("click-blockicon", (event: CustomEvent) => {
            const detail: any = event.detail;
            // detail contains: protyle, blockElements, menu (subMenu)
            if (!detail?.menu || !detail?.blockElements?.length) {
                return;
            }

            // Add separator inside plugin submenu for clarity (optional)
            detail.menu.addSeparator?.();

            detail.menu.addItem({
                id: "muxGlobalOverlay_startTimer",
                label: "在当前桌面开始计时",
                icon: "iconClock", // uses built-in clock icon
                click: () => {
                    const element: HTMLElement = detail.blockElements[0];
                    const id = element.getAttribute("data-node-id") || "";
                    const label = (element.innerText || element.textContent || "").trim();

                    fetch("http://localhost:53431/setTimerTask", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ id, label }),
                    }).catch((e) => {
                        showMessage("setTimerTask error: " + e, 10000, "error");
                    });
                },
            });
        });
    }

    /** Render focus time inside the protyle-attr sibling of provided block element */
    private renderFocusForBlock(blockEl: HTMLElement) {
        if (!blockEl || !blockEl.hasAttribute("custom-timer-records")) return;

        const attrEl = blockEl.nextElementSibling as HTMLElement;
        if (!attrEl || !attrEl.classList.contains("protyle-attr")) return;

        // parse attribute JSON (may be encoded with &quot;)
        let raw = blockEl.getAttribute("custom-timer-records");
        if (!raw) return;
        try {
            // unescape HTML entities if present
            raw = raw.replace(/&quot;/g, '"');
        } catch (e) {}

        let records: { start: number; end?: number }[] = [];
        try {
            records = JSON.parse(raw);
        } catch (e) {
            return; // invalid JSON
        }
        if (!Array.isArray(records) || !records.length) return;

        const now = Date.now();
        let totalMs = 0;
        records.forEach((r) => {
            const start = Number(r.start);
            const end = r.end ? Number(r.end) : now;
            if (!isNaN(start) && !isNaN(end) && end > start) {
                totalMs += end - start;
            }
        });
        if (totalMs <= 0) return;

        const seconds = Math.floor(totalMs / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        let timeStr = "";
        if (hours) timeStr += hours + "h";
        if (minutes || hours) timeStr += minutes.toString().padStart(hours ? 2 : 1, "0") + "m";
        else timeStr += secs + "s";

        let focusNode = attrEl.querySelector('.protyle-attr--focus') as HTMLElement;
        const html = `<svg><use xlink:href="#iconClock"></use></svg>${timeStr}`;
        if (focusNode) {
            focusNode.innerHTML = html;
        } else {
            focusNode = document.createElement('div');
            focusNode.className = 'protyle-attr--focus';
            focusNode.innerHTML = html;
            attrEl.appendChild(focusNode);
        }
    }

    /** Attach observer to given protyle and render existing focus indicators */
    private observeProtyle(protyle: IProtyle) {
        const container: Element = protyle.wysiwyg.element;
        // Initial scan
        container.querySelectorAll('[custom-timer-records]').forEach((el) => {
            this.queueBlock(container, el as HTMLElement);
        });

        if (this.observers.has(container)) return;

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((m) => {
                if (m.type === "attributes" && m.attributeName === "custom-timer-records") {
                    this.queueBlock(container, m.target as HTMLElement);
                } else if (m.type === "childList" && m.addedNodes.length) {
                    m.addedNodes.forEach((node) => {
                        if (node.nodeType !== 1) return;
                        const el = node as HTMLElement;
                        if (el.hasAttribute("custom-timer-records")) {
                            this.queueBlock(container, el);
                        }
                        // 只在新节点内部再查找一次，避免深度递归
                        el.querySelectorAll?.('[custom-timer-records]').forEach((child) => this.queueBlock(container, child as HTMLElement));
                    });
                }
            });
        });
        observer.observe(container, { subtree: true, attributes: true, attributeFilter: ["custom-timer-records"], childList: true });
        this.observers.set(container, observer);
    }

    /** Add block to pending set and schedule batch render */
    private queueBlock(container: Element, block: HTMLElement) {
        if (!block) return;
        
        let state = this.protylePendingState.get(container);
        if (!state) {
            state = { blocks: new Set(), rafId: 0 };
            this.protylePendingState.set(container, state);
        }
        
        state.blocks.add(block);
        if (!state.rafId) {
            state.rafId = requestAnimationFrame(() => {
                const blocks = Array.from(state.blocks);
                state.blocks.clear();
                state.rafId = 0;
                blocks.forEach((b) => this.renderFocusForBlock(b));
            });
        }
    }
} 
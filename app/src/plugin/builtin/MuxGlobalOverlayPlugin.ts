import { showMessage } from "../../dialog/message";
import { Plugin } from "../index";

/**
 * Built-in plugin: Mux Global Overlay
 * Adds an option to every block context menu that starts a timer in the
 * external Global Overlay application.
 */
export class MuxGlobalOverlayPlugin extends Plugin {
    constructor(options: { app: import("../../index").App; name: string; displayName: string; i18n: IObject }) {
        super(options);

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
} 
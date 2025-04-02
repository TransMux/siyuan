import {App} from "../../index";
import {windowMouseMove} from "./mousemove";
import {windowKeyUp} from "./keyup";
import {windowKeyDown} from "./keydown";
import {globalClick} from "./click";
import {goBack, goForward} from "../../util/backForward";
import {Constants} from "../../constants";
import {isIPad} from "../../protyle/util/compatibility";
import {globalTouchEnd, globalTouchStart} from "./touch";
import {initDockMenu} from "../../menus/dock";
import {
    hasClosestByAttribute,
    hasClosestByClassName,
    isInEmbedBlock
} from "../../protyle/util/hasClosest";
import {initTabMenu} from "../../menus/tab";
import {getInstanceById} from "../../layout/util";
import {Tab} from "../../layout/Tab";
import {hideTooltip} from "../../dialog/tooltip";
import {openFileById} from "../../editor/util";
import {checkFold} from "../../util/noRelyPCFunction";
import {hideAllElements} from "../../protyle/ui/hideElements";
import {isWindow} from "../../util/functions";

export const initWindowEvent = (app: App) => {
    document.body.addEventListener("mouseleave", () => {
        if (window.siyuan.layout.leftDock) {
            window.siyuan.layout.leftDock.hideDock();
            window.siyuan.layout.rightDock.hideDock();
            window.siyuan.layout.bottomDock.hideDock();
        }
        document.querySelectorAll(".protyle-gutters").forEach(item => {
            item.classList.add("fn__none");
            item.innerHTML = "";
        });
        hideTooltip();
    });
    let mouseIsEnter = false;
    document.body.addEventListener("mouseenter", () => {
        if (window.siyuan.layout.leftDock) {
            mouseIsEnter = true;
            setTimeout(() => {
                mouseIsEnter = false;
            }, Constants.TIMEOUT_TRANSITION);
        }
    });

    window.addEventListener("mousemove", (event: MouseEvent & { target: HTMLElement }) => {
        windowMouseMove(event, mouseIsEnter);
    });

    // 添加dragover事件监听，在拖拽过程中也能显示侧边栏
    window.addEventListener("dragover", (event: DragEvent & { target: HTMLElement }) => {
        // 在拖拽操作时也能触发侧边栏显示
        if (!mouseIsEnter && window.siyuan.layout.bottomDock && !isWindow()) {
            if (event.clientX < Math.max(document.getElementById("dockLeft").clientWidth + 1, 16)) {
                if (!window.siyuan.layout.leftDock.pin && window.siyuan.layout.leftDock.layout.element.clientWidth > 0 &&
                    (window.siyuan.layout.leftDock.element.clientWidth > 0 || (window.siyuan.layout.leftDock.element.clientWidth === 0 && event.clientX < 8))) {
                    if (event.clientY > document.getElementById("toolbar").clientHeight &&
                        event.clientY < window.innerHeight - document.getElementById("status").clientHeight - document.getElementById("dockBottom").clientHeight) {
                        if (!hasClosestByClassName(event.target, "b3-menu") &&
                            !hasClosestByClassName(event.target, "protyle-toolbar") &&
                            !hasClosestByClassName(event.target, "protyle-util") &&
                            !hasClosestByClassName(event.target, "b3-dialog", true) &&
                            !hasClosestByClassName(event.target, "layout--float")) {
                            window.siyuan.layout.leftDock.showDock();
                        }
                    } else {
                        window.siyuan.layout.leftDock.hideDock();
                    }
                }
            } else if (event.clientX > window.innerWidth - Math.max(document.getElementById("dockRight").clientWidth - 2, 16)) {
                if (!window.siyuan.layout.rightDock.pin && window.siyuan.layout.rightDock.layout.element.clientWidth > 0 &&
                    (window.siyuan.layout.rightDock.element.clientWidth > 0 || (window.siyuan.layout.rightDock.element.clientWidth === 0 && event.clientX > window.innerWidth - 8))) {
                    if (event.clientY > document.getElementById("toolbar").clientHeight &&
                        event.clientY < window.innerHeight - document.getElementById("status").clientHeight - document.getElementById("dockBottom").clientHeight) {
                        if (!hasClosestByClassName(event.target, "b3-menu") &&
                            !hasClosestByClassName(event.target, "layout--float") &&
                            !hasClosestByClassName(event.target, "protyle-toolbar") &&
                            !hasClosestByClassName(event.target, "protyle-util") &&
                            !hasClosestByClassName(event.target, "b3-dialog", true)) {
                            window.siyuan.layout.rightDock.showDock();
                        }
                    } else {
                        window.siyuan.layout.rightDock.hideDock();
                    }
                }
            }
            if (event.clientY > Math.min(window.innerHeight - 10, window.innerHeight - (window.siyuan.config.uiLayout.hideDock ? 0 : document.getElementById("dockBottom").clientHeight) - document.querySelector("#status").clientHeight)) {
                window.siyuan.layout.bottomDock.showDock();
            }
        }
    });

    window.addEventListener("mouseup", (event) => {
        if (event.button === 3) {
            event.preventDefault();
            goBack(app);
        } else if (event.button === 4) {
            event.preventDefault();
            goForward(app);
        }
    });

    window.addEventListener("mousedown", (event) => {
        // protyle.toolbar 点击空白处时进行隐藏
        if (!hasClosestByClassName(event.target as Element, "protyle-toolbar")) {
            hideAllElements(["toolbar"]);
        }
    });

    window.addEventListener("keyup", (event) => {
        windowKeyUp(app, event);
    });

    window.addEventListener("keydown", (event) => {
        windowKeyDown(app, event);
    });

    window.addEventListener("blur", () => {
        window.siyuan.ctrlIsPressed = false;
        window.siyuan.shiftIsPressed = false;
        window.siyuan.altIsPressed = false;
    });

    window.addEventListener("click", (event: MouseEvent & { target: HTMLElement }) => {
        globalClick(event);
    });

    let time = 0;
    document.addEventListener("touchstart", (event) => {
        time = new Date().getTime();
        // https://github.com/siyuan-note/siyuan/issues/6328
        const target = event.target as HTMLElement;
        if (hasClosestByClassName(target, "protyle-icons") ||
            hasClosestByClassName(target, "item") ||
            target.classList.contains("protyle-background__icon")) {
            return;
        }
        const embedBlockElement = isInEmbedBlock(target);
        if (embedBlockElement) {
            embedBlockElement.firstElementChild.classList.toggle("protyle-icons--show");
            return;
        }
        // 触摸屏背景和嵌入块按钮显示
        globalTouchStart(event);
    }, false);
    document.addEventListener("touchend", (event) => {
        if (isIPad()) {
            // https://github.com/siyuan-note/siyuan/issues/9113
            if (globalTouchEnd(event, undefined, time, app)) {
                event.stopImmediatePropagation();
                event.preventDefault();
                return;
            }
            if (new Date().getTime() - time <= 900) {
                return;
            }
            const target = event.target as HTMLElement;
            // dock right menu
            const dockElement = hasClosestByClassName(target, "dock__item");
            if (dockElement && dockElement.getAttribute("data-type")) {
                const dockRect = dockElement.getBoundingClientRect();
                initDockMenu(dockElement).popup({x: dockRect.right, y: dockRect.top});
                event.stopImmediatePropagation();
                event.preventDefault();
                return;
            }

            // tab right menu
            const tabElement = hasClosestByAttribute(target, "data-type", "tab-header");
            if (tabElement) {
                const tabRect = tabElement.getBoundingClientRect();
                initTabMenu(app, (getInstanceById(tabElement.getAttribute("data-id")) as Tab)).popup({
                    x: tabRect.left,
                    y: tabRect.bottom
                });
                hideTooltip();
                event.stopImmediatePropagation();
                event.preventDefault();
                return;
            }

            const backlinkBreadcrumbItemElement = hasClosestByClassName(target, "protyle-breadcrumb__item");
            if (backlinkBreadcrumbItemElement) {
                const breadcrumbId = backlinkBreadcrumbItemElement.getAttribute("data-id") || backlinkBreadcrumbItemElement.getAttribute("data-node-id");
                if (breadcrumbId) {
                    checkFold(breadcrumbId, (zoomIn) => {
                        openFileById({
                            app,
                            id: breadcrumbId,
                            action: zoomIn ? [Constants.CB_GET_FOCUS, Constants.CB_GET_ALL] : [Constants.CB_GET_FOCUS, Constants.CB_GET_CONTEXT],
                            zoomIn,
                        });
                        window.siyuan.menus.menu.remove();
                    });
                }
                event.stopImmediatePropagation();
                event.preventDefault();
                return;
            }
        }
    }, false);
};

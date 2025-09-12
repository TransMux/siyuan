// 只保留轻量级工具函数的直接导入
import {fetchGet, fetchPost, fetchSyncPost} from "../util/fetch";
import {getBackend, getFrontend} from "../util/functions";
import {updateHotkeyTip} from "../protyle/util/compatibility";
import * as platformUtils from "../protyle/util/compatibility";
import {Constants} from "../constants";

// 所有重型模块和可能产生循环引用的模块都延迟加载
/// #if !MOBILE
import {openFile, openFileById} from "../editor/util";
import {openNewWindow, openNewWindowById} from "../window/openNewWindow";
import {Tab} from "../layout/Tab";
import {getActiveTab, getDockByType} from "../layout/tabUtil";
import {getAllModels} from "../layout/getAll";
/// #endif
import {getAllEditor} from "../layout/getAll";
import {hasClosestByClassName} from "../protyle/util/hasClosest";

let openTab;
let openWindow;
/// #if MOBILE
openTab = () => {
    // TODO: Mobile
};
openWindow = () => {
    // TODO: Mobile
};
/// #else
openWindow = (options: {
    position?: IPosition,
    height?: number,
    width?: number,
    tab?: Tab,
    doc?: {
        id: string,     // 块 id
    },
}) => {
    if (options.doc && options.doc.id) {
        openNewWindowById(options.doc.id, {position: options.position, width: options.width, height: options.height});
        return;
    }
    if (options.tab) {
        openNewWindow(options.tab, {position: options.position, width: options.width, height: options.height});
        return;
    }
};

openTab = (options: {
    app: App,
    doc?: {
        id: string,     // 块 id
        action?: TProtyleAction [] // cb-get-all：获取所有内容；cb-get-focus：打开后光标定位在 id 所在的块；cb-get-hl: 打开后 id 块高亮
        zoomIn?: boolean // 是否缩放
    },
    pdf?: {
        path: string,
        page?: number,  // pdf 页码
        id?: string,    // File Annotation id
    },
    asset?: {
        path: string,
    },
    search?: Config.IUILayoutTabSearchConfig
    card?: {
        type: TCardType,
        id?: string, //  cardType 为 all 时不传，否则传文档或笔记本 id
        title?: string //  cardType 为 all 时不传，否则传文档或笔记本名称
    },
    custom?: {
        title: string,
        icon: string,
        data?: any
        id: string
    }
    position?: "right" | "bottom",
    keepCursor?: boolean // 是否跳转到新 tab 上
    removeCurrentTab?: boolean // 在当前页签打开时需移除原有页签
    afterOpen?: (model?: Model) => void // 打开后回调
}) => {
    if (options.doc) {
        if (options.doc.zoomIn) {
            if (options.doc.action && !options.doc.action.includes(Constants.CB_GET_ALL)) {
                options.doc.action.push(Constants.CB_GET_ALL);
            } else {
                options.doc.action = [Constants.CB_GET_ALL];
            }
        }
        if (!options.doc.action) {
            options.doc.action = [];
        }
        return openFileById({
            app: options.app,
            keepCursor: options.keepCursor,
            removeCurrentTab: options.removeCurrentTab,
            position: options.position,
            afterOpen: options.afterOpen,
            id: options.doc.id,
            action: options.doc.action,
            zoomIn: options.doc.zoomIn
        });
    }
    if (options.asset) {
        return openFile({
            app: options.app,
            keepCursor: options.keepCursor,
            removeCurrentTab: options.removeCurrentTab,
            position: options.position,
            afterOpen: options.afterOpen,
            assetPath: options.asset.path,
        });
    }
    if (options.pdf) {
        return openFile({
            app: options.app,
            keepCursor: options.keepCursor,
            removeCurrentTab: options.removeCurrentTab,
            position: options.position,
            afterOpen: options.afterOpen,
            assetPath: options.pdf.path,
            page: options.pdf.id || options.pdf.page,
        });
    }
    if (options.search) {
        if (!options.search.idPath) {
            options.search.idPath = [];
        }
        if (!options.search.hPath) {
            options.search.hPath = "";
        }
        return openFile({
            app: options.app,
            keepCursor: options.keepCursor,
            removeCurrentTab: options.removeCurrentTab,
            position: options.position,
            afterOpen: options.afterOpen,
            searchData: options.search,
        });
    }
    if (options.card) {
        return openFile({
            app: options.app,
            keepCursor: options.keepCursor,
            removeCurrentTab: options.removeCurrentTab,
            position: options.position,
            afterOpen: options.afterOpen,
            custom: {
                icon: "iconRiffCard",
                title: window.siyuan.languages.spaceRepetition,
                data: {
                    cardType: options.card.type,
                    id: options.card.id || "",
                    title: options.card.title,
                },
                id: "siyuan-card"
            },
        });
    }
    if (options.custom) {
        return openFile(options);
    }

};
/// #endif

const getModelByDockType = (type: TDock | string) => {
    /// #if MOBILE
    return window.siyuan.mobile.docks[type];
    /// #else
    return getDockByType(type).data[type];
    /// #endif
};

const openAttributePanel = (options: {
    data?: IObject  // 块属性值
    nodeElement?: HTMLElement,  // 块元素
    focusName: "bookmark" | "name" | "alias" | "memo" | "av" | "custom",    // av 为数据库页签，custom 为自定义页签，其余为内置输入框
    protyle?: IProtyle, // 有数据库时需要传入 protyle
}) => {
    if (options.data) {
        openFileAttr(options.data, options.focusName, options.protyle);
    } else {
        openAttr(options.nodeElement, options.focusName, options.protyle);
    }
};

const saveLayout = (cb: () => void) => {
    /// #if MOBILE
    if (window.siyuan.mobile.editor) {
        const result = saveScroll(window.siyuan.mobile.editor.protyle);
        if (cb && result instanceof Promise) {
            result.then(() => {
                cb();
            });
        }
    }
    /// #else
    exportLayout({cb, errorExit: false});
    /// #endif
};

const getActiveEditor = (wndActive = true) => {
    let editor;
    /// #if !MOBILE
    const range = getSelection().rangeCount > 0 ? getSelection().getRangeAt(0) : null;
    const allEditor = getAllEditor();
    if (range) {
        editor = allEditor.find(item => {
            if (item.protyle.element.contains(range.startContainer)) {
                return true;
            }
        });
    }
    if (!editor) {
        editor = allEditor.find(item => {
            if (hasClosestByClassName(item.protyle.element, "layout__wnd--active", true)) {
                return true;
            }
        });
    }
    if (!editor && !wndActive) {
        let activeTime = 0;
        allEditor.forEach(item => {
            let headerElement = item.protyle.model?.parent.headElement;
            if (!headerElement && item.protyle.element.getBoundingClientRect().height > 0) {
                const tabBodyElement = item.protyle.element.closest(".fn__flex-1[data-id]");
                if (tabBodyElement) {
                    headerElement = document.querySelector(`.layout-tab-bar .item[data-id="${tabBodyElement.getAttribute("data-id")}"]`);
                }
            }
            if (headerElement) {
                if (headerElement.classList.contains("item--focus") && parseInt(headerElement.dataset.activetime) > activeTime) {
                    activeTime = parseInt(headerElement.dataset.activetime);
                    editor = item;
                }
            } else if (item.protyle.element.getBoundingClientRect().height > 0) {
                editor = item;
            }
        });
    }
    /// #else
    editor = window.siyuan.mobile.popEditor || window.siyuan.mobile.editor;
    if (editor?.protyle.element.classList.contains("fn__none")) {
        return undefined;
    }
    /// #endif
    return editor;
};

export const expandDocTree = async (options: {
    id: string,
    isSetCurrent?: boolean
}) => {
    let isNotebook = false;
    window.siyuan.notebooks.find(item => {
        if (options.id === item.id) {
            isNotebook = true;
            return true;
        }
    });
    let liElement: HTMLElement;
    let notebookId = options.id;
    const file = getModelByDockType("file") as Files;
    if (typeof options.isSetCurrent === "undefined") {
        options.isSetCurrent = true;
    }
    if (isNotebook) {
        liElement = file.element.querySelector(`.b3-list[data-url="${options.id}"]`)?.firstElementChild as HTMLElement;
    } else {
        const response = await fetchSyncPost("api/block/getBlockInfo", {id: options.id});
        if (response.code === -1) {
            return;
        }
        notebookId = response.data.box;
        liElement = await file.selectItem(response.data.box, response.data.path, undefined, undefined, options.isSetCurrent);
    }
    if (!liElement) {
        return;
    }
    if (options.isSetCurrent || typeof options.isSetCurrent === "undefined") {
        file.setCurrent(liElement);
    }
    const toggleElement = liElement.querySelector(".b3-list-item__arrow");
    if (toggleElement.classList.contains("b3-list-item__arrow--open")) {
        return;
    }
    file.getLeaf(liElement, notebookId);
};

export const API = {
    // 直接导出的轻量级函数
    adaptHotkey: updateHotkeyTip,
    Constants,
    fetchPost,
    fetchSyncPost,
    fetchGet,
    getFrontend,
    getBackend,
    platformUtils,
    getAllEditor,
    /// #if !MOBILE
    getActiveTab,
    getAllModels,
    /// #endif
    
    // 所有重型模块都使用延迟加载
    get confirmDialog() {
        return require("../dialog/confirmDialog").confirmDialog;
    },
    get confirm() {
        return require("../dialog/confirmDialog").confirmDialog;
    },
    get showMessage() {
        return require("../dialog/message").showMessage;
    },
    get hideMessage() {
        return require("../dialog/message").hideMessage;
    },
    get Dialog() {
        return require("../dialog").Dialog;
    },
    get Protyle() {
        return require("../protyle").Protyle;
    },
    get Plugin() {
        return require("./index").Plugin;
    },
    get Menu() {
        return require("./Menu").Menu;
    },
    get Setting() {
        return require("./Setting").Setting;
    },
    get lockScreen() {
        return require("../dialog/processSystem").lockScreen;
    },
    get exitSiYuan() {
        return require("../dialog/processSystem").exitSiYuan;
    },
    get openSetting() {
        return require("../config").openSetting;
    },
    get globalCommand() {
        return require("../boot/globalEvent/command/global").globalCommand;
    },
    
    // 平台相关的延迟加载
    getModelByDockType,
    openTab,
    openWindow,
    /// #if MOBILE
    get openMobileFileById() {
        return require("../mobile/editor").openMobileFileById;
    },
    /// #else
    get openMobileFileById() {
        return require("../mobile/editor").openMobileFileById;
    },
    /// #endif
    
    getActiveEditor,
    openAttributePanel,
    saveLayout,
    expandDocTree
};

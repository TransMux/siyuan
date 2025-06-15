import { Dialog } from "../../../dialog";
import { App } from "../../../index";
import { upDownHint } from "../../../util/upDownHint";
import { updateHotkeyTip } from "../../../protyle/util/compatibility";
import { isMobile } from "../../../util/functions";
import { Constants } from "../../../constants";
import { Editor } from "../../../editor";
/// #if MOBILE
import { getCurrentEditor } from "../../../mobile/editor";
import { popSearch } from "../../../mobile/menu/search";
/// #else
import { getActiveTab, getDockByType } from "../../../layout/tabUtil";
import { Custom } from "../../../layout/dock/Custom";
import { getAllModels } from "../../../layout/getAll";
import { Files } from "../../../layout/dock/Files";
import { Search } from "../../../search";
import { openSearch } from "../../../search/spread";
/// #endif
import { addEditorToDatabase, addFilesToDatabase } from "../../../protyle/render/av/addToDatabase";
import { hasClosestBlock, hasClosestByClassName, hasTopClosestByTag } from "../../../protyle/util/hasClosest";
import { onlyProtyleCommand } from "./protyle";
import { globalCommand } from "./global";
import { getDisplayName, getNotebookName, getTopPaths, movePathTo, moveToPath, pathPosix } from "../../../util/pathName";
import { hintMoveBlock } from "../../../protyle/hint/extend";
import { fetchPost, fetchSyncPost } from "../../../util/fetch";
import { focusByRange } from "../../../protyle/util/selection";
import { unicode2Emoji } from "../../../emoji";
import { escapeHtml } from "../../../util/escape";
import { openFileById } from "../../../editor/util";
/// #if !BROWSER
import { ipcRenderer } from "electron";
import { get } from "../../../mux/settings";
import { toggle } from "../../../mux/hide-checked";
/// #endif
import { transaction } from "../../../protyle/wysiwyg/transaction";
import { hideElements } from "../../../protyle/ui/hideElements";
import * as dayjs from "dayjs";
import { fullscreen } from "../../../protyle/breadcrumb/action";
import { resize } from "../../../protyle/util/resize";

// https://x.transmux.top/j/20241103163805-hj20chp
const commandKeyToLabel: { [key: string]: string } = {
    addToDatabase: "add selected to database",
    fileTree: "open file tree",
    outline: "open outline",
    // bookmark: "open bookmark",
    tag: "open tag",
    dailyNote: "open daily note",
    inbox: "open inbox",
    backlinks: "open backlinks",
    dataHistory: "open data history",
    editReadonly: "edit readonly",
    lockScreen: "lock screen",
    selectOpen1: "focus current tab",
    closeAll: "close all tabs",
    closeLeft: "close left tabs",
    closeOthers: "close other tabs",
    closeRight: "close right tabs",
    closeUnmodified: "close unmodified tabs",
    config: "open settings",
    goToTab1: "goto tab 1",
    goToTab2: "goto tab 2",
    goToTab3: "goto tab 3",
    goToTab4: "goto tab 4",
    goToTab5: "goto tab 5",
    goToTab6: "goto tab 6",
    goToTab7: "goto tab 7",
    goToTab8: "goto tab 8",
    goToTab9: "goto tab 9",
    // toggleWin: "hide window",
    move: "move selected block to..."
};


export const commandPanel = (app: App) => {
    const range = getSelection().rangeCount > 0 ? getSelection().getRangeAt(0) : undefined;
    const dialog = new Dialog({
        width: isMobile() ? "92vw" : "80vw",
        height: isMobile() ? "80vh" : "70vh",
        title: window.siyuan.languages.commandPanel,
        content: `<div class="fn__flex-column">
    <div class="b3-form__icon search__header" style="border-top: 0;border-bottom: 1px solid var(--b3-theme-surface-lighter);">
        <input class="b3-text-field b3-text-field--text" style="padding-left: 8px !important;">
    </div>
    <ul class="b3-list b3-list--background search__list" id="commands"></ul>
    <div class="search__tip">
        <kbd>↑/↓</kbd> ${window.siyuan.languages.searchTip1}
        <kbd>${window.siyuan.languages.enterKey}/${window.siyuan.languages.click}</kbd> ${window.siyuan.languages.confirm}
        <kbd>Esc</kbd> ${window.siyuan.languages.close}
    </div>
</div>`,
        // [打开时不要取消之前的焦点](siyuan://blocks/20241025222946-jwrrwo3)
        destroyCallback(options: IObject) {
            if (range && !options) {
                focusByRange(range);
            }
        },
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_COMMANDPANEL);
    const listElement = dialog.element.querySelector("#commands");

    // https://x.transmux.top/j/20241101223108-o9zjabn
    let commandHtml = "";
    let keys;
    /// #if MOBILE
    keys = ["addToDatabase", "fileTree", "outline", "bookmark", "tag", "dailyNote", "inbox", "backlinks",
        "dataHistory", "editReadonly", "enter", "enterBack", "globalSearch", "lockScreen", "mainMenu", "move",
        "newFile", "recentDocs", "replace", "riffCard", "search", "selectOpen1", "syncNow"];
    /// #else
    keys = ["addToDatabase", "fileTree", "outline", "bookmark", "tag", "dailyNote", "inbox", "backlinks",
        "graphView", "globalGraph", "closeAll", "closeLeft", "closeOthers", "closeRight", "closeTab",
        "closeUnmodified", "config", "dataHistory", "editReadonly", "enter", "enterBack", "globalSearch", "goBack",
        "goForward", "goToEditTabNext", "goToEditTabPrev", "goToTab1", "goToTab2", "goToTab3", "goToTab4",
        "goToTab5", "goToTab6", "goToTab7", "goToTab8", "goToTab9", "goToTabNext", "goToTabPrev", "lockScreen",
        "mainMenu", "move", "newFile", "recentDocs", "replace", "riffCard", "search", "selectOpen1", "syncNow",
        "splitLR", "splitMoveB", "splitMoveR", "splitTB", "tabToWindow", "stickSearch", "toggleDock", "unsplitAll",
        "unsplit"];
    /// #if !BROWSER
    keys.push("toggleWin");
    /// #endif
    /// #endif
    Object.keys(window.siyuan.config.keymap.general).forEach((key) => {
        if (keys.includes(key) && commandKeyToLabel[key]) {
            commandHtml += `<li class="b3-list-item" data-command="${key}">
    <span class="b3-list-item__text">${window.siyuan.languages[key]} (${commandKeyToLabel[key]})</span>
    <span class="b3-list-item__meta${isMobile() ? " fn__none" : ""}">${updateHotkeyTip(window.siyuan.config.keymap.general[key].custom)}</span>
</li>`;
        }
    });

    // https://x.transmux.top/j/20241103170133-bvx9q0c
    const homeId = get<string>("主页ID");
    if (homeId) {
        commandHtml += `<li class="b3-list-item" data-command="openDoc" data-node-id="${homeId}">
    <span class="b3-list-item__text">打开主页 (open homepage)</span>
</li>`;
    }

    // Quick Append
    commandHtml += `<li class="b3-list-item" data-command="quickAppend">
    <span class="b3-list-item__text">快速添加到 Daily Note (quick append)</span>
</li>`;

    // 重载当前窗口，特别是在分屏需要更新主窗口修改的时候
    commandHtml += `<li class="b3-list-item" data-command="reload">
    <span class="b3-list-item__text">重新加载当前窗口 (reload current window)</span>
</li>`;

    // 打开开发者工具
    /// #if !BROWSER
    commandHtml += `<li class="b3-list-item" data-command="openDevTools">
    <span class="b3-list-item__text">打开开发者工具 (open developer tools)</span>
</li>`;
    /// #endif

    // https://x.transmux.top/j/20250207000640-w6qpyf9
    commandHtml += `<li class="b3-list-item" data-command="hideChecked">
    <span class="b3-list-item__text">隐藏已完成的任务 (hide checked)</span>
</li>`;

    // https://x.transmux.top/j/20250424021027-5iwd0ww
    if (range) {
        commandHtml += `<li class="b3-list-item" data-command="numberLinkToSuperscript">
        <span class="b3-list-item__text">选中范围：数字链接转上标 (selected range: number link to superscript)</span>
    </li>`;
    }

    // https://x.transmux.top/j/20250426020622-1jy3dxy
    commandHtml += `<li class="b3-list-item" data-command="toggleProtyleFullscreen">
        <span class="b3-list-item__text">切换全屏 (toggle protyle fullscreen)</span>
    </li>`;
    

    // 新增命令：删除当前选中块的全部 inline 样式
    commandHtml += `<li class="b3-list-item" data-command="removeInlineStyles">
        <span class="b3-list-item__text">选中范围：删除全部 inline 样式 (selected range: remove inline styles)</span>
    </li>`;

    // https://x.transmux.top/j/20241101223108-o9zjabn
    let recentDocsHtml = "";
    let index = 0;
    fetchPost("/api/storage/getRecentDocs", {}, (response) => {
        const data: { rootID: string, icon: string, title: string }[] = response.data
        data.forEach((item) => {
            recentDocsHtml += `<li data-index="${index}" data-node-id="${item.rootID}" data-command="openDoc" class="b3-list-item${index === 0 ? " b3-list-item--focus" : ""}">
${unicode2Emoji(item.icon || window.siyuan.storage[Constants.LOCAL_IMAGES].file, "b3-list-item__graphic", true)}
<span class="b3-list-item__text">${escapeHtml(item.title)}</span>
</li>`;
            index++;
        });
        dialog.element.addEventListener("click", (event) => {
            const liElement = hasClosestByClassName(event.target as HTMLElement, "b3-list-item");
            if (liElement) {
                dialog.element.querySelector(".b3-list-item--focus").classList.remove("b3-list-item--focus");
                liElement.classList.add("b3-list-item--focus");
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
                event.stopPropagation();
                event.preventDefault();
            }
        });
    });

    // 默认是在命令界面
    listElement.insertAdjacentHTML("beforeend", commandHtml);
    app.plugins.forEach(plugin => {
        plugin.commands.forEach(command => {
            const liElement = document.createElement("li");
            liElement.innerHTML = `<li class="b3-list-item">
<span class="b3-list-item__text">${plugin.displayName}: ${command.langText || plugin.i18n[command.langKey]}</span>
<span class="b3-list-item__meta${isMobile() ? " fn__none" : ""}">${updateHotkeyTip(command.customHotkey)}</span>
</li>`;
            liElement.addEventListener("click", (event) => {
                dialog.destroy();
                setTimeout(() => {
                    if (command.callback) {
                        // 传递 event 给回调函数，不然拿不到里面的数据，TODO：有没有一个更好的方法？其他情况下不传也挺奇怪的
                        command.callback(event);
                    } else if (command.globalCallback) {
                        command.globalCallback();
                    }
                    // 等待range恢复
                }, 500);
                event.preventDefault();
                event.stopPropagation();
            });
            listElement.insertAdjacentElement("beforeend", liElement);
        });
    });

    if (listElement.childElementCount === 0) {
        const liElement = document.createElement("li");
        liElement.classList.add("b3-list-item", "b3-list-item--focus");
        liElement.innerHTML = `<span class="b3-list-item__text" style="-webkit-line-clamp: inherit;">${window.siyuan.languages._kernel[122]}</span>`;
        liElement.addEventListener("click", () => {
            dialog.destroy();
        });
        listElement.insertAdjacentElement("beforeend", liElement);
    } else {
        listElement.firstElementChild.classList.add("b3-list-item--focus");
    }

    const inputElement = dialog.element.querySelector(".b3-text-field") as HTMLInputElement;
    inputElement.focus();
    inputElement.value = ">";

    // 切换模式 https://x.transmux.top/j/20241101230411-mn6vqw8
    let currentMode: "command" | "recentDoc" = "command";

    listElement.addEventListener("click", (event: KeyboardEvent) => {
        const liElement = hasClosestByClassName(event.target as HTMLElement, "b3-list-item");
        if (liElement) {
            const command = liElement.getAttribute("data-command");
            if (command) {
                dialog.destroy();
                // https://x.transmux.top/j/20241101230411-mn6vqw8
                if (command === "openDoc") {
                    openFileById({
                        app,
                        id: liElement.getAttribute("data-node-id")
                    });
                } else if (command === "reload") {
                    window.location.reload();
                } else if (command === "openDevTools") {
                    ipcRenderer.send(Constants.SIYUAN_CMD, "openDevTools")
                } else if (command === "hideChecked") {
                    // https://x.transmux.top/j/20250207000640-w6qpyf9
                    toggle()
                } else {
                    execByCommand({ command, app, previousRange: range });
                }
                event.preventDefault();
                event.stopPropagation();
            }
        }
    });

    inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
        event.stopPropagation();
        if (event.isComposing) {
            return;
        }
        upDownHint(listElement, event);
        if (event.key === "Enter") {
            // 触发后不再执行默认的点击事件
            event.preventDefault();
            event.stopPropagation();
            const currentElement = listElement.querySelector(".b3-list-item--focus");
            if (currentElement) {
                const command = currentElement.getAttribute("data-command");
                if (command) {
                    dialog.destroy();
                    // https://x.transmux.top/j/20241101230411-mn6vqw8
                    if (command === "openDoc") {
                        openFileById({
                            app,
                            id: currentElement.getAttribute("data-node-id")
                        });
                    } else if (command === "reload") {
                        window.location.reload();
                    } else if (command === "openDevTools") {
                        ipcRenderer.send(Constants.SIYUAN_CMD, "openDevTools")
                    } else if (command === "hideChecked") {
                        // https://x.transmux.top/j/20250207000640-w6qpyf9
                        toggle()
                    } else {
                        execByCommand({ command, app, previousRange: range });
                    }
                } else {
                    // siyuan://blocks/20241025231614-ui1r5ui
                    currentElement.dispatchEvent(new CustomEvent("click", {
                        detail: { command, app, previousRange: range }
                    }));
                }
            }
        } else if (event.key === "Escape") {
            dialog.destroy();
        }
    });
    inputElement.addEventListener("compositionend", () => {
        filterList(inputElement, listElement);
    });
    inputElement.addEventListener("input", (event: InputEvent) => {
        if (event.isComposing) {
            return;
        }
        event.stopPropagation();
        const newMode = inputElement.value.startsWith(">") ? "command" : "recentDoc";
        if (newMode !== currentMode) {
            currentMode = newMode;
            // 切换模式
            if (newMode === "recentDoc") {
                listElement.innerHTML = recentDocsHtml;
            } else {
                listElement.innerHTML = commandHtml;
                listElement.firstElementChild.classList.add("b3-list-item--focus");
            }
        }
        filterList(inputElement, listElement);
    });
};

const filterList = (inputElement: HTMLInputElement, listElement: Element) => {
    // 如果[0]是>，那么把它去除
    const inputValue = inputElement.value.toLowerCase().replace(/^>/, "");
    listElement.querySelector(".b3-list-item--focus")?.classList.remove("b3-list-item--focus");
    let hasFocus = false;
    Array.from(listElement.children).forEach((element: HTMLElement) => {
        const elementValue = element.querySelector(".b3-list-item__text").textContent.toLowerCase();
        // [解决命令面板搜索报错的问题Pull Request](siyuan://blocks/20241025222931-f6d7vej)
        const command = element.dataset.command; // can be undefined
        const isCommandMatch = command ? inputValue.indexOf(command) > -1 || command.indexOf(inputValue) > -1 : false;
        const isNameMatch = inputValue.indexOf(elementValue) > -1 || elementValue.indexOf(inputValue) > -1;

        if (isNameMatch || isCommandMatch) {
            if (!hasFocus) {
                element.classList.add("b3-list-item--focus");
            }
            hasFocus = true;
            element.classList.remove("fn__none");
        } else {
            element.classList.add("fn__none");
        }
    });
};

export const execByCommand = async (options: {
    command: string,
    app?: App,
    previousRange?: Range,
    protyle?: IProtyle,
    fileLiElements?: Element[],
}) => {
    if (globalCommand(options.command, options.app)) {
        return;
    }

    const isFileFocus = document.querySelector(".layout__tab--active")?.classList.contains("sy__file");

    let protyle = options.protyle;
    /// #if MOBILE
    if (!protyle) {
        protyle = getCurrentEditor().protyle;
        options.previousRange = protyle.toolbar.range;
    }
    /// #endif
    const range: Range = options.previousRange || (getSelection().rangeCount > 0 ? getSelection().getRangeAt(0) : document.createRange());
    let fileLiElements = options.fileLiElements;
    if (!isFileFocus && !protyle) {
        if (range) {
            window.siyuan.dialogs.find(item => {
                if (item.editors) {
                    Object.keys(item.editors).find(key => {
                        if (item.editors[key].protyle.element.contains(range.startContainer)) {
                            protyle = item.editors[key].protyle;
                            return true;
                        }
                    });
                    if (protyle) {
                        return true;
                    }
                }
            });
        }
        const activeTab = getActiveTab();
        if (!protyle && activeTab) {
            if (activeTab.model instanceof Editor) {
                protyle = activeTab.model.editor.protyle;
            } else if (activeTab.model instanceof Search) {
                if (activeTab.model.element.querySelector("#searchUnRefPanel").classList.contains("fn__none")) {
                    protyle = activeTab.model.editors.edit.protyle;
                } else {
                    protyle = activeTab.model.editors.unRefEdit.protyle;
                }
            } else if (activeTab.model instanceof Custom && activeTab.model.editors?.length > 0) {
                if (range) {
                    activeTab.model.editors.find(item => {
                        if (item.protyle.element.contains(range.startContainer)) {
                            protyle = item.protyle;
                            return true;
                        }
                    });
                }
            }
        } else if (!protyle) {
            if (!protyle && range) {
                window.siyuan.blockPanels.find(item => {
                    item.editors.find(editorItem => {
                        if (editorItem.protyle.element.contains(range.startContainer)) {
                            protyle = editorItem.protyle;
                            return true;
                        }
                    });
                    if (protyle) {
                        return true;
                    }
                });
            }
            const models = getAllModels();
            if (!protyle) {
                models.backlink.find(item => {
                    if (item.element.classList.contains("layout__tab--active")) {
                        if (range) {
                            item.editors.find(editor => {
                                if (editor.protyle.element.contains(range.startContainer)) {
                                    protyle = editor.protyle;
                                    return true;
                                }
                            });
                        }
                        if (!protyle && item.editors.length > 0) {
                            protyle = item.editors[0].protyle;
                        }
                        return true;
                    }
                });
            }
            if (!protyle) {
                models.editor.find(item => {
                    if (item.parent.headElement.classList.contains("item--focus")) {
                        protyle = item.editor.protyle;
                        return true;
                    }
                });
            }
        }
    }

    // only protyle
    if (!isFileFocus && protyle && onlyProtyleCommand({
        command: options.command,
        previousRange: range,
        protyle
    })) {
        return;
    }

    if (isFileFocus && !fileLiElements) {
        const dockFile = getDockByType("file");
        if (!dockFile) {
            return false;
        }
        const files = dockFile.data.file as Files;
        fileLiElements = Array.from(files.element.querySelectorAll(".b3-list-item--focus"));
    }

    // 全局命令，在没有 protyle 和文件树没聚焦的情况下执行
    if ((!protyle && !isFileFocus) ||
        (isFileFocus && (!fileLiElements || fileLiElements.length === 0)) ||
        (isMobile() && !document.getElementById("empty").classList.contains("fn__none"))) {
        if (options.command === "replace") {
            /// #if MOBILE
            popSearch(options.app, { hasReplace: true, page: 1 });
            /// #else
            openSearch({
                app: options.app,
                hotkey: Constants.DIALOG_REPLACE,
                key: range.toString()
            });
            /// #endif
        } else if (options.command === "search") {
            /// #if MOBILE
            popSearch(options.app, { hasReplace: false, page: 1 });
            /// #else
            openSearch({
                app: options.app,
                hotkey: Constants.DIALOG_SEARCH,
                key: range.toString()
            });
            /// #endif
        }
        return;
    }

    // protyle and file tree
    switch (options.command) {
        case "replace":
            if (!isFileFocus) {
                /// #if MOBILE
                const response = await fetchSyncPost("/api/filetree/getHPathByPath", {
                    notebook: protyle.notebookId,
                    path: protyle.path.endsWith(".sy") ? protyle.path : protyle.path + ".sy"
                });
                popSearch(options.app, {
                    page: 1,
                    hasReplace: true,
                    hPath: pathPosix().join(getNotebookName(protyle.notebookId), response.data),
                    idPath: [pathPosix().join(protyle.notebookId, protyle.path)]
                });
                /// #else
                openSearch({
                    app: options.app,
                    hotkey: Constants.DIALOG_REPLACE,
                    key: range.toString(),
                    notebookId: protyle.notebookId,
                    searchPath: protyle.path
                });
                /// #endif
            } else {
                /// #if !MOBILE
                const topULElement = hasTopClosestByTag(fileLiElements[0], "UL");
                if (!topULElement) {
                    return false;
                }
                const notebookId = topULElement.getAttribute("data-url");
                const pathString = fileLiElements[0].getAttribute("data-path");
                const isFile = fileLiElements[0].getAttribute("data-type") === "navigation-file";
                if (isFile) {
                    openSearch({
                        app: options.app,
                        hotkey: Constants.DIALOG_REPLACE,
                        notebookId: notebookId,
                        searchPath: getDisplayName(pathString, false, true)
                    });
                } else {
                    openSearch({
                        app: options.app,
                        hotkey: Constants.DIALOG_REPLACE,
                        notebookId: notebookId,
                    });
                }
                /// #endif
            }
            break;
        case "toggleProtyleFullscreen":
            if (protyle) {
                fullscreen(protyle.element);
                resize(protyle);
            }
            break;
        case "search":
            if (!isFileFocus) {
                /// #if MOBILE
                const response = await fetchSyncPost("/api/filetree/getHPathByPath", {
                    notebook: protyle.notebookId,
                    path: protyle.path.endsWith(".sy") ? protyle.path : protyle.path + ".sy"
                });
                popSearch(options.app, {
                    page: 1,
                    hasReplace: false,
                    hPath: pathPosix().join(getNotebookName(protyle.notebookId), response.data),
                    idPath: [pathPosix().join(protyle.notebookId, protyle.path)]
                });
                /// #else
                openSearch({
                    app: options.app,
                    hotkey: Constants.DIALOG_SEARCH,
                    key: range.toString(),
                    notebookId: protyle.notebookId,
                    searchPath: protyle.path
                });
                /// #endif
            } else {
                /// #if !MOBILE
                const topULElement = hasTopClosestByTag(fileLiElements[0], "UL");
                if (!topULElement) {
                    return false;
                }
                const notebookId = topULElement.getAttribute("data-url");
                const pathString = fileLiElements[0].getAttribute("data-path");
                const isFile = fileLiElements[0].getAttribute("data-type") === "navigation-file";
                if (isFile) {
                    openSearch({
                        app: options.app,
                        hotkey: Constants.DIALOG_SEARCH,
                        notebookId: notebookId,
                        searchPath: getDisplayName(pathString, false, true)
                    });
                } else {
                    openSearch({
                        app: options.app,
                        hotkey: Constants.DIALOG_SEARCH,
                        notebookId: notebookId,
                    });
                }
                /// #endif
            }
            break;
        case "addToDatabase":
            if (!isFileFocus) {
                addEditorToDatabase(protyle, range);
            } else {
                addFilesToDatabase(fileLiElements);
            }
            break;
        case "numberLinkToSuperscript":
            if (!isFileFocus && protyle) {
                // 1. 获取所有选中的块
                const selectedBlocks = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
                if (selectedBlocks.length === 0) {
                    return;
                }
                
                const operations: IOperation[] = [];
                
                // 2. 对每个选中的块进行处理
                selectedBlocks.forEach(element => {
                    const blockId = element.getAttribute("data-node-id");
                    if (!blockId) return;
                    
                    // 保存原始HTML用于撤销
                    // const oldHTML = element.outerHTML;
                    let hasChanged = false;
                    
                    // 3. 寻找所有链接
                    const links = element.querySelectorAll('span[data-type="a"]');
                    links.forEach(link => {
                        const dataType = link.getAttribute("data-type") || "";
                        
                        // 4. 检查条件：data-type不包含sup，是a类型，且只有数字
                        if (!dataType.includes("sup") && 
                            dataType === "a" && 
                            /^\d+$/.test(link.textContent.trim())) {
                            
                            // 更新data-type，添加sup
                            link.setAttribute("data-type", "a sup");
                            hasChanged = true;
                        }
                    });
                    
                    // 5. 如果有更改，添加到操作列表
                    if (hasChanged) {
                        element.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                        operations.push({
                            action: "update",
                            id: blockId,
                            data: element.outerHTML,
                            parentID: element.parentElement?.getAttribute("data-node-id") || protyle.block.parentID
                        });
                    }
                });
                
                // 如果有操作，执行事务
                if (operations.length > 0) {
                    transaction(protyle, operations, []);
                    hideElements(["select"], protyle);
                }
            }
            break;
        case "removeInlineStyles":
            if (!isFileFocus && protyle) {
                // 1. 获取所有选中的块
                const selectedBlocks = protyle.wysiwyg.element.querySelectorAll('.protyle-wysiwyg--select');
                if (selectedBlocks.length === 0) {
                    return;
                }
                const operations: IOperation[] = [];
                const undoOperations: IOperation[] = [];
                // 2. 遍历每个选中块，移除所有自定义属性及内联样式元素
                selectedBlocks.forEach(element => {
                    const blockId = element.getAttribute('data-node-id');
                    if (!blockId) return;
                    // 保存原始 HTML 用于撤销
                    const oldHTML = element.outerHTML;
                    // 删除块元素上的所有自定义属性 (属性名以 'custom-' 开头)
                    Array.from(element.attributes).map(a => a.name)
                        .filter(name => name.startsWith('custom-'))
                        .forEach(name => element.removeAttribute(name));
                    // 不断查找并展开第一个内联样式span，直到没有为止
                    let inlineEl = element.querySelector('span[data-type]');
                    while (inlineEl) {
                        const parentNode = inlineEl.parentNode;
                        // 将所有子节点移到父节点中，并移除wrapper
                        while (inlineEl.firstChild) {
                            parentNode.insertBefore(inlineEl.firstChild, inlineEl);
                        }
                        parentNode.removeChild(inlineEl);
                        inlineEl = element.querySelector('span[data-type]');
                    }
                    // 标记更新用于撤销
                    element.setAttribute('updated', dayjs().format('YYYYMMDDHHmmss'));
                    operations.push({
                        action: 'update',
                        id: blockId,
                        data: element.outerHTML,
                        parentID: element.parentElement?.getAttribute('data-node-id') || protyle.block.parentID
                    });
                    undoOperations.push({ action: 'update', id: blockId, data: oldHTML });
                });
                // 3. 执行事务并隐藏选中样式
                if (operations.length > 0) {
                    transaction(protyle, operations, undoOperations);
                    hideElements(['select'], protyle);
                }
            }
            break;
        case "move":
            if (!isFileFocus) {
                const nodeElement = hasClosestBlock(range.startContainer);
                if (protyle.title?.editElement.contains(range.startContainer) || !nodeElement || window.siyuan.menus.menu.element.getAttribute("data-name") === "titleMenu") {
                    movePathTo((toPath, toNotebook) => {
                        moveToPath([protyle.path], toNotebook[0], toPath[0]);
                    }, [protyle.path], range);
                } else if (nodeElement && range && protyle.element.contains(range.startContainer)) {
                    let selectElements = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
                    if (selectElements.length === 0) {
                        selectElements = [nodeElement];
                    }
                    movePathTo((toPath) => {
                        hintMoveBlock(toPath[0], selectElements, protyle);
                    });
                }
            } else {
                const paths = getTopPaths(fileLiElements);
                movePathTo((toPath, toNotebook) => {
                    moveToPath(paths, toNotebook[0], toPath[0]);
                }, paths);
            }
            break;
    }
};

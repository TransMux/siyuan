import {ToolbarItem} from "./ToolbarItem";
import {getEventName} from "../util/compatibility";
import {fetchSyncPost} from "../../util/fetch";
import {openNewWindowById} from "../../window/openNewWindow";
import {Constants} from "../../constants";
import {showMessage} from "../../dialog/message";

export class QuickAppend extends ToolbarItem {
    constructor(protyle: IProtyle, menuItem: IMenuItem) {
        super(protyle, menuItem);
        this.element.addEventListener(getEventName(), async (event: MouseEvent & { changedTouches?: MouseEvent[] }) => {
            event.preventDefault();
            event.stopPropagation();
            // Hide toolbar
            protyle.toolbar.element.classList.add("fn__none");
            // Append a blank task list item to daily note
            const notebookId = window.siyuan.storage[Constants.LOCAL_DAILYNOTEID];
            try {
                const resp = await fetchSyncPost("/api/block/appendDailyNoteBlock", {
                    notebook: notebookId,
                    dataType: "markdown",
                    data: "- [ ]"
                });
                if (resp.code !== 0) {
                    showMessage(resp.msg);
                    return;
                }
                const transactions: any[] = resp.data;
                const op = transactions[0]?.doOperations?.[0];
                const newBlockId = op?.id;
                if (newBlockId) {
                    openNewWindowById(newBlockId);
                }
            } catch (err) {
                console.error(err);
                showMessage(err.message || err);
            }
        }, true);
    }
} 
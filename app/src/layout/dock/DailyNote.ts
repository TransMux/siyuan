import {App} from "../../index";
import {Tab} from "../Tab";
import {Model} from "../Model";
import {Protyle} from "../../protyle";
import {fetchPost} from "../../util/fetch";
import {Constants} from "../../constants";

export class DailyNote extends Model {
    private el: HTMLElement;
    private container: HTMLElement;
    private editor?: Protyle;

    constructor(app: App, tab: Tab) {
        super({ app, id: tab.id });
        this.el = tab.panelElement;
        this.el.classList.add("fn__flex-column", "daily-note");
        this.el.innerHTML = `
<div class="block__icons">
    <div class="block__logo">
        <svg class="block__logoicon"><use xlink:href="#iconCalendar"></use></svg>${window.siyuan.languages.dailyNote}
    </div>
    <span class="fn__flex-1"></span>
    <span data-type="refresh" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${window.siyuan.languages.refresh}">
        <svg><use xlink:href="#iconRefresh"></use></svg>
    </span>
</div>
<div class="fn__flex-1" style="margin-top:8px;"></div>`;
        this.container = this.el.querySelector(".fn__flex-1:last-child") as HTMLElement;
        this.loadDaily();
        this.el.addEventListener("click", (evt) => {
            if ((evt.target as HTMLElement).closest("[data-type='refresh']")) {
                this.loadDaily();
                evt.stopPropagation();
                evt.preventDefault();
            }
        });
    }

    private loadDaily() {
        const svg = this.el.querySelector(".block__icon[data-type='refresh'] svg");
        if (svg?.classList.contains("fn__rotate")) return;
        svg?.classList.add("fn__rotate");
        const nb = window.siyuan.storage[Constants.LOCAL_DAILYNOTEID];
        fetchPost("/api/filetree/createDailyNote", { notebook: nb, app: Constants.SIYUAN_APPID }, (res) => {
            this.editor?.destroy();
            this.container.innerHTML = "";
            this.editor = new Protyle(this.app, this.container, {
                blockId: res.data.id,
                action: [Constants.CB_GET_CONTEXT, Constants.CB_GET_ALL],
                render: { gutter: true, scroll: true, breadcrumb: false, background: false },
            });
            svg?.classList.remove("fn__rotate");
        });
    }
} 
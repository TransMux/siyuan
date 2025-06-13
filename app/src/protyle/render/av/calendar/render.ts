import {hasClosestBlock, hasClosestByAttribute, hasClosestByClassName} from "../../../util/hasClosest";
import {Constants} from "../../../../constants";
import {fetchPost} from "../../../../util/fetch";
import {escapeAriaLabel, escapeHtml} from "../../../../util/escape";
import {unicode2Emoji} from "../../../../emoji";
import {renderCell} from "../cell";
import {focusBlock} from "../../../util/selection";
import {electronUndo} from "../../../undo";
import {addClearButton} from "../../../../util/addClearButton";
import {updateSearch} from "../render";
import {getViewIcon} from "../view";
import {transaction} from "../../../wysiwyg/transaction";
import {Dialog} from "../../../../dialog";
import {showMessage} from "../../../../dialog/message";
import {genCellValueByElement} from "../cell";
import * as dayjs from "dayjs";
import {bindCalendarEvents} from "./events";
import {renderAVViewsBar} from "../header";

export const renderCalendar = (options: {
    blockElement: HTMLElement,
    protyle: IProtyle,
    cb?: (data:IAV) => void,
    viewID?: string,
    renderAll: boolean
}) => {
    const alignSelf = options.blockElement.style.alignSelf;
    if (options.blockElement.firstElementChild.innerHTML === "") {
        options.blockElement.style.alignSelf = "";
        options.blockElement.firstElementChild.outerHTML = `<div class="av__calendar">
    <span style="width: 100%;height: 200px;" class="av__pulse"></span>
    <span style="width: 100%;height: 200px;" class="av__pulse"></span>
    <span style="width: 100%;height: 200px;" class="av__pulse"></span>
</div>`;
    }

    const selectItemIds: string[] = [];
    options.blockElement.querySelectorAll(".av__calendar-event--select").forEach(eventItem => {
        const eventId = eventItem.getAttribute("data-id");
        if (eventId) {
            selectItemIds.push(eventId);
        }
    });
    const created = options.protyle.options.history?.created;
    const snapshot = options.protyle.options.history?.snapshot;
    let newViewID = options.blockElement.getAttribute(Constants.CUSTOM_SY_AV_VIEW) || "";
    if (typeof options.viewID === "string") {
        const viewTabElement = options.blockElement.querySelector(`.av__views > .layout-tab-bar > .item[data-id="${options.viewID}"]`) as HTMLElement;
        if (viewTabElement) {
            options.blockElement.dataset.pageSize = viewTabElement.dataset.page;
        }
        newViewID = options.viewID;
        fetchPost("/api/av/setDatabaseBlockView", {
            id: options.blockElement.dataset.nodeId,
            avID: options.blockElement.dataset.avId,
            viewID: options.viewID
        });
        options.blockElement.setAttribute(Constants.CUSTOM_SY_AV_VIEW, newViewID);
    }
    let searchInputElement = options.blockElement.querySelector('[data-type="av-search"]') as HTMLInputElement;
    const isSearching = searchInputElement && document.activeElement.isSameNode(searchInputElement);
    const query = searchInputElement?.value || "";
    fetchPost(created ? "/api/av/renderHistoryAttributeView" : (snapshot ? "/api/av/renderSnapshotAttributeView" : "/api/av/renderAttributeView"), {
        id: options.blockElement.getAttribute("data-av-id"),
        created,
        snapshot,
        pageSize: parseInt(options.blockElement.dataset.pageSize) || undefined,
        viewID: newViewID,
        query: query.trim()
    }, (response: IWebSocketData) => {
        const view = response.data.view;
        if (!options.blockElement.dataset.pageSize) {
            options.blockElement.dataset.pageSize = view.pageSize.toString();
        }
        let calendarHTML = "";
        
        // 生成日历头部（工具栏）
        const currentDate = new Date(view.startDate);
        const currentMonthYear = currentDate.toLocaleDateString(window.siyuan.config.lang, { 
            year: 'numeric', 
            month: 'long' 
        });
        
        calendarHTML += `<div class="av__calendar-header">
            <div class="av__calendar-nav fn__flex">
                <button class="b3-button b3-button--outline fn__flex-center" data-type="prev-period" aria-label="Previous ${view.viewType === 0 ? 'Month' : view.viewType === 1 ? 'Week' : 'Day'}">
                    <svg class="svg"><use xlink:href="#iconLeft"></use></svg>
                </button>
                <div class="av__calendar-current-date fn__flex-center">${currentMonthYear}</div>
                <button class="b3-button b3-button--outline fn__flex-center" data-type="next-period" aria-label="Next ${view.viewType === 0 ? 'Month' : view.viewType === 1 ? 'Week' : 'Day'}">
                    <svg class="svg"><use xlink:href="#iconRight"></use></svg>
                </button>
                <div class="fn__space"></div>
                <button class="b3-button b3-button--outline" data-type="today">今天</button>
            </div>
            <div class="av__calendar-view-switcher fn__flex">
                <button class="b3-button ${view.viewType === 0 ? 'b3-button--text' : 'b3-button--outline'}" data-type="month-view" data-view="0">
                    <svg class="svg"><use xlink:href="#iconCalendar"></use></svg>
                    <span class="fn__space--small"></span>
                    月视图
                </button>
                <button class="b3-button ${view.viewType === 1 ? 'b3-button--text' : 'b3-button--outline'}" data-type="week-view" data-view="1">
                    <svg class="svg"><use xlink:href="#iconCalendar"></use></svg>
                    <span class="fn__space--small"></span>
                    周视图
                </button>
                <button class="b3-button ${view.viewType === 2 ? 'b3-button--text' : 'b3-button--outline'}" data-type="day-view" data-view="2">
                    <svg class="svg"><use xlink:href="#iconCalendar"></use></svg>
                    <span class="fn__space--small"></span>
                    日视图
                </button>
            </div>
        </div>`;

        // 生成日历网格
        calendarHTML += generateCalendarGrid(view);
        
        // 生成事件列表
        calendarHTML += generateEventsList(view);

        calendarHTML += `<div class="av__calendar-add" data-type="av-add-bottom"><svg class="svg"><use xlink:href="#iconAdd"></use></svg><span class="fn__space"></span>${window.siyuan.languages.newCol}</div>`;
        
        let tabHTML = "";
        let viewData: IAVView;
        response.data.views.forEach((item: IAVView) => {
            tabHTML += `<div data-position="north" data-av-type="${item.type}" data-id="${item.id}" data-page="${item.pageSize}" data-desc="${escapeAriaLabel(item.desc || "")}" class="ariaLabel item${item.id === response.data.viewID ? " item--focus" : ""}">
    ${item.icon ? unicode2Emoji(item.icon, "item__graphic", true) : `<svg class="item__graphic"><use xlink:href="#${getViewIcon(item.type)}"></use></svg>`}
    <span class="item__text">${escapeHtml(item.name)}</span>
</div>`;
            if (item.id === response.data.viewID) {
                viewData = item;
            }
        });
        
        const viewsBarHTML = renderAVViewsBar({
            tabHTML,
            viewsCount: response.data.views.length,
            isSearching: !!isSearching,
            query,
            filtersActive: view.filters.length > 0,
            sortsActive: view.sorts.length > 0,
        });

        if (options.renderAll) {
            options.blockElement.firstElementChild.outerHTML = `<div class="av__container fn__block">
    <div class="av__header">
        ${viewsBarHTML}
        <div class="av__title${(response.data.view.hideAttrViewName || isSearching || query) ? " fn__none" : ""}">${escapeHtml(response.data.name)}</div>
    </div>
    <div class="av__calendar${response.data.view.hideAttrViewName && !isSearching && !query ? " av__calendar--top" : ""}">${calendarHTML}</div>
    <div class="fn__loading fn__none"><img src="/stage/loading-dots.svg"></div>
</div>`;
        } else {
            options.blockElement.querySelector(".av__calendar").innerHTML = calendarHTML;
        }

        if (options.cb) {
            options.cb(response.data);
        }
        addClearButton({
            inputElement: options.blockElement.querySelector('.av__views .b3-text-field') as HTMLInputElement,
            clearCB() {
                updateSearch(options.blockElement, options.protyle);
            }
        });
        if (isSearching) {
            (options.blockElement.querySelector('[data-type="av-search"]') as HTMLInputElement).focus();
        }
        options.blockElement.style.alignSelf = alignSelf;
        
        // Bind calendar events after rendering
        bindCalendarEvents(options.blockElement, options.protyle);
    });
};

const generateCalendarGrid = (view: any): string => {
    const currentDate = new Date(view.startDate);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    let gridHTML = '<div class="av__calendar-grid">';
    
    switch (view.viewType) {
        case 0: // 月视图
            gridHTML += generateMonthView(year, month, view);
            break;
        case 1: // 周视图
            gridHTML += generateWeekView(currentDate, view);
            break;
        case 2: // 日视图
            gridHTML += generateDayView(currentDate, view);
            break;
    }
    
    gridHTML += '</div>';
    return gridHTML;
};

const generateMonthView = (year: number, month: number, view: any): string => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = (firstDay.getDay() + 7 - view.firstDayOfWeek) % 7;
    
    let html = '<div class="av__calendar-month">';
    
    // 星期标题
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const adjustedWeekDays = [];
    for (let i = 0; i < 7; i++) {
        adjustedWeekDays.push(weekDays[(view.firstDayOfWeek + i) % 7]);
    }
    
    html += '<div class="av__calendar-weekdays">';
    adjustedWeekDays.forEach(day => {
        html += `<div class="av__calendar-weekday">${day}</div>`;
    });
    html += '</div>';
    
    // 日期网格
    html += '<div class="av__calendar-days">';
    
    // 空白天数（上个月）
    for (let i = 0; i < firstDayOfWeek; i++) {
        const prevDate = new Date(year, month, 1 - firstDayOfWeek + i);
        html += `<div class="av__calendar-day av__calendar-day--other-month" data-date="${prevDate.toISOString().split('T')[0]}">
            <div class="av__calendar-day-number">${prevDate.getDate()}</div>
        </div>`;
    }
    
    // 当月天数
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const currentDay = new Date(year, month, day);
        const isToday = isDateToday(currentDay);
        const dayEvents = getDayEvents(currentDay, view.events);
        
        html += `<div class="av__calendar-day${isToday ? ' av__calendar-day--today' : ''}" data-date="${currentDay.toISOString().split('T')[0]}">
            <div class="av__calendar-day-number">${day}</div>
            <div class="av__calendar-day-events">`;
        
        dayEvents.forEach(event => {
            html += `<div class="av__calendar-event" data-id="${event.id}" title="${escapeHtml(event.title)}">
                ${escapeHtml(event.title)}
            </div>`;
        });
        
        html += '</div></div>';
    }
    
    // 补充天数（下个月）
    const totalCells = Math.ceil((firstDayOfWeek + lastDay.getDate()) / 7) * 7;
    const remainingCells = totalCells - (firstDayOfWeek + lastDay.getDate());
    for (let i = 1; i <= remainingCells; i++) {
        const nextDate = new Date(year, month + 1, i);
        html += `<div class="av__calendar-day av__calendar-day--other-month" data-date="${nextDate.toISOString().split('T')[0]}">
            <div class="av__calendar-day-number">${i}</div>
        </div>`;
    }
    
    html += '</div></div>';
    return html;
};

const generateWeekView = (currentDate: Date, view: any): string => {
    /**
     * Respect user-defined firstDayOfWeek (0=Sunday-6=Saturday)
     */
    const firstDayOfWeek = typeof view.firstDayOfWeek === "number" ? view.firstDayOfWeek : 1; // default Monday

    // 计算本周第一天
    const startOfWeek = new Date(currentDate);
    const curDow = startOfWeek.getDay();
    const diffToFirst = (curDow - firstDayOfWeek + 7) % 7;
    startOfWeek.setDate(startOfWeek.getDate() - diffToFirst);

    // 周标题顺序
    const weekDayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const orderedNames: string[] = [];
    for (let i = 0; i < 7; i++) {
        orderedNames.push(weekDayNames[(firstDayOfWeek + i) % 7]);
    }

    let html = '<div class="av__calendar-week">';

    // Header
    html += '<div class="av__calendar-week-header">';
    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(startOfWeek);
        dayDate.setDate(startOfWeek.getDate() + i);

        const isToday = isDateToday(dayDate);
        const dayEvents = getDayEvents(dayDate, view.events);

        html += `<div class="av__calendar-week-day ${isToday ? 'av__calendar-week-day--today' : ''}">
            <div class="av__calendar-week-day-header">
                <div class="av__calendar-week-day-name">${orderedNames[i]}</div>
                <div class="av__calendar-week-day-number">${dayDate.getDate()}</div>
            </div>
            <div class="av__calendar-week-day-events" data-date="${dayDate.toISOString().split('T')[0]}">`;

        dayEvents.forEach(event => {
            const startTime = new Date(event.startTime);
            const timeStr = event.allDay ? '全天' : startTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
            html += `<div class="av__calendar-event av__calendar-event--week" data-id="${event.id}" title="${escapeHtml(event.title)}">
                <div class="av__calendar-event-time">${timeStr}</div>
                <div class="av__calendar-event-title">${escapeHtml(event.title)}</div>
            </div>`;
        });

        html += '</div></div>';
    }
    html += '</div>'; // close header

    // Time grid
    html += '<div class="av__calendar-week-grid">';
    for (let hour = 0; hour < 24; hour++) {
        html += `<div class="av__calendar-week-hour">
            <div class="av__calendar-week-hour-label">${hour.toString().padStart(2, '0')}:00</div>
            <div class="av__calendar-week-hour-content"></div>
        </div>`;
    }
    html += '</div>';

    html += '</div>';
    return html;
};

const generateDayView = (currentDate: Date, view: any): string => {
    const dayEvents = getDayEvents(currentDate, view.events);
    const isToday = isDateToday(currentDate);
    
    let html = '<div class="av__calendar-day-view">';
    
    // Day header
    html += `<div class="av__calendar-day-header ${isToday ? 'av__calendar-day-header--today' : ''}">
        <div class="av__calendar-day-name">${currentDate.toLocaleDateString('zh-CN', { weekday: 'long' })}</div>
        <div class="av__calendar-day-date">${currentDate.getDate()}</div>
        <div class="av__calendar-day-month">${currentDate.toLocaleDateString('zh-CN', { month: 'long', year: 'numeric' })}</div>
    </div>`;
    
    // Time slots
    html += '<div class="av__calendar-day-grid">';
    
    for (let hour = 0; hour < 24; hour++) {
        const hourEvents = dayEvents.filter(event => {
            if (event.allDay) return false;
            const eventHour = new Date(event.startTime).getHours();
            return eventHour === hour;
        });
        
        html += `<div class="av__calendar-day-hour" data-hour="${hour}">
            <div class="av__calendar-day-hour-label">${hour.toString().padStart(2, '0')}:00</div>
            <div class="av__calendar-day-hour-content" data-date="${currentDate.toISOString().split('T')[0]}" data-hour="${hour}">`;
        
        hourEvents.forEach(event => {
            const startTime = new Date(event.startTime);
            const endTime = new Date(event.endTime);
            const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60); // duration in minutes
            const height = Math.max(30, (duration / 60) * 60); // minimum 30px height
            
            html += `<div class="av__calendar-event av__calendar-event--day" 
                data-id="${event.id}" 
                style="height: ${height}px;" 
                title="${escapeHtml(event.title)}">
                <div class="av__calendar-event-time">
                    ${startTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} - 
                    ${endTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div class="av__calendar-event-title">${escapeHtml(event.title)}</div>
            </div>`;
        });
        
        html += '</div></div>';
    }
    
    // All-day events section
    const allDayEvents = dayEvents.filter(event => event.allDay);
    if (allDayEvents.length > 0) {
        html += '<div class="av__calendar-day-allday">';
        html += '<div class="av__calendar-day-allday-label">全天事件</div>';
        allDayEvents.forEach(event => {
            html += `<div class="av__calendar-event av__calendar-event--all-day" data-id="${event.id}" title="${escapeHtml(event.title)}">
                ${escapeHtml(event.title)}
            </div>`;
        });
        html += '</div>';
    }
    
    html += '</div></div>';
    return html;
};

const generateEventsList = (view: any): string => {
    let html = '<div class="av__calendar-events-list">';
    html += '<h3>事件列表</h3>';
    
    view.events.forEach((event: any) => {
        html += `<div class="av__calendar-event-item" data-id="${event.id}">
            <div class="av__calendar-event-title">${escapeHtml(event.title)}</div>
            <div class="av__calendar-event-time">
                ${event.allDay ? '全天' : new Date(event.startTime).toLocaleString()}
            </div>
        </div>`;
    });
    
    html += '</div>';
    return html;
};

const isDateToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
};

const getDayEvents = (date: Date, events: any[]): any[] => {
    if (!events || !Array.isArray(events)) return [];
    
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => {
        if (!event.startTime) return false;
        const eventDate = new Date(event.startTime).toISOString().split('T')[0];
        return eventDate === dateStr;
    });
};

// Performance optimization: Cache for date strings to avoid repeated calculations
const dateStringCache = new Map<string, string>();

const getDateString = (date: Date): string => {
    const timestamp = date.getTime();
    const cached = dateStringCache.get(timestamp.toString());
    if (cached) return cached;
    
    const dateStr = date.toISOString().split('T')[0];
    dateStringCache.set(timestamp.toString(), dateStr);
    
    // Clean cache if it gets too large
    if (dateStringCache.size > 1000) {
        const entries = Array.from(dateStringCache.entries());
        dateStringCache.clear();
        // Keep the most recent 500 entries
        entries.slice(-500).forEach(([key, value]) => {
            dateStringCache.set(key, value);
        });
    }
    
    return dateStr;
};

// Enhanced event filtering with performance optimization
const getOptimizedDayEvents = (date: Date, events: any[]): any[] => {
    if (!events || !Array.isArray(events)) return [];
    
    const dateStr = getDateString(date);
    return events.filter(event => {
        if (!event.startTime) return false;
        const eventDate = getDateString(new Date(event.startTime));
        return eventDate === dateStr;
    });
}; 
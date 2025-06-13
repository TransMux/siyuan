import {hasClosestBlock, hasClosestByClassName} from "../../../util/hasClosest";
import {transaction} from "../../../wysiwyg/transaction";
import {fetchPost} from "../../../../util/fetch";
import {showMessage} from "../../../../dialog/message";
import {Dialog} from "../../../../dialog";
import {escapeHtml} from "../../../../util/escape";
import {renderCalendar} from "./render";
import * as dayjs from "dayjs";
import {Constants} from "../../../../constants";

// Event editing dialog
export const openEventEditDialog = (options: {
    protyle: IProtyle,
    blockElement: HTMLElement,
    event?: any,
    date?: string,
    position?: { x: number, y: number }
}) => {
    const isNew = !options.event;
    const eventData = options.event || {
        title: "",
        startTime: options.date ? `${options.date}T09:00` : new Date().toISOString().slice(0, 16),
        endTime: options.date ? `${options.date}T10:00` : new Date(Date.now() + 3600000).toISOString().slice(0, 16),
        allDay: false,
        description: ""
    };

    const dialog = new Dialog({
        title: isNew ? "新建事件" : "编辑事件",
        content: `<div class="b3-dialog__content">
            <div class="fn__flex-column">
                <label class="fn__flex">
                    <span class="fn__size200">事件标题：</span>
                    <input id="eventTitle" class="b3-text-field fn__flex-1" value="${escapeHtml(eventData.title)}" placeholder="输入事件标题">
                </label>
                <div class="fn__hr"></div>
                <label class="fn__flex">
                    <span class="fn__size200">开始时间：</span>
                    <input id="eventStart" class="b3-text-field fn__flex-1" type="datetime-local" value="${eventData.startTime.slice(0, 16)}">
                </label>
                <div class="fn__hr"></div>
                <label class="fn__flex">
                    <span class="fn__size200">结束时间：</span>
                    <input id="eventEnd" class="b3-text-field fn__flex-1" type="datetime-local" value="${eventData.endTime.slice(0, 16)}">
                </label>
                <div class="fn__hr"></div>
                <label class="fn__flex">
                    <span class="fn__size200">全天事件：</span>
                    <input id="eventAllDay" type="checkbox" class="b3-switch" ${eventData.allDay ? 'checked' : ''}>
                </label>
                <div class="fn__hr"></div>
                <label class="fn__flex">
                    <span class="fn__size200">事件描述：</span>
                    <textarea id="eventDesc" class="b3-text-field fn__flex-1" placeholder="添加事件描述">${escapeHtml(eventData.description || "")}</textarea>
                </label>
            </div>
        </div>
        <div class="b3-dialog__action">
            ${!isNew ? `<button class="b3-button b3-button--error" data-type="delete">删除</button><div class="fn__space"></div>` : ''}
            <button class="b3-button b3-button--cancel">取消</button>
            <div class="fn__space"></div>
            <button class="b3-button b3-button--text">${isNew ? '创建' : '保存'}</button>
        </div>`,
        width: "520px",
    });

    const titleInput = dialog.element.querySelector("#eventTitle") as HTMLInputElement;
    const startInput = dialog.element.querySelector("#eventStart") as HTMLInputElement;
    const endInput = dialog.element.querySelector("#eventEnd") as HTMLInputElement;
    const allDayInput = dialog.element.querySelector("#eventAllDay") as HTMLInputElement;
    const descInput = dialog.element.querySelector("#eventDesc") as HTMLTextAreaElement;
    
    const buttons = dialog.element.querySelectorAll(".b3-button");
    
    // Position dialog near the click position if provided
    if (options.position) {
        dialog.element.style.position = "fixed";
        dialog.element.style.left = `${Math.min(options.position.x, window.innerWidth - 540)}px`;
        dialog.element.style.top = `${Math.min(options.position.y, window.innerHeight - 400)}px`;
    }

    // Handle all-day toggle
    allDayInput.addEventListener("change", () => {
        if (allDayInput.checked) {
            const startDate = startInput.value.split('T')[0];
            startInput.value = `${startDate}T00:00`;
            endInput.value = `${startDate}T23:59`;
        }
    });

    // Delete button (if editing)
    if (!isNew) {
        const deleteBtn = dialog.element.querySelector('[data-type="delete"]');
        deleteBtn?.addEventListener("click", () => {
            deleteEvent(options.protyle, options.blockElement, eventData.id);
            dialog.destroy();
        });
    }

    // Cancel button
    buttons[isNew ? 0 : 1]?.addEventListener("click", () => {
        dialog.destroy();
    });

    // Save button
    buttons[isNew ? 1 : 2]?.addEventListener("click", () => {
        const newEventData = {
            id: eventData.id || generateEventId(),
            title: titleInput.value.trim(),
            startTime: startInput.value,
            endTime: endInput.value,
            allDay: allDayInput.checked,
            description: descInput.value.trim()
        };

        if (!newEventData.title) {
            showMessage("请输入事件标题");
            titleInput.focus();
            return;
        }

        if (new Date(newEventData.startTime) >= new Date(newEventData.endTime)) {
            showMessage("结束时间必须晚于开始时间");
            endInput.focus();
            return;
        }

        if (isNew) {
            createEvent(options.protyle, options.blockElement, newEventData);
        } else {
            updateEvent(options.protyle, options.blockElement, newEventData);
        }
        
        dialog.destroy();
    });

    titleInput.focus();
    titleInput.select();
};

// Drag and drop functionality
export const initCalendarDragDrop = (blockElement: HTMLElement, protyle: IProtyle) => {
    let draggedEvent: HTMLElement | null = null;
    let draggedEventData: any = null;

    // Make events draggable
    blockElement.addEventListener("mousedown", (event: MouseEvent) => {
        const eventElement = hasClosestByClassName(event.target as HTMLElement, "av__calendar-event");
        if (eventElement) {
            eventElement.setAttribute("draggable", "true");
            draggedEvent = eventElement;
            draggedEventData = getEventDataFromElement(eventElement);
        }
    });

    blockElement.addEventListener("dragstart", (event: DragEvent) => {
        if (draggedEvent) {
            draggedEvent.classList.add("av__calendar-event--dragging");
            event.dataTransfer?.setData("text/plain", draggedEventData.id);
            event.dataTransfer!.effectAllowed = "move";
        }
    });

    blockElement.addEventListener("dragover", (event: DragEvent) => {
        event.preventDefault();
        const dayElement = hasClosestByClassName(event.target as HTMLElement, "av__calendar-day");
        if (dayElement && draggedEvent) {
            // Remove previous dragover states
            blockElement.querySelectorAll(".av__calendar-day.dragover").forEach(el => {
                el.classList.remove("dragover");
            });
            dayElement.classList.add("dragover");
        }
    });

    blockElement.addEventListener("dragleave", (event: DragEvent) => {
        const dayElement = hasClosestByClassName(event.target as HTMLElement, "av__calendar-day");
        if (dayElement && !dayElement.contains(event.relatedTarget as Node)) {
            dayElement.classList.remove("dragover");
        }
    });

    blockElement.addEventListener("drop", (event: DragEvent) => {
        event.preventDefault();
        const dayElement = hasClosestByClassName(event.target as HTMLElement, "av__calendar-day");
        
        if (dayElement && draggedEvent && draggedEventData) {
            const newDate = dayElement.getAttribute("data-date");
            if (newDate && newDate !== getCurrentEventDate(draggedEventData)) {
                moveEventToDate(protyle, blockElement, draggedEventData.id, newDate);
            }
        }

        // Cleanup
        blockElement.querySelectorAll(".av__calendar-day.dragover").forEach(el => {
            el.classList.remove("dragover");
        });
        if (draggedEvent) {
            draggedEvent.classList.remove("av__calendar-event--dragging");
            draggedEvent.removeAttribute("draggable");
        }
        draggedEvent = null;
        draggedEventData = null;
    });

    blockElement.addEventListener("dragend", () => {
        if (draggedEvent) {
            draggedEvent.classList.remove("av__calendar-event--dragging");
            draggedEvent.removeAttribute("draggable");
        }
        blockElement.querySelectorAll(".av__calendar-day.dragover").forEach(el => {
            el.classList.remove("dragover");
        });
        draggedEvent = null;
        draggedEventData = null;
    });
};

// Calendar navigation and view switching
export const bindCalendarEvents = (blockElement: HTMLElement, protyle: IProtyle) => {
    initCalendarDragDrop(blockElement, protyle);
    
    blockElement.addEventListener("click", (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        
        // Navigation buttons
        if (target.closest('[data-type="prev-period"]')) {
            navigatePeriod(blockElement, protyle, -1);
        } else if (target.closest('[data-type="next-period"]')) {
            navigatePeriod(blockElement, protyle, 1);
        } else if (target.closest('[data-type="today"]')) {
            navigateToToday(blockElement, protyle);
        }
        
        // View switching
        else if (target.closest('[data-type="month-view"]')) {
            switchCalendarView(blockElement, protyle, 0);
        } else if (target.closest('[data-type="week-view"]')) {
            switchCalendarView(blockElement, protyle, 1);
        } else if (target.closest('[data-type="day-view"]')) {
            switchCalendarView(blockElement, protyle, 2);
        }
        
        // Event creation - double click on day
        else if (target.closest('.av__calendar-day') && event.detail === 2) {
            const dayElement = target.closest('.av__calendar-day') as HTMLElement;
            const date = dayElement.getAttribute("data-date");
            if (date) {
                openEventEditDialog({
                    protyle,
                    blockElement,
                    date,
                    position: { x: event.clientX, y: event.clientY }
                });
            }
        }
        
        // Event editing - click on event
        else if (target.closest('.av__calendar-event')) {
            const eventElement = target.closest('.av__calendar-event') as HTMLElement;
            const eventData = getEventDataFromElement(eventElement);
            openEventEditDialog({
                protyle,
                blockElement,
                event: eventData,
                position: { x: event.clientX, y: event.clientY }
            });
        }
        
        // Add new event
        else if (target.closest('[data-type="av-add-bottom"]')) {
            openEventEditDialog({
                protyle,
                blockElement,
                position: { x: event.clientX, y: event.clientY }
            });
        }
    });
};

// Helper functions
const generateEventId = (): string => {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const getEventDataFromElement = (eventElement: HTMLElement): any => {
    return {
        id: eventElement.getAttribute("data-id"),
        title: eventElement.textContent?.trim() || "",
        // Add more properties as needed
    };
};

const getCurrentEventDate = (eventData: any): string => {
    return new Date(eventData.startTime).toISOString().split('T')[0];
};

const createEvent = (protyle: IProtyle, blockElement: HTMLElement, eventData: any) => {
    const avID = blockElement.getAttribute("data-av-id");
    
    fetchPost("/api/av/createCalendarEvent", {
        avID,
        event: eventData
    }, () => {
        showMessage("事件创建成功");
        renderCalendar({
            blockElement,
            protyle,
            renderAll: false
        });
    });
};

const updateEvent = (protyle: IProtyle, blockElement: HTMLElement, eventData: any) => {
    const avID = blockElement.getAttribute("data-av-id");
    
    fetchPost("/api/av/updateCalendarEvent", {
        avID,
        event: eventData
    }, () => {
        showMessage("事件更新成功");
        renderCalendar({
            blockElement,
            protyle,
            renderAll: false
        });
    });
};

const deleteEvent = (protyle: IProtyle, blockElement: HTMLElement, eventId: string) => {
    const avID = blockElement.getAttribute("data-av-id");
    
    fetchPost("/api/av/deleteCalendarEvent", {
        avID,
        eventId
    }, () => {
        showMessage("事件删除成功");
        renderCalendar({
            blockElement,
            protyle,
            renderAll: false
        });
    });
};

const moveEventToDate = (protyle: IProtyle, blockElement: HTMLElement, eventId: string, newDate: string) => {
    const avID = blockElement.getAttribute("data-av-id");
    
    fetchPost("/api/av/moveCalendarEvent", {
        avID,
        eventId,
        newDate
    }, () => {
        renderCalendar({
            blockElement,
            protyle,
            renderAll: false
        });
    });
};

const navigatePeriod = (blockElement: HTMLElement, protyle: IProtyle, direction: number) => {
    const avID = blockElement.getAttribute("data-av-id");
    const viewID = blockElement.getAttribute(Constants.CUSTOM_SY_AV_VIEW) || blockElement.getAttribute("data-view-id");
    
    fetchPost("/api/av/navigateCalendarPeriod", {
        avID,
        viewID,
        direction
    }, () => {
        renderCalendar({
            blockElement,
            protyle,
            renderAll: false
        });
    });
};

const navigateToToday = (blockElement: HTMLElement, protyle: IProtyle) => {
    const avID = blockElement.getAttribute("data-av-id");
    const viewID = blockElement.getAttribute(Constants.CUSTOM_SY_AV_VIEW) || blockElement.getAttribute("data-view-id");
    
    fetchPost("/api/av/navigateCalendarToToday", {
        avID,
        viewID
    }, () => {
        renderCalendar({
            blockElement,
            protyle,
            renderAll: false
        });
    });
};

const switchCalendarView = (blockElement: HTMLElement, protyle: IProtyle, viewType: number) => {
    const avID = blockElement.getAttribute("data-av-id");
    const viewID = blockElement.getAttribute(Constants.CUSTOM_SY_AV_VIEW) || blockElement.getAttribute("data-view-id");
    
    fetchPost("/api/av/switchCalendarView", {
        avID,
        viewID,
        viewType
    }, () => {
        renderCalendar({
            blockElement,
            protyle,
            renderAll: false
        });
    });
}; 
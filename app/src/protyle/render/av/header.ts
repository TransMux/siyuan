export interface AVHeaderOptions {
    tabHTML: string;
    viewsCount: number;
    isSearching: boolean;
    query: string;
    filtersActive: boolean;
    sortsActive: boolean;
}

export interface AVHeaderOptionsExtended extends AVHeaderOptions {
    /**
     * Optional HTML that will be inserted just before the closing tag of the flex row.
     * Useful for view-specific extra icons (e.g. gallery more/add-more, mirror indicator).
     */
    extraHTML?: string;
}

/**
 * Generate common header (views bar + search/filter/sort controls) for AV components.
 * Specific view renderers (table/gallery/calendar) can append extra icons after this block or wrap it
 * into their own <div class="av__header"> container together with title, etc.
 */
export const renderAVViewsBar = (opts: AVHeaderOptionsExtended): string => {
    const {
        tabHTML,
        viewsCount,
        isSearching,
        query,
        filtersActive,
        sortsActive,
        extraHTML = "",
    } = opts;

    return `<div class="fn__flex av__views${isSearching || query ? " av__views--show" : ""}">
        <div class="layout-tab-bar fn__flex">
            ${tabHTML}
        </div>
        <div class="fn__space"></div>
        <span data-type="av-add" class="block__icon ariaLabel" data-position="8south" aria-label="${window.siyuan.languages.newView}">
            <svg><use xlink:href="#iconAdd"></use></svg>
        </span>
        <div class="fn__flex-1"></div>
        <div class="fn__space"></div>
        <span data-type="av-switcher" class="block__icon${viewsCount > 0 ? "" : " fn__none"}">
            <svg><use xlink:href="#iconDown"></use></svg>
            <span class="fn__space"></span>
            <small>${viewsCount}</small>
        </span>
        <div class="fn__space"></div>
        <span data-type="av-filter" class="block__icon${filtersActive ? " block__icon--active" : ""}">
            <svg><use xlink:href="#iconFilter"></use></svg>
        </span>
        <div class="fn__space"></div>
        <span data-type="av-sort" class="block__icon${sortsActive ? " block__icon--active" : ""}">
            <svg><use xlink:href="#iconSort"></use></svg>
        </span>
        <div class="fn__space"></div>
        <button data-type="av-search-icon" class="block__icon">
            <svg><use xlink:href="#iconSearch"></use></svg>
        </button>
        <div style="position: relative" class="fn__flex">
            <input style="${isSearching || query ? "width:128px" : "width:0;padding-left: 0;padding-right: 0;"}" data-type="av-search" class="b3-text-field b3-text-field--text" placeholder="${window.siyuan.languages.search}" value="${query}">
        </div>
        ${extraHTML}
    </div>`;
}; 
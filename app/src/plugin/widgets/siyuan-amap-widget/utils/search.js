/* utils/search.js: search integration for AMap */

export function isWebEnv() {
    // SiYuan client exposes a global `window.siyuan`
    return !(typeof window !== 'undefined' && window.siyuan);
}

export function initPlaceSearch(map, options = {}) {
    if (!isWebEnv()) {
        console.debug('Search disabled in SiYuan environment.');
        return;
    }
    if (!map) {
        console.error('initPlaceSearch requires a valid AMap.Map instance');
        return;
    }

    // Ensure UI container exists
    let container = document.getElementById('searchContainer');
    container.id = 'searchContainer';
    container.innerHTML = `<input type="text" id="searchInput" placeholder="搜索地点..." style="width:140px;" /> <button id="searchBtn">搜索</button>`;

    const searchInput = container.querySelector('#searchInput');
    const searchBtn = container.querySelector('#searchBtn');

    let placeSearch;
    let searchOverlays = [];

    AMap.plugin('AMap.PlaceSearch', () => {
        placeSearch = new AMap.PlaceSearch({
            pageSize: 10,
            citylimit: false,
            ...options
        });
    });

    function doSearch() {
        const keyword = searchInput.value.trim();
        if (!keyword || !placeSearch) return;
        placeSearch.search(keyword, (status, result) => {
            if (status !== 'complete' || !result.poiList) return;
            // Clear previous
            if (searchOverlays.length) {
                map.remove(searchOverlays);
                searchOverlays = [];
            }
            const pois = result.poiList.pois;
            const markerData = pois.map(p => ({
                lng: p.location.lng,
                lat: p.location.lat,
                title: p.name,
            }));
            import('./siyuan.js').then(({addMarkers}) => {
                searchOverlays = addMarkers(map, markerData);
                if (searchOverlays.length) map.setFitView(searchOverlays);
            });
        });
    }

    searchBtn.addEventListener('click', doSearch);
    searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') doSearch();
    });
} 
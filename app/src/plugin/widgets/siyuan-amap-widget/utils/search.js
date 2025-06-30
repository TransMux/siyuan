/* utils/search.js: search integration for AMap */

import { addMarkers } from './siyuan.js';
import { drawIsochrone } from './isochrone.js';

export function isWebEnv() {
    // SiYuan client exposes a global `window.siyuan`
    return !(typeof window !== 'undefined' && window.siyuan);
}

export function initPlaceSearch(map, options = {}) {
    if (!isWebEnv() && !options.forceEnable) {
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
    container.innerHTML = `
        <div class="search-header">
            <input type="text" id="searchInput" placeholder="搜索地点..." />
            <button id="searchBtn">搜索</button>
            <button id="clearBtn">清空</button>
            <button id="backToNormalBtn" style="display:none">回到普通搜索</button>
        </div>
        <div id="nearbySearchInfo" style="display:none; margin: 4px 0; font-size: 12px; color: #666;">
            正在搜索 "<span id="selectedPointName"></span>" 周边
        </div>
        <ul id="searchResults"></ul>
        <div class="search-footer">
            <div>
                <button id="prevPageBtn">上一页</button>
                <span id="pageInfo">1/1</span>
                <button id="nextPageBtn">下一页</button>
            </div>
            <button id="addSelectedBtn">添加选中</button>
        </div>
    `;

    const searchInput = container.querySelector('#searchInput');
    const searchBtn = container.querySelector('#searchBtn');
    const clearBtn = container.querySelector('#clearBtn');
    const backToNormalBtn = container.querySelector('#backToNormalBtn');
    const nearbySearchInfo = container.querySelector('#nearbySearchInfo');
    const selectedPointName = container.querySelector('#selectedPointName');
    const prevPageBtn = container.querySelector('#prevPageBtn');
    const nextPageBtn = container.querySelector('#nextPageBtn');
    const pageInfo = container.querySelector('#pageInfo');
    const addSelectedBtn = container.querySelector('#addSelectedBtn');
    const resultsList = container.querySelector('#searchResults');
    const footer = container.querySelector('.search-footer');

    // Initially hide footer
    footer.style.display = 'none';

    let placeSearch;
    let searchOverlays = [];
    let selectedOverlays = [];
    let currentPois = [];
    let currentKeyword = '';
    let currentPage = 1;
    const pageSize = options.pageSize || 10;
    
    // 搜索模式状态
    let isNearbyMode = false;
    let selectedPoint = null;

    AMap.plugin('AMap.PlaceSearch', () => {
        placeSearch = new AMap.PlaceSearch({
            pageSize,
            citylimit: false,
            ...options
        });
        placeSearch.setPageSize(pageSize);
    });

    function renderResults(pois) {
        // Clear previous list
        resultsList.innerHTML = '';
        pois.forEach((poi, idx) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <label><input type="checkbox" data-idx="${idx}" /> ${poi.name}</label>
                <div class="poi-actions">
                    <button data-idx="${idx}" class="iso-btn">30分钟圈</button>
                    <button data-idx="${idx}" class="save-btn">保存到数据库</button>
                </div>
                <div class="poi-info">
                    <small>${poi.address || '无地址信息'}</small>
                </div>
            `;
            li.querySelector('label').addEventListener('click', (e) => {
                // ignore when clicking checkbox
                if (e.target.tagName.toLowerCase() !== 'input') {
                    map.setZoomAndCenter(16, searchOverlays[idx].getPosition());
                }
            });
            li.querySelector('.iso-btn').addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.idx, 10);
                const poi = currentPois[id];
                drawIsochrone(map, [poi.location.lng, poi.location.lat]);
                e.stopPropagation();
            });
            
            // 添加保存到数据库功能
            li.querySelector('.save-btn').addEventListener('click', async (e) => {
                const id = parseInt(e.currentTarget.dataset.idx, 10);
                const poi = currentPois[id];
                await savePoiToDatabase(poi);
                e.stopPropagation();
            });
            
            resultsList.appendChild(li);
        });
    }

    function updatePageControls(totalCount) {
        const totalPages = Math.ceil(totalCount / pageSize) || 1;
        pageInfo.textContent = `${currentPage}/${totalPages}`;
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
        addSelectedBtn.disabled = true;
        if (totalCount > 0) {
            footer.style.display = 'flex';
        } else {
            footer.style.display = 'none';
        }
    }

    function performSearch() {
        const keyword = searchInput.value.trim();
        if (!keyword || !placeSearch) return;
        currentKeyword = keyword;
        placeSearch.setPageIndex(currentPage - 1);
        
        if (isNearbyMode && selectedPoint) {
            // 周边搜索
            placeSearch.searchNearBy(keyword, [selectedPoint.lng, selectedPoint.lat], 5000, (status, result) => {
                if (status !== 'complete' || !result.poiList) return;
                handleSearchResults(result);
            });
        } else {
            // 普通搜索
            placeSearch.search(keyword, (status, result) => {
                if (status !== 'complete' || !result.poiList) return;
                handleSearchResults(result);
            });
        }
    }
    
    function handleSearchResults(result) {
        // Clear previous
        if (searchOverlays.length) {
            map.remove(searchOverlays);
            searchOverlays = [];
        }
        const pois = result.poiList.pois;
        currentPois = pois;

        const markerData = pois.map(p => ({
            lng: p.location.lng,
            lat: p.location.lat,
            title: p.name,
        }));
        import('./siyuan.js').then(({addMarkers}) => {
            searchOverlays = addMarkers(map, markerData);
            renderResults(pois);
            updatePageControls(result.poiList.count);

            if (searchOverlays.length) map.setFitView(searchOverlays);
        });
    }

    function clearSearch() {
        searchInput.value = '';
        resultsList.innerHTML = '';
        pageInfo.textContent = '';
        currentKeyword = '';
        currentPage = 1;
        map.remove(searchOverlays);
        searchOverlays = [];
        footer.style.display = 'none';
    }
    
    function switchToNearbyMode(point) {
        isNearbyMode = true;
        selectedPoint = point;
        selectedPointName.textContent = point.title;
        nearbySearchInfo.style.display = 'block';
        backToNormalBtn.style.display = 'inline-block';
        searchInput.placeholder = `搜索 "${point.title}" 周边...`;
        
        // 自动执行周边搜索（如果有关键词）
        if (currentKeyword) {
            currentPage = 1;
            performSearch();
        }
    }
    
    function switchToNormalMode() {
        isNearbyMode = false;
        selectedPoint = null;
        nearbySearchInfo.style.display = 'none';
        backToNormalBtn.style.display = 'none';
        searchInput.placeholder = '搜索地点...';
        
        // 如果有关键词，执行普通搜索
        if (currentKeyword) {
            currentPage = 1;
            performSearch();
        }
    }

    function addSelectedToMap() {
        const checked = resultsList.querySelectorAll('input[type="checkbox"]:checked');
        if (!checked.length) return;
        const selectedData = Array.from(checked).map(cb => {
            const idx = parseInt(cb.dataset.idx, 10);
            return currentPois[idx];
        });
        const markerData = selectedData.map(p => ({
            lng: p.location.lng,
            lat: p.location.lat,
            title: p.name,
        }));
        import('./siyuan.js').then(({addMarkers}) => {
            const newMarkers = addMarkers(map, markerData);
            selectedOverlays.push(...newMarkers);
            if (newMarkers.length) map.setFitView(selectedOverlays);
        });
    }

    // Event bindings
    searchBtn.addEventListener('click', () => { currentPage = 1; performSearch(); });
    searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') { currentPage = 1; performSearch(); }
    });

    clearBtn.addEventListener('click', clearSearch);
    backToNormalBtn.addEventListener('click', switchToNormalMode);

    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            performSearch();
        }
    });

    nextPageBtn.addEventListener('click', () => {
        currentPage++;
        performSearch();
    });

    addSelectedBtn.addEventListener('click', addSelectedToMap);

    // Enable addSelectedBtn when any checkbox toggled
    resultsList.addEventListener('change', () => {
        const anyChecked = resultsList.querySelector('input[type="checkbox"]:checked');
        addSelectedBtn.disabled = !anyChecked;
    });
    
    // 监听标记点点击事件
    window.addEventListener('markerClicked', (event) => {
        const point = event.detail;
        switchToNearbyMode(point);
    });
    
    // 保存POI到数据库
    async function savePoiToDatabase(poi) {
        try {
            // 导入数据库操作函数
            const { addMapDataToDatabase, getCurrentDatabase, addMapDataItem } = await import('./mapDatabase.js');
            
            const currentDb = getCurrentDatabase();
            if (!currentDb) {
                showSearchMessage('请先选择数据库', 'warning');
                return;
            }
            
            // 推断POI类型标签
            const tags = inferPoiTags(poi);
            
            const locationData = {
                name: poi.name,
                notes: poi.address || '',
                coordinates: [poi.location.lng, poi.location.lat],
                tags: tags
            };
            
            // 添加到数据库
            await addMapDataToDatabase(currentDb, locationData);
            
            // 添加到本地数据
            addMapDataItem(locationData);
            
            // 添加到地图
            const markerData = [{
                lng: poi.location.lng,
                lat: poi.location.lat,
                title: poi.name,
                notes: poi.address || '',
                tags: tags
            }];
            
            import('./siyuan.js').then(({addMarkers}) => {
                addMarkers(map, markerData);
            });
            
            showSearchMessage(`已保存 "${poi.name}" 到数据库`, 'success');
            
        } catch (error) {
            console.error('保存POI到数据库失败:', error);
            showSearchMessage('保存失败: ' + error.message, 'error');
        }
    }
    
    // 推断POI类型标签
    function inferPoiTags(poi) {
        const name = poi.name.toLowerCase();
        const address = (poi.address || '').toLowerCase();
        const type = (poi.type || '').toLowerCase();
        
        // 根据名称和类型推断标签
        if (name.includes('餐厅') || name.includes('酒店') || name.includes('饭店') || 
            name.includes('咖啡') || name.includes('茶') || type.includes('餐饮')) {
            return ['餐厅'];
        } else if (name.includes('酒店') || name.includes('宾馆') || name.includes('旅馆') || 
                   name.includes('民宿') || type.includes('住宿')) {
            return ['住宿'];
        } else if (name.includes('地铁') || name.includes('公交') || name.includes('车站') || 
                   name.includes('机场') || name.includes('火车') || type.includes('交通')) {
            return ['交通'];
        } else if (name.includes('商场') || name.includes('超市') || name.includes('购物') || 
                   name.includes('百货') || type.includes('购物')) {
            return ['购物'];
        } else if (name.includes('景区') || name.includes('公园') || name.includes('博物馆') || 
                   name.includes('寺庙') || name.includes('教堂') || type.includes('旅游')) {
            return ['景点'];
        } else {
            return ['其他'];
        }
    }
    
    // 显示搜索消息
    function showSearchMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = `search-message search-message-${type}`;
        messageEl.textContent = message;
        
        Object.assign(messageEl.style, {
            position: 'fixed',
            top: '70px',
            left: '20px',
            zIndex: '10001',
            padding: '8px 12px',
            borderRadius: '4px',
            color: 'white',
            fontSize: '12px',
            fontWeight: '500',
            maxWidth: '300px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
        });
        
        const colors = {
            success: '#4CAF50',
            error: '#F44336',
            warning: '#FF9800',
            info: '#2196F3'
        };
        messageEl.style.backgroundColor = colors[type] || colors.info;
        
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            messageEl.style.opacity = '0';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    document.body.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
    }
} 
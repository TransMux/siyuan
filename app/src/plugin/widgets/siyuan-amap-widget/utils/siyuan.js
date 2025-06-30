export function resolveAvId() {
    // 获取当前制定的数据库id，支持通过url参数或者html标签属性指定
    const params = new URLSearchParams(window.location.search);
    let id = params.get('av_id');
    if (id)
        return id;
    const roots = [document.documentElement, document.body];
    for (const el of roots) {
        if (el && el.hasAttribute('custom-av-id')) {
            id = el.getAttribute('custom-av-id');
            if (id)
                return id;
        }
    }
    return null;
}

export function addMarkers(map, markerData = []) {
    if (!map || !Array.isArray(markerData) || markerData.length === 0) return [];
    const markers = markerData.map(m => {
        const marker = new AMap.Marker({
            position: [m.lng, m.lat],
            title: m.title || '',
            ...m.options
        });
        
        // 存储额外数据
        marker.extData = {
            name: m.title || '未知地点',
            notes: m.notes || '',
            tags: m.tags || [],
            coordinates: [m.lng, m.lat],
            id: m.id || null,
            ...m.options?.extData
        };
        
        // 添加点击事件
        marker.on('click', function(e) {
            const position = marker.getPosition();
            const title = marker.getOptions().title || '未知地点';
            
            // 显示信息窗口
            showMarkerInfo(map, marker, e.lnglat);
            
            // 触发周边搜索事件
            const event = new CustomEvent('markerClicked', {
                detail: {
                    position: position,
                    title: title,
                    lng: position.lng,
                    lat: position.lat
                }
            });
            window.dispatchEvent(event);
        });
        
        return marker;
    });
    map.add(markers);
    return markers;
}

export function addPolygons(map, polygonData = []) {
    if (!map || !Array.isArray(polygonData) || polygonData.length === 0) return [];
    const polygons = polygonData.map(p => {
        const polygon = new AMap.Polygon({
            path: p.path, // Array of [lng, lat]
            strokeColor: p.strokeColor || '#FF33FF',
            strokeWeight: p.strokeWeight || 2,
            fillColor: p.fillColor || '#FFC0CB',
            fillOpacity: p.fillOpacity ?? 0.35,
            ...p.options
        });
        
        // 存储额外数据
        polygon.extData = {
            name: p.name || '未命名区域',
            notes: p.notes || '',
            tags: p.tags || [],
            coordinates: p.path,
            id: p.id || null,
            ...p.options?.extData
        };
        
        // 添加点击事件
        polygon.on('click', function(e) {
            showPolygonInfo(map, polygon, e.lnglat);
        });
        
        return polygon;
    });
    map.add(polygons);
    return polygons;
}

/**
 * 显示标记点信息窗口
 * @param {object} map 地图实例
 * @param {object} marker 标记点
 * @param {object} lnglat 点击位置
 */
function showMarkerInfo(map, marker, lnglat) {
    const data = marker.extData || {};
    const tagsHtml = data.tags && data.tags.length > 0 
        ? `<div class="marker-tags">
             ${data.tags.map(tag => `<span class="tag tag-${tag}">${tag}</span>`).join('')}
           </div>` 
        : '';
    
    const content = `
        <div class="marker-info-window">
            <div class="marker-header">
                <h4>${data.name}</h4>
                <button class="delete-marker-btn" title="删除标记点">×</button>
            </div>
            ${data.notes ? `<p class="marker-notes">${data.notes}</p>` : ''}
            ${tagsHtml}
            <div class="marker-coordinates">
                <small>坐标: ${data.coordinates[0].toFixed(6)}, ${data.coordinates[1].toFixed(6)}</small>
            </div>
            <div class="marker-actions">
                <button class="edit-marker-btn">编辑</button>
                <button class="nearby-search-btn">周边搜索</button>
            </div>
        </div>
    `;
    
    const infoWindow = new AMap.InfoWindow({
        content,
        offset: new AMap.Pixel(0, -30)
    });
    
    infoWindow.open(map, lnglat);
    
    // 绑定事件
    setTimeout(() => {
        const deleteBtn = document.querySelector('.delete-marker-btn');
        const editBtn = document.querySelector('.edit-marker-btn');
        const nearbyBtn = document.querySelector('.nearby-search-btn');
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm(`确定删除标记点 "${data.name}" 吗？`)) {
                    deleteMarker(map, marker);
                    infoWindow.close();
                }
            });
        }
        
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                editMarker(marker);
                infoWindow.close();
            });
        }
        
        if (nearbyBtn) {
            nearbyBtn.addEventListener('click', () => {
                const event = new CustomEvent('markerClicked', {
                    detail: {
                        position: marker.getPosition(),
                        title: data.name,
                        lng: data.coordinates[0],
                        lat: data.coordinates[1]
                    }
                });
                window.dispatchEvent(event);
                infoWindow.close();
            });
        }
    }, 100);
}

/**
 * 显示多边形信息窗口
 * @param {object} map 地图实例
 * @param {object} polygon 多边形
 * @param {object} lnglat 点击位置
 */
function showPolygonInfo(map, polygon, lnglat) {
    const data = polygon.extData || {};
    const tagsHtml = data.tags && data.tags.length > 0 
        ? `<div class="polygon-tags">
             ${data.tags.map(tag => `<span class="tag tag-${tag}">${tag}</span>`).join('')}
           </div>` 
        : '';
    
    const pointCount = data.coordinates ? data.coordinates.length : 0;
    
    const content = `
        <div class="polygon-info-window">
            <div class="polygon-header">
                <h4>${data.name}</h4>
                <button class="delete-polygon-btn" title="删除多边形">×</button>
            </div>
            ${data.notes ? `<p class="polygon-notes">${data.notes}</p>` : ''}
            ${tagsHtml}
            <div class="polygon-info">
                <small>顶点数: ${pointCount}</small>
            </div>
            <div class="polygon-actions">
                <button class="edit-polygon-btn">编辑</button>
                <button class="show-bounds-btn">显示边界</button>
            </div>
        </div>
    `;
    
    const infoWindow = new AMap.InfoWindow({
        content,
        offset: new AMap.Pixel(0, -30)
    });
    
    infoWindow.open(map, lnglat);
    
    // 绑定事件
    setTimeout(() => {
        const deleteBtn = document.querySelector('.delete-polygon-btn');
        const editBtn = document.querySelector('.edit-polygon-btn');
        const boundsBtn = document.querySelector('.show-bounds-btn');
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm(`确定删除多边形 "${data.name}" 吗？`)) {
                    deletePolygon(map, polygon);
                    infoWindow.close();
                }
            });
        }
        
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                editPolygon(polygon);
                infoWindow.close();
            });
        }
        
        if (boundsBtn) {
            boundsBtn.addEventListener('click', () => {
                map.setFitView([polygon]);
                infoWindow.close();
            });
        }
    }, 100);
}

/**
 * 删除标记点
 * @param {object} map 地图实例
 * @param {object} marker 标记点
 */
async function deleteMarker(map, marker) {
    try {
        // 从地图移除
        map.remove(marker);
        
        // 从数据库删除（如果有ID）
        const data = marker.extData || {};
        if (data.id) {
            const { deleteMapDataFromDatabase, getCurrentDatabase } = await import('./mapDatabase.js');
            const currentDb = getCurrentDatabase();
            if (currentDb) {
                await deleteMapDataFromDatabase(currentDb, [data.id]);
            }
        }
        
        // 更新统计
        window.dispatchEvent(new CustomEvent('mapDataChanged'));
        
        showMessage(`已删除标记点 "${data.name}"`, 'success');
    } catch (error) {
        console.error('删除标记点失败:', error);
        showMessage('删除失败: ' + error.message, 'error');
    }
}

/**
 * 删除多边形
 * @param {object} map 地图实例
 * @param {object} polygon 多边形
 */
async function deletePolygon(map, polygon) {
    try {
        // 从地图移除
        map.remove(polygon);
        
        // 从数据库删除（如果有ID）
        const data = polygon.extData || {};
        if (data.id) {
            const { deleteMapDataFromDatabase, getCurrentDatabase } = await import('./mapDatabase.js');
            const currentDb = getCurrentDatabase();
            if (currentDb) {
                await deleteMapDataFromDatabase(currentDb, [data.id]);
            }
        }
        
        // 更新统计
        window.dispatchEvent(new CustomEvent('mapDataChanged'));
        
        showMessage(`已删除多边形 "${data.name}"`, 'success');
    } catch (error) {
        console.error('删除多边形失败:', error);
        showMessage('删除失败: ' + error.message, 'error');
    }
}

/**
 * 编辑标记点
 * @param {object} marker 标记点
 */
function editMarker(marker) {
    const data = marker.extData || {};
    
    // 填充表单
    const nameInput = document.getElementById('locationName');
    const notesInput = document.getElementById('locationNotes');
    const coordsInput = document.getElementById('locationCoords');
    
    if (nameInput) nameInput.value = data.name || '';
    if (notesInput) notesInput.value = data.notes || '';
    if (coordsInput) coordsInput.value = JSON.stringify(data.coordinates);
    
    // 设置标签
    const tagCheckboxes = document.querySelectorAll('.tag-selector input[type="checkbox"]');
    tagCheckboxes.forEach(cb => {
        cb.checked = data.tags && data.tags.includes(cb.value);
    });
    
    // 展开数据库面板
    const panel = document.getElementById('databasePanel');
    if (panel && panel.classList.contains('collapsed')) {
        panel.classList.remove('collapsed');
    }
    
    // 滚动到表单
    const form = document.getElementById('addLocationForm');
    if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    showMessage('标记点信息已填入表单，可进行编辑', 'info');
}

/**
 * 编辑多边形
 * @param {object} polygon 多边形
 */
function editPolygon(polygon) {
    const data = polygon.extData || {};
    
    // 填充表单
    const nameInput = document.getElementById('locationName');
    const notesInput = document.getElementById('locationNotes');
    const coordsInput = document.getElementById('locationCoords');
    
    if (nameInput) nameInput.value = data.name || '';
    if (notesInput) notesInput.value = data.notes || '';
    if (coordsInput) coordsInput.value = JSON.stringify(data.coordinates);
    
    // 设置标签
    const tagCheckboxes = document.querySelectorAll('.tag-selector input[type="checkbox"]');
    tagCheckboxes.forEach(cb => {
        cb.checked = data.tags && data.tags.includes(cb.value);
    });
    
    // 展开数据库面板
    const panel = document.getElementById('databasePanel');
    if (panel && panel.classList.contains('collapsed')) {
        panel.classList.remove('collapsed');
    }
    
    // 滚动到表单
    const form = document.getElementById('addLocationForm');
    if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    showMessage('多边形信息已填入表单，可进行编辑', 'info');
}

/**
 * 显示消息
 * @param {string} message 消息内容
 * @param {string} type 消息类型
 */
function showMessage(message, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${type}`;
    messageEl.textContent = message;
    
    Object.assign(messageEl.style, {
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '10000',
        padding: '12px 20px',
        borderRadius: '6px',
        color: 'white',
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        transition: 'all 0.3s ease'
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
        messageEl.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => {
            if (messageEl.parentNode) {
                document.body.removeChild(messageEl);
            }
        }, 300);
    }, 3000);
} 
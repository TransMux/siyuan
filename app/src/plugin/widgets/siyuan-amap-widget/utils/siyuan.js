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
        
        // 添加点击事件，触发周边搜索
        marker.on('click', function(e) {
            const position = marker.getPosition();
            const title = marker.getOptions().title || '未知地点';
            
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
    const polygons = polygonData.map(p => new AMap.Polygon({
        path: p.path, // Array of [lng, lat]
        strokeColor: p.strokeColor || '#FF33FF',
        strokeWeight: p.strokeWeight || 2,
        fillColor: p.fillColor || '#FFC0CB',
        fillOpacity: p.fillOpacity ?? 0.35,
        ...p.options
    }));
    map.add(polygons);
    return polygons;
} 
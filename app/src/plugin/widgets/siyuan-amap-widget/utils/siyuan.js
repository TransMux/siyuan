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
    const markers = markerData.map(m => new AMap.Marker({
        position: [m.lng, m.lat],
        title: m.title || '',
        ...m.options
    }));
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
import { addPolygons } from './siyuan.js';

const AMAP_KEY = '96c22bea781373e30fca84e8aa3a3dde'; // TODO: read from global config

/**
 * Fetch 30-minute car isochrone (等时圈) polygon path around origin.
 * @param {number[]} origin [lng, lat]
 * @param {number} rangeSec range in seconds (default 1800 = 30min)
 * @returns {Promise<Array<Array<number>>>} polygon path array
 */
export async function fetchIsochrone(origin, rangeSec = 1800) {
    const [lng, lat] = origin;
    const params = new URLSearchParams({
        key: AMAP_KEY,
        origin: `${lng},${lat}`,
        range: String(rangeSec),
        range_type: 'time',
        direction: 'driving',
    });
    const url = `https://restapi.amap.com/v4/isoline?${params.toString()}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (json.errcode !== 0 && json.infocode && json.infocode !== '10000') {
        throw new Error(json.info || 'Isoline API error');
    }
    const polygons = json.data?.polygons;
    if (!polygons || !polygons.length) throw new Error('No isoline path');
    const pathStr = polygons[0].polyline || polygons[0].path || polygons[0].coordinates || polygons[0].shape;
    const coords = pathStr.split(';').map(pt => pt.split(',').map(Number));
    return coords;
}

/**
 * Draw isochrone polygon on map
 * @param {AMap.Map} map
 * @param {number[]} origin
 */
export async function drawIsochrone(map, origin) {
    try {
        const path = await fetchIsochrone(origin);
        addPolygons(map, [{
            path,
            strokeColor: '#FF5722',
            fillColor: 'rgba(255,87,34,0.3)',
            strokeWeight: 2,
        }]);
        map.setFitView();
    } catch (err) {
        console.error('Isochrone error', err);
    }
} 
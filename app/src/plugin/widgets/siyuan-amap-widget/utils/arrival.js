/**
 * Transit arrival range utility using AMap.ArrivalRange
 */

let arrivalRange = null;
let polygons = [];
let centerMarker = null;

/**
 * Add center marker at position
 * @param {AMap.Map} map 
 * @param {number[]} position [lng, lat]
 */
function addCenterMarker(map, position) {
    if (!centerMarker) {
        centerMarker = new AMap.Marker({
            map: map,
            position: position,
            icon: new AMap.Icon({
                size: new AMap.Size(25, 34),
                image: '//a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-default.png',
                imageOffset: new AMap.Pixel(0, 0),
                imageSize: new AMap.Size(25, 34)
            })
        });
    } else {
        centerMarker.setPosition(position);
    }
}

/**
 * Draw transit arrival range on map
 * @param {AMap.Map} map 
 * @param {number[]} origin [lng, lat]
 * @param {number} timeMinutes time in minutes (default 30)
 * @param {string} policy transit policy (default "SUBWAY,BUS")
 */
export function drawTransitArrival(map, origin, timeMinutes = 30, policy = "SUBWAY,BUS") {
    try {
        if (!arrivalRange) {
            arrivalRange = new AMap.ArrivalRange();
        }

        // Clear previous polygons
        if (polygons.length > 0) {
            map.remove(polygons);
            polygons = [];
        }

        // Add center marker
        addCenterMarker(map, origin);

        // Search arrival range
        arrivalRange.search(origin, timeMinutes, function(status, result) {
            if ((result.info === 'OK' || status === 'complete') && result.bounds && result.bounds.length > 0) {
                for (let i = 0; i < result.bounds.length; i++) {
                    const polygon = new AMap.Polygon({
                        fillColor: "#3366FF",
                        fillOpacity: 0.4,
                        strokeColor: "#00FF00", 
                        strokeOpacity: 0.5,
                        strokeWeight: 1
                    });
                    polygon.setPath(result.bounds[i]);
                    polygons.push(polygon);
                }
                map.add(polygons);
                map.setFitView();
                console.log(`Public transit ${timeMinutes}-minute arrival range drawn successfully`);
            } else {
                console.warn('No arrival range data found', result);
            }
        }, {
            policy: policy
        });

    } catch (err) {
        console.error('Transit arrival range error:', err);
    }
}

/**
 * Clear all arrival range polygons
 * @param {AMap.Map} map 
 */
export function clearArrivalRange(map) {
    if (polygons.length > 0) {
        map.remove(polygons);
        polygons = [];
    }
    if (centerMarker) {
        map.remove(centerMarker);
        centerMarker = null;
    }
} 
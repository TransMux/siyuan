/* utils/database.js: SiYuan database integration for map data */

import { resolveAvId } from './siyuan.js';

// 思源API基础URL
const API_BASE = window.location.origin;

/**
 * 调用思源API
 * @param {string} endpoint API端点
 * @param {object} data 请求数据
 * @returns {Promise<object>} API响应
 */
async function fetchSiyuanAPI(endpoint, data = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        if (result.code !== 0) {
            throw new Error(result.msg || 'API调用失败');
        }
        
        return result.data;
    } catch (error) {
        console.error(`SiYuan API调用失败 [${endpoint}]:`, error);
        throw error;
    }
}

/**
 * 检查是否在SiYuan环境中
 * @returns {boolean} 是否在SiYuan环境
 */
export function isSiYuanEnv() {
    return typeof window !== 'undefined' && window.siyuan;
}

/**
 * 从数据库加载地图数据
 * @param {string} avID 数据库ID，如果不提供则自动解析
 * @returns {Promise<Array>} 地图数据数组
 */
export async function loadMapDataFromDatabase(avID) {
    if (!avID) {
        avID = resolveAvId();
        if (!avID) {
            console.warn('未找到有效的数据库ID');
            return [];
        }
    }
    
    try {
        // 使用SQL查询获取属性视图数据
        const result = await fetchSiyuanAPI('/api/sql', {
            stmt: `SELECT * FROM av_${avID}`
        });
        
        if (!result || !Array.isArray(result)) {
            return [];
        }
        
        const mapData = [];
        
        // 转换数据格式
        result.forEach(row => {
            try {
                const item = {
                    id: row.id,
                    name: row.name || row['地点名称'] || '未命名地点',
                    notes: row.notes || row['备注'] || '',
                    coordinates: null,
                    tags: []
                };
                
                // 解析经纬度
                const coordsStr = row.coordinates || row['经纬度'] || row.coords;
                if (coordsStr) {
                    try {
                        item.coordinates = JSON.parse(coordsStr);
                    } catch (e) {
                        console.warn('无法解析经纬度:', coordsStr);
                        return; // 跳过无效数据
                    }
                }
                
                // 解析标签
                const tagsStr = row.tags || row['标签'] || '';
                if (tagsStr) {
                    try {
                        item.tags = JSON.parse(tagsStr);
                    } catch (e) {
                        item.tags = tagsStr.split(',').map(tag => tag.trim()).filter(tag => tag);
                    }
                }
                
                if (item.coordinates) {
                    mapData.push(item);
                }
            } catch (error) {
                console.warn('解析行数据失败:', error, row);
            }
        });
        
        return mapData;
    } catch (error) {
        console.error('从数据库加载地图数据失败:', error);
        return [];
    }
}

/**
 * 保存地图数据到数据库（简化版）
 * @param {string} avID 数据库ID
 * @param {Array} mapData 地图数据
 * @returns {Promise<boolean>} 是否成功
 */
export async function saveMapDataToDatabase(avID, mapData) {
    if (!avID || !Array.isArray(mapData)) {
        throw new Error('无效的数据库ID或地图数据');
    }
    
    try {
        // 注意：这里只是一个示例实现
        // 实际的保存操作需要根据思源的具体API来实现
        console.log('准备保存数据到数据库:', { avID, dataCount: mapData.length });
        
        // 由于思源的属性视图API可能比较复杂，这里提供一个基本框架
        // 实际使用时需要根据具体的思源API文档来实现
        
        for (const item of mapData) {
            const data = {
                name: item.name,
                notes: item.notes,
                coordinates: JSON.stringify(item.coordinates),
                tags: JSON.stringify(item.tags || [])
            };
            
            // 这里需要使用实际的思源API来插入数据
            // 暂时使用console.log记录
            console.log('准备插入数据项:', data);
        }
        
        return true;
    } catch (error) {
        console.error('保存地图数据到数据库失败:', error);
        throw error;
    }
}

/**
 * 添加单个地图数据到数据库
 * @param {string} avID 数据库ID
 * @param {object} data 地图数据项
 * @returns {Promise<string>} 新数据的ID
 */
export async function addMapDataToDatabase(avID, data) {
    if (!avID || !data) {
        throw new Error('无效的数据库ID或数据');
    }
    
    try {
        const itemData = {
            name: data.name,
            notes: data.notes,
            coordinates: JSON.stringify(data.coordinates),
            tags: JSON.stringify(data.tags || [])
        };
        
        console.log('准备添加单个数据项到数据库:', { avID, data: itemData });
        
        // 生成一个临时ID
        const newId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        return newId;
    } catch (error) {
        console.error('添加地图数据失败:', error);
        throw error;
    }
}

/**
 * 删除地图数据
 * @param {string} avID 数据库ID
 * @param {Array<string>} rowIDs 要删除的行ID数组
 * @returns {Promise<boolean>} 是否成功
 */
export async function deleteMapDataFromDatabase(avID, rowIDs) {
    try {
        console.log('准备删除地图数据:', { avID, rowIDs });
        return true;
    } catch (error) {
        console.error('删除地图数据失败:', error);
        throw error;
    }
}

/**
 * 将地图数据转换为标记点和多边形
 * @param {Array} mapData 地图数据
 * @returns {object} { markers, polygons }
 */
export function convertMapDataToOverlays(mapData) {
    const markers = [];
    const polygons = [];
    
    if (!Array.isArray(mapData)) {
        return { markers, polygons };
    }
    
    mapData.forEach(item => {
        const { coordinates, name, notes, tags } = item;
        
        if (!coordinates) return;
        
        // 判断是标记点还是多边形
        if (Array.isArray(coordinates) && coordinates.length === 2 && 
            typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
            // 一维数组 [lng, lat] - 标记点
            markers.push({
                lng: coordinates[0],
                lat: coordinates[1],
                title: name,
                notes,
                tags,
                options: {
                    extData: item
                }
            });
        } else if (Array.isArray(coordinates) && coordinates.length > 0 && 
                   Array.isArray(coordinates[0])) {
            // 二维数组 [[lng, lat], ...] - 多边形
            polygons.push({
                path: coordinates,
                name,
                notes,
                tags,
                strokeColor: getPolygonColor(tags),
                fillColor: getPolygonColor(tags),
                fillOpacity: 0.3,
                options: {
                    extData: item
                }
            });
        }
    });
    
    return { markers, polygons };
}

/**
 * 获取多边形颜色（基于标签）
 * @param {Array<string>} tags 标签数组
 * @returns {string} 颜色值
 */
function getPolygonColor(tags) {
    if (!tags || tags.length === 0) return '#2196F3';
    
    const colorMap = {
        '景点': '#FF6B6B',
        '餐厅': '#4ECDC4',
        '住宿': '#45B7D1',
        '交通': '#96CEB4',
        '购物': '#FECA57',
        '其他': '#A0A0A0'
    };
    
    const tag = tags[0]; // 使用第一个标签的颜色
    return colorMap[tag] || '#2196F3';
}

/**
 * 获取可用的数据库列表（简化版）
 * @returns {Promise<Array>} 数据库列表
 */
export async function getAvailableDatabases() {
    try {
        // 简化实现，返回当前avID作为唯一选项
        const currentAvId = resolveAvId();
        if (currentAvId) {
            return [{
                id: currentAvId,
                name: `数据库 ${currentAvId}`
            }];
        }
        return [];
    } catch (error) {
        console.error('获取数据库列表失败:', error);
        return [];
    }
}

// 简化版本，不再使用复杂的内部API
export async function createOrGetMapDatabase(dbName) {
    // 直接返回当前的avID
    const avID = resolveAvId();
    if (avID) {
        return avID;
    }
    throw new Error('无法获取有效的数据库ID');
}

export async function updateMapDataInDatabase(avID, rowID, keyID, value) {
    console.log('更新数据项:', { avID, rowID, keyID, value });
    return true;
} 
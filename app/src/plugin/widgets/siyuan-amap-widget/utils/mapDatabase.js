/* utils/mapDatabase.js: Map database integration UI and functionality */

import { 
    createOrGetMapDatabase, 
    loadMapDataFromDatabase, 
    saveMapDataToDatabase, 
    addMapDataToDatabase,
    deleteMapDataFromDatabase,
    convertMapDataToOverlays,
    isSiYuanEnv,
    getAvailableDatabases
} from './database.js';
import { addMarkers } from './siyuan.js';

// 全局状态
let currentDatabase = null;
let mapOverlays = {
    markers: [],
    polygons: []
};
let mapData = [];

/**
 * 初始化地图数据库功能
 * @param {object} map 地图实例
 */
export function initMapDatabase(map) {
    if (!map) {
        console.error('Map instance is required');
        return;
    }

    const databasePanel = document.getElementById('databasePanel');
    if (!databasePanel) {
        console.error('Database panel not found');
        return;
    }

    // 初始化UI事件
    setupDatabaseUI(map);
    
    // 如果在SiYuan环境中，加载可用数据库
    if (isSiYuanEnv()) {
        loadAvailableDatabases();
    } else {
        // Web环境下隐藏数据库功能
        databasePanel.style.display = 'none';
    }
}

/**
 * 设置数据库UI事件
 * @param {object} map 地图实例
 */
function setupDatabaseUI(map) {
    // 面板折叠/展开
    const toggleBtn = document.getElementById('toggleDatabaseBtn');
    const databasePanel = document.getElementById('databasePanel');
    
    toggleBtn?.addEventListener('click', () => {
        databasePanel.classList.toggle('collapsed');
    });

    // 数据库选择
    const databaseSelect = document.getElementById('databaseSelect');
    databaseSelect?.addEventListener('change', (e) => {
        currentDatabase = e.target.value;
        updateButtonStates();
        updateDataStats();
    });

    // 创建新数据库
    const createDbBtn = document.getElementById('createDatabaseBtn');
    createDbBtn?.addEventListener('click', async () => {
        const dbName = prompt('请输入数据库名称:', '地图数据');
        if (dbName) {
            try {
                const avID = await createOrGetMapDatabase(dbName);
                currentDatabase = avID;
                await loadAvailableDatabases();
                databaseSelect.value = avID;
                updateButtonStates();
                showMessage('数据库创建成功', 'success');
            } catch (error) {
                showMessage('创建数据库失败: ' + error.message, 'error');
            }
        }
    });

    // 加载数据
    const loadDataBtn = document.getElementById('loadDataBtn');
    loadDataBtn?.addEventListener('click', async () => {
        if (!currentDatabase) {
            showMessage('请先选择数据库', 'warning');
            return;
        }
        
        try {
            await loadMapData(map);
            showMessage('数据加载成功', 'success');
        } catch (error) {
            showMessage('加载数据失败: ' + error.message, 'error');
        }
    });

    // 保存数据
    const saveDataBtn = document.getElementById('saveDataBtn');
    saveDataBtn?.addEventListener('click', async () => {
        if (!currentDatabase) {
            showMessage('请先选择数据库', 'warning');
            return;
        }
        
        if (mapData.length === 0) {
            showMessage('没有数据需要保存', 'warning');
            return;
        }
        
        try {
            await saveMapDataToDatabase(currentDatabase, mapData);
            showMessage('数据保存成功', 'success');
            updateDataStats();
        } catch (error) {
            showMessage('保存数据失败: ' + error.message, 'error');
        }
    });

    // 清空地图
    const clearMapBtn = document.getElementById('clearMapBtn');
    clearMapBtn?.addEventListener('click', () => {
        if (confirm('确定要清空地图上的所有数据吗？')) {
            clearMapOverlays(map);
            mapData = [];
            updateDataStats();
            showMessage('地图已清空', 'info');
        }
    });

    // 添加地点表单
    const addLocationForm = document.getElementById('addLocationForm');
    addLocationForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleAddLocation(map);
    });

    // 更新初始状态
    updateButtonStates();
    
    // 监听地图数据变化事件
    window.addEventListener('mapDataChanged', () => {
        updateDataStats();
    });
}

/**
 * 加载可用数据库列表
 */
async function loadAvailableDatabases() {
    try {
        const databases = await getAvailableDatabases();
        const databaseSelect = document.getElementById('databaseSelect');
        
        if (!databaseSelect) return;
        
        // 清空现有选项
        databaseSelect.innerHTML = '<option value="">请选择数据库...</option>';
        
        // 添加数据库选项
        databases.forEach(db => {
            const option = document.createElement('option');
            option.value = db.id;
            option.textContent = db.name || `数据库 ${db.id}`;
            databaseSelect.appendChild(option);
        });
        
        // 如果有数据库，默认选择第一个
        if (databases.length > 0 && !currentDatabase) {
            currentDatabase = databases[0].id;
            databaseSelect.value = currentDatabase;
            updateButtonStates();
        }
        
    } catch (error) {
        console.error('加载数据库列表失败:', error);
        showMessage('加载数据库列表失败', 'error');
    }
}

/**
 * 从数据库加载地图数据
 * @param {object} map 地图实例
 */
async function loadMapData(map) {
    try {
        const data = await loadMapDataFromDatabase(currentDatabase);
        mapData = data;
        
        // 清空现有覆盖物
        clearMapOverlays(map);
        
        // 转换数据为地图覆盖物
        const { markers, polygons } = convertMapDataToOverlays(data);
        
        // 添加标记点
        if (markers.length > 0) {
            mapOverlays.markers = addMarkers(map, markers);
        }
        
        // 添加多边形
        if (polygons.length > 0) {
            const { addPolygons } = await import('./siyuan.js');
            mapOverlays.polygons = addPolygons(map, polygons);
        }
        
        // 自动适应视野
        if (mapOverlays.markers.length > 0 || mapOverlays.polygons.length > 0) {
            const allOverlays = [...mapOverlays.markers, ...mapOverlays.polygons];
            map.setFitView(allOverlays);
        }
        
        updateDataStats();
        
    } catch (error) {
        console.error('加载地图数据失败:', error);
        throw error;
    }
}

/**
 * 处理添加地点表单提交
 * @param {object} map 地图实例
 */
async function handleAddLocation(map) {
    const nameInput = document.getElementById('locationName');
    const notesInput = document.getElementById('locationNotes');
    const coordsInput = document.getElementById('locationCoords');
    const tagCheckboxes = document.querySelectorAll('.tag-selector input[type="checkbox"]:checked');
    
    const name = nameInput.value.trim();
    const notes = notesInput.value.trim();
    const coordsStr = coordsInput.value.trim();
    const tags = Array.from(tagCheckboxes).map(cb => cb.value);
    
    if (!name || !coordsStr) {
        showMessage('请填写地点名称和经纬度', 'warning');
        return;
    }
    
    try {
        // 解析经纬度
        const coordinates = JSON.parse(coordsStr);
        
        // 验证坐标格式
        if (!validateCoordinates(coordinates)) {
            showMessage('经纬度格式不正确', 'error');
            return;
        }
        
        const locationData = {
            name,
            notes,
            coordinates,
            tags
        };
        
        // 添加到地图数据
        mapData.push(locationData);
        
        // 转换为地图覆盖物并添加到地图
        const { markers, polygons } = convertMapDataToOverlays([locationData]);
        
        if (markers.length > 0) {
            const newMarkers = addMarkers(map, markers);
            mapOverlays.markers.push(...newMarkers);
        }
        
        if (polygons.length > 0) {
            const { addPolygons } = await import('./siyuan.js');
            const newPolygons = addPolygons(map, polygons);
            mapOverlays.polygons.push(...newPolygons);
        }
        
        // 如果选择了数据库，自动保存到数据库
        if (currentDatabase) {
            try {
                await addMapDataToDatabase(currentDatabase, locationData);
                showMessage('地点已添加并保存到数据库', 'success');
            } catch (error) {
                showMessage('地点已添加到地图，但保存到数据库失败: ' + error.message, 'warning');
            }
        } else {
            showMessage('地点已添加到地图', 'success');
        }
        
        // 清空表单
        nameInput.value = '';
        notesInput.value = '';
        coordsInput.value = '';
        tagCheckboxes.forEach(cb => cb.checked = false);
        
        updateDataStats();
        
    } catch (error) {
        showMessage('添加地点失败: ' + error.message, 'error');
    }
}

/**
 * 验证坐标格式
 * @param {any} coordinates 坐标数据
 * @returns {boolean} 是否有效
 */
function validateCoordinates(coordinates) {
    // 一维数组 [lng, lat]
    if (Array.isArray(coordinates) && coordinates.length === 2 &&
        typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
        return true;
    }
    
    // 二维数组 [[lng, lat], ...]
    if (Array.isArray(coordinates) && coordinates.length >= 3) {
        return coordinates.every(coord => 
            Array.isArray(coord) && coord.length === 2 &&
            typeof coord[0] === 'number' && typeof coord[1] === 'number'
        );
    }
    
    return false;
}



/**
 * 清空地图覆盖物
 * @param {object} map 地图实例
 */
function clearMapOverlays(map) {
    // 清空标记点
    if (mapOverlays.markers.length > 0) {
        map.remove(mapOverlays.markers);
        mapOverlays.markers = [];
    }
    
    // 清空多边形
    if (mapOverlays.polygons.length > 0) {
        map.remove(mapOverlays.polygons);
        mapOverlays.polygons = [];
    }
}

/**
 * 更新按钮状态
 */
function updateButtonStates() {
    const hasDatabase = !!currentDatabase;
    
    const loadBtn = document.getElementById('loadDataBtn');
    const saveBtn = document.getElementById('saveDataBtn');
    
    if (loadBtn) loadBtn.disabled = !hasDatabase;
    if (saveBtn) saveBtn.disabled = !hasDatabase;
}

/**
 * 更新数据统计
 */
function updateDataStats() {
    const markerCountEl = document.getElementById('markerCount');
    const polygonCountEl = document.getElementById('polygonCount');
    const dbRecordCountEl = document.getElementById('dbRecordCount');
    
    if (markerCountEl) markerCountEl.textContent = mapOverlays.markers.length;
    if (polygonCountEl) polygonCountEl.textContent = mapOverlays.polygons.length;
    if (dbRecordCountEl) dbRecordCountEl.textContent = mapData.length;
}

/**
 * 显示消息提示
 * @param {string} message 消息内容
 * @param {string} type 消息类型 success|error|warning|info
 */
function showMessage(message, type = 'info') {
    // 创建消息元素
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${type}`;
    messageEl.textContent = message;
    
    // 添加样式
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
    
    // 设置背景色
    const colors = {
        success: '#4CAF50',
        error: '#F44336',
        warning: '#FF9800',
        info: '#2196F3'
    };
    messageEl.style.backgroundColor = colors[type] || colors.info;
    
    // 添加到页面
    document.body.appendChild(messageEl);
    
    // 自动移除
    setTimeout(() => {
        messageEl.style.opacity = '0';
        messageEl.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => {
            document.body.removeChild(messageEl);
        }, 300);
    }, 3000);
}

/**
 * 获取当前地图数据
 * @returns {Array} 地图数据
 */
export function getCurrentMapData() {
    return mapData;
}

/**
 * 设置地图数据
 * @param {Array} data 地图数据
 */
export function setMapData(data) {
    mapData = Array.isArray(data) ? data : [];
    updateDataStats();
}

/**
 * 添加地图数据项
 * @param {object} item 数据项
 */
export function addMapDataItem(item) {
    if (item && typeof item === 'object') {
        mapData.push(item);
        updateDataStats();
    }
}

/**
 * 获取当前数据库ID
 * @returns {string|null} 数据库ID
 */
export function getCurrentDatabase() {
    return currentDatabase;
}

/**
 * 设置当前数据库
 * @param {string} avID 数据库ID
 */
export function setCurrentDatabase(avID) {
    currentDatabase = avID;
    const databaseSelect = document.getElementById('databaseSelect');
    if (databaseSelect) {
        databaseSelect.value = avID || '';
    }
    updateButtonStates();
} 
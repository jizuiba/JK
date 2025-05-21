import { api } from './api.js';
import { showToast, updateConnectionStatus } from './ui-utils.js';
import { STRINGS } from './constants.js';
import { loadSummonerData, updateSummonerDisplay } from './summoner.js';

// 连接相关变量
let isConnected = false;
let connectionCheckInterval = null;

// 开启定时检测
export function startScheduleConnectionCheck() {
    // 设置定期检查连接状态
    connectionCheckInterval = setInterval(() => {
        checkConnection();
    }, 30000); // 每30秒检查一次
}

// 检查连接状态
export async function checkConnection() {
    try {
        // 更新状态为检查中
        if (!isConnected) {
            updateConnectionStatus("pending", STRINGS.CONNECTING);
        }
        console.log('开始检查连接状态...');
        
        const result = await api.checkConnection();

        // 记录新的连接状态（必须在显示Toast之前更新状态）
        const wasConnected = isConnected;

        if (result.status === 'connected') {
            updateConnectionStatus("online", STRINGS.CONNECTED);
            isConnected = true;

            // 记录状态变化
            if (!wasConnected) {
                console.log('连接状态变化: 未连接 → 已连接');
                showToast('已成功连接到英雄联盟客户端', 'success');
            } else {
                console.log('连接状态: 保持已连接');
            }

            // 如果之前未获取过用户信息，则获取
            if (!window.currentSummoner) {
                loadSummonerData();
            }
        } else {
            updateConnectionStatus("offline", STRINGS.NOT_CONNECTED);
            isConnected = false;

            // 记录状态变化
            if (wasConnected) {
                console.log('连接状态变化: 已连接 → 未连接');
                showToast('与英雄联盟客户端的连接已断开', 'error');
            } else {
                console.log('连接状态: 保持未连接');
            }

            // 重置召唤师信息显示
            if (wasConnected) {
                updateSummonerDisplay(null);
            }
        }
    } catch (error) {
        console.error('检查连接时发生错误:', error);
        
        // 设置为未连接状态
        updateConnectionStatus("offline", STRINGS.NOT_CONNECTED);
        
        // 记录状态变化
        const wasConnected = isConnected;
        isConnected = false;
        
        // 记录状态变化
        if (wasConnected) {
            console.log('连接状态变化: 已连接 → 未连接 (错误)');
            showToast('与英雄联盟客户端的连接已断开: ' + (error.message || STRINGS.UNKNOWN_ERROR), 'error');
            updateSummonerDisplay(null);
        } else {
            console.log('连接状态: 保持未连接 (错误)');
        }
    }
}

// 停止连接检查
export function stopConnectionCheck() {
    if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
        connectionCheckInterval = null;
    }
}

// 检查是否已连接
export function getConnectionStatus() {
    return isConnected;
} 
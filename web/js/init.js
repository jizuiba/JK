import { api, cleanupExpiredCache } from './api.js';
import { checkConnection, startScheduleConnectionCheck } from './connection.js';
import { initializeNavigation } from './navigation.js';
import { initializeDarkMode } from './settings.js';
import { initializePlayerCard } from './player-card.js';
import { updateConnectionStatus } from './ui-utils.js';
import { STRINGS } from './constants.js';
import { initializeButtons } from './match-history.js';

// 初始化窗口控制按钮
export function initializeWindowControls() {
    console.log('初始化窗口控制按钮 (备用方法)');

    // 已经由Electron直接绑定事件，这里仅作为备用
    // 如果Electron的直接绑定失效，这里的代码将作为后备方案

    // 检查是否已经由Electron直接绑定
    if (window.electronAPI && document.body.classList.contains('electron-controls-bound')) {
        console.log('Electron已绑定控制事件，跳过备用初始化');
        return;
    }

    const minimizeBtn = document.getElementById('window-minimize-button');
    const closeBtn = document.getElementById('window-close-button');

    // 通过Python后端控制窗口（备用方法）
    console.log('使用备用控制方法');

    // 标记按钮已处理
    document.body.classList.add('js-controls-bound');

    // 最小化按钮
    if (minimizeBtn && !minimizeBtn.getAttribute('data-bound')) {
        minimizeBtn.addEventListener('click', function (event) {
            console.log('点击最小化按钮 (备用)');
            api.minimizeWindow();
            event.preventDefault();
            event.stopPropagation();
        });
        minimizeBtn.setAttribute('data-bound', 'true');
    }

    // 关闭按钮
    if (closeBtn && !closeBtn.getAttribute('data-bound')) {
        closeBtn.addEventListener('click', function (event) {
            console.log('点击关闭按钮 (备用)');
            api.closeWindow();
            event.preventDefault();
            event.stopPropagation();
        });
        closeBtn.setAttribute('data-bound', 'true');
    }
}

// 应用初始化
export function initializeApp() {
    // 初始设置连接状态为"连接中"
    updateConnectionStatus("pending", STRINGS.CONNECTING);
    
    // 初始化窗口控制按钮
    initializeWindowControls();

    // 立即进行一次连接检测
    checkConnection();

    // 隐藏加载屏幕
    setTimeout(() => {
        document.getElementById('app-loading').style.display = 'none';
        // 开启定时检测
        startScheduleConnectionCheck();
    }, 2000);

    // 初始化导航
    initializeNavigation();

    // 初始化按钮事件
    initializeButtons();

    // 初始化深色模式
    initializeDarkMode();

    // 确保用户信息卡片始终显示（不需要加载动画）
    document.getElementById('summoner-info').style.display = 'block';
    
    // 添加清理资源的事件监听
    window.addEventListener('blur', function() {
        // 在窗口失去焦点时清理过期缓存
        cleanupExpiredCache();
    });
    
    // 定期清理缓存
    setInterval(cleanupExpiredCache, 5 * 60 * 1000); // 每5分钟执行一次
    
    // 关闭窗口前清理
    window.addEventListener('beforeunload', function() {
        api.clearCache();
    });

    // 初始化玩家卡片
    initializePlayerCard();
} 
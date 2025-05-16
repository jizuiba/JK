import { calculateHorseRank, getHorseRankCN } from './horse-tag.js';
// 全局变量
let currentSummoner = null;
let isConnected = false;
let connectionCheckInterval = null;
let toastQueue = []; // 用于管理Toast队列
let isToastShowing = false; // 标记是否有Toast正在显示
let dataCache = {}; // 缓存数据
let debounceTimers = {}; // 防抖动计时器
let currentMatchPage = 1; // 当前战绩页码
let matchesPerPage = 7; // 每页显示的战绩数量
let hasMoreMatches = true; // 是否有更多战绩
let viewingPlayerInfo = null; // 当前查看的其他玩家信息
let navigationStack = []; // 导航堆栈

// 常用字符串常量 - 国际化支持并减少字符串重复
const STRINGS = {
    NOT_CONNECTED: '未连接',
    CONNECTING: '连接中',
    CONNECTED: '已连接',
    LOAD_ERROR: '加载失败',
    UNKNOWN_ERROR: '未知错误',
    UNKNOWN_USER: '未知用户',
    NO_DATA: '没有数据',
    LOAD_MORE: '加载更多',
    LOADING: '加载中...',
    SUCCESS: '成功',
    ERROR: '错误',
    WARNING: '警告',
    INFO: '提示'
};

// 图片基础URL
const IMAGE_URLS = {
    CHAMPION_BASE: 'http://ddragon.leagueoflegends.com/cdn/15.10.1/img/champion/',
    SPELL_BASE: 'http://ddragon.leagueoflegends.com/cdn/15.10.1/img/spell/',
    ITEM_BASE: 'http://ddragon.leagueoflegends.com/cdn/15.10.1/img/item/',
    PROFILE_ICON_BASE: 'https://ddragon.leagueoflegends.com/cdn/15.10.1/img/profileicon/'
};

// 防抖动函数
function debounce(func, wait, id) {
    return function(...args) {
        // 如果已经有相同ID的计时器，则清除
        if (debounceTimers[id]) {
            clearTimeout(debounceTimers[id]);
        }
        
        // 设置新的计时器
        debounceTimers[id] = setTimeout(() => {
            func.apply(this, args);
            delete debounceTimers[id]; // 执行后删除计时器引用
        }, wait);
    };
}

// 添加API调用封装函数
const api = {
    // 默认超时时间
    timeout: 10000, // 10秒超时
    
    // 带超时和错误处理的通用请求方法
    async fetchWithTimeout(url, options = {}) {
        const controller = new AbortController();
        const { signal } = controller;
        
        // 创建超时定时器
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const response = await fetch(url, { ...options, signal });
            clearTimeout(timeoutId); // 清除超时定时器
            
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId); // 确保清除定时器
            
            if (error.name === 'AbortError') {
                throw new Error('请求超时，请检查网络连接');
            }
            
            throw error;
        }
    },
    
    async checkConnection() {
        try {
            return await this.fetchWithTimeout('/api/check_lcu_connection');
        } catch (error) {
            console.error('检查连接时出错:', error);
            return { status: 'error', message: error.message || '请求失败' };
        }
    },
    
    async getCurrentSummoner() {
        // 检查缓存是否有效（5分钟内）
        const cacheKey = 'currentSummoner';
        const cachedData = this.getCachedData(cacheKey);
        if (cachedData) return cachedData;
        
        try {
            const response = await this.fetchWithTimeout('/api/get_current_summoner');
            
            // 缓存成功结果
            if (response.status === 'success') {
                this.setCachedData(cacheKey, response, 5 * 60 * 1000); // 缓存5分钟
            }
            
            return response;
        } catch (error) {
            console.error('获取召唤师信息时出错:', error);
            return { status: 'error', message: error.message || '请求失败' };
        }
    },
    
    async getRankedStats(puuid) {
        // 检查缓存是否有效（5分钟内）
        const cacheKey = `rankedStats_${puuid}`;
        const cachedData = this.getCachedData(cacheKey);
        if (cachedData) return cachedData;
        
        try {
            const response = await this.fetchWithTimeout(`/api/get_ranked_stats?puuid=${puuid}`);
            
            // 缓存成功结果
            if (response.status === 'success') {
                this.setCachedData(cacheKey, response, 5 * 60 * 1000); // 缓存5分钟
            }
            
            return response;
        } catch (error) {
            console.error('获取排位数据时出错:', error);
            return { status: 'error', message: error.message || '请求失败' };
        }
    },
    
    async getMatchHistory(puuid, beginIndex = 0, endIndex = 7) {
        // 检查缓存是否有效（2分钟内）
        const cacheKey = `matchHistory_${puuid}_${beginIndex}_${endIndex}`;
        const cachedData = this.getCachedData(cacheKey);
        if (cachedData) return cachedData;
        
        try {
            const response = await this.fetchWithTimeout(`/api/get_match_history?puuid=${puuid}&begin_index=${beginIndex}&end_index=${endIndex}`);
            
            // 缓存成功结果
            if (response.status === 'success') {
                this.setCachedData(cacheKey, response, 2 * 60 * 1000); // 缓存2分钟
            }
            
            return response;
        } catch (error) {
            console.error('获取战绩时出错:', error);
            return { status: 'error', message: error.message || '请求失败' };
        }
    },
    
    async getMatchDetail(matchId) {
        // 检查缓存（对于固定的历史对局，长期缓存）
        const cacheKey = `matchDetail_${matchId}`;
        const cachedData = this.getCachedData(cacheKey);
        if (cachedData) return cachedData;
        
        try {
            const response = await this.fetchWithTimeout(`/api/get_match_detail?match_id=${matchId}`);
            
            // 缓存成功结果（对局详情可以长时间缓存）
            if (response.status === 'success') {
                this.setCachedData(cacheKey, response, 24 * 60 * 60 * 1000); // 缓存24小时
            }
            
            return response;
        } catch (error) {
            console.error('获取对局详情时出错:', error);
            return { status: 'error', message: error.message || '请求失败' };
        }
    },
    
    async minimizeWindow() {
        try {
            await this.fetchWithTimeout('/api/minimize_window', { method: 'POST' });
        } catch (error) {
            console.error('最小化窗口时出错:', error);
        }
    },
    
    async closeWindow() {
        try {
            await this.fetchWithTimeout('/api/close_window', { method: 'POST' });
        } catch (error) {
            console.error('关闭窗口时出错:', error);
        }
    },
    
    // 缓存数据管理
    setCachedData(key, data, ttl) {
        dataCache[key] = {
            data,
            expiry: Date.now() + ttl
        };
    },
    
    getCachedData(key) {
        const cache = dataCache[key];
        if (!cache) return null;
        
        // 检查缓存是否过期
        if (cache.expiry < Date.now()) {
            delete dataCache[key];
            return null;
        }
        
        return cache.data;
    },
    
    clearCache() {
        dataCache = {};
    },
    
    // 只清除特定前缀的缓存
    clearCacheByPrefix(prefix) {
        Object.keys(dataCache).forEach(key => {
            if (key.startsWith(prefix)) {
                delete dataCache[key];
            }
        });
    },
    
    async getSummonerByPuuid(puuid) {
        // 检查缓存是否有效（10分钟内）
        const cacheKey = `otherSummoner_${puuid}`;
        const cachedData = this.getCachedData(cacheKey);
        if (cachedData) return cachedData;
        
        try {
            const response = await this.fetchWithTimeout(`/api/get_summoner_by_puuid?puuid=${puuid}`);
            
            // 缓存成功结果
            if (response.status === 'success') {
                this.setCachedData(cacheKey, response, 10 * 60 * 1000); // 缓存10分钟
            }
            
            return response;
        } catch (error) {
            console.error('获取玩家信息时出错:', error);
            return { status: 'error', message: error.message || '请求失败' };
        }
    },
};

// DOM元素初始化
document.addEventListener('DOMContentLoaded', function () {
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
        startScheduleConnectonCheck();
    }, 2000);

    // 初始化导航
    initializeNavigation();

    // 初始化按钮事件
    initializeButtons();

    // 初始化深色模式
    initializeDarkMode();

    // 确保用户信息卡片始终显示（不需要加载动画）
    // document.getElementById('summoner-loading').style.display = 'none';
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
        if (connectionCheckInterval) {
            clearInterval(connectionCheckInterval);
        }
        api.clearCache();
    });

    // 初始化玩家卡片
    initializePlayerCard();
});

// 初始化窗口控制按钮
function initializeWindowControls() {
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

// 初始化导航功能
function initializeNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    const pageTitle = document.querySelector('.page-title');
    const pages = document.querySelectorAll('.page'); // 提前获取所有页面

    // 页面映射，用于快速访问
    const pageMap = {};
    pages.forEach(page => {
        const pageId = page.id.replace('-page', '');
        pageMap[pageId] = page;
    });

    menuItems.forEach(item => {
        item.addEventListener('click', function () {
            // 获取目标页面ID
            const targetPageId = this.getAttribute('data-page');
            
            // 如果点击的是当前活动项，不执行任何操作
            if (this.classList.contains('active')) {
                return;
            }

            // 更新菜单项状态
            menuItems.forEach(mi => mi.classList.remove('active'));
            this.classList.add('active');

            // 更新页面标题
            pageTitle.textContent = this.querySelector('span').textContent;

            // 处理页面切换
            const targetPage = pageMap[targetPageId];
            
            // 隐藏所有页面，然后显示目标页面
            pages.forEach(page => {
                if (page === targetPage) {
                    page.classList.add('active');
                    
                    // 如果是战绩页面，准备加载战绩
                    if (targetPageId === 'match-history') {
                        // 显示加载界面，确保清空内容
                        const matchesContainer = document.getElementById('matches-container');
                        const matchLoading = document.getElementById('matches-loading');
                        const paginationContainer = document.getElementById('pagination-container');
                        
                        // 清空之前的内容
                        matchesContainer.innerHTML = '';
                        matchLoading.style.display = 'flex';
                        
                        // 重置页码
                        currentMatchPage = 1;
                        hasMoreMatches = true;
                        document.getElementById('current-page').textContent = '1';
                        document.getElementById('prev-page-btn').disabled = true;
                        document.getElementById('next-page-btn').disabled = false;
                        
                        // 只有已连接并有用户数据时才加载战绩
                        if (isConnected && currentSummoner) {
                            // 使用setTimeout以确保UI先更新显示加载中状态
                            setTimeout(() => {
                                loadMatchHistory(0, matchesPerPage - 1, false);
                            }, 100);
                        } else {
                            // 如果未连接，显示错误信息
                            matchLoading.style.display = 'none';
                            matchesContainer.innerHTML = `<div class="error-message">尚未连接到客户端或获取用户信息，请先连接并获取用户信息</div>`;
                            paginationContainer.style.display = 'none';
                        }
                    }
                } else {
                    page.classList.remove('active');
                }
            });
        });
    });
}

// 开启定时检测
function startScheduleConnectonCheck() {
    // 设置定期检查连接状态
    connectionCheckInterval = setInterval(() => {
        checkConnection();
    }, 30000); // 每30秒检查一次
}

// 检查连接状态
async function checkConnection() {
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
            if (!currentSummoner) {
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

// 更新连接状态显示
function updateConnectionStatus(status, text) {
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    if (!statusIndicator || !statusText) return;
    
    statusIndicator.className = `status-indicator ${status}`;
    statusText.textContent = text;
}

// 加载召唤师数据
async function loadSummonerData() {
    try {
        console.log('开始加载召唤师数据...');
        
        const result = await api.getCurrentSummoner();
        
        if (result.status === 'success') {
            // 存储和更新召唤师信息
            currentSummoner = result.data;
            console.log('获取召唤师数据成功:', currentSummoner.displayName);
            
            // 更新UI显示
            updateSummonerDisplay(currentSummoner);
            
            // 加载排位数据
            if (currentSummoner.puuid) {
                loadRankedData(currentSummoner.puuid);
            }
            
            return true; // 返回成功状态
        } else {
            console.error('获取召唤师数据失败:', result.message);
            showToast(`获取用户信息失败: ${result.message}`, 'error');
            return false; // 返回失败状态
        }
    } catch (error) {
        console.error('加载召唤师数据时出错:', error);
        showToast('加载用户信息时发生错误', 'error');
        return false; // 返回失败状态
    }
}

// 加载排位数据
async function loadRankedData(puuid) {
    try {
        const result = await api.getRankedStats(puuid);

        console.log(result);
        
        if (result.status === 'success') {
            updateRankedDisplay(result.data);
        } else {
            console.error('获取排位数据失败:', result.message);
            // 不显示错误提示，因为这是次要信息
            // 重置排位信息为默认状态
            resetRankedDisplay();
        }
    } catch (error) {
        console.error('加载排位数据时出错:', error);
        resetRankedDisplay();
    }
}

// 更新排位信息显示
function updateRankedDisplay(rankedData) {
    if (!rankedData || !Array.isArray(rankedData)) {
        resetRankedDisplay();
        return;
    }
    
    // 寻找单双排和灵活排位数据
    const soloRank = rankedData.find(queue => queue.queueType === 'RANKED_SOLO_5x5');
    const flexRank = rankedData.find(queue => queue.queueType === 'RANKED_FLEX_SR');
    const tftRank = rankedData.find(queue => queue.queueType === 'RANKED_TFT');
    const tftDuoRank = rankedData.find(queue => queue.queueType === 'RANKED_TFT_DOUBLE_UP' || queue.queueType === 'RANKED_TFT_TURBO');
    
    // 更新单双排信息
    updateQueueRankDisplay(soloRank, 'solo');
    
    // 更新灵活排位信息
    updateQueueRankDisplay(flexRank, 'flex');
    
    // 更新云顶之弈排位信息
    updateQueueRankDisplay(tftRank, 'tft');
    
    // 更新云顶双人排位信息
    updateQueueRankDisplay(tftDuoRank, 'tft-duo');
}

// 更新指定队列的排位信息
function updateQueueRankDisplay(queueData, queuePrefix) {
    const emblemElement = document.getElementById(`${queuePrefix}-rank-emblem`);
    const tierElement = document.getElementById(`${queuePrefix}-rank-tier`);
    const lpElement = document.getElementById(`${queuePrefix}-rank-lp`);
    const winsElement = document.getElementById(`${queuePrefix}-rank-wins`);
    const lossesElement = document.getElementById(`${queuePrefix}-rank-losses`);
    const ratioElement = document.getElementById(`${queuePrefix}-rank-ratio`);
    const rankCard = document.querySelector(`.${queuePrefix}-rank`);
    
    // 移除所有段位类
    rankCard.classList.remove('iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'challenger');
    
    if (!queueData) {
        // 没有数据，显示未定级
        emblemElement.src = `assets/ranks/UNRANKED.png`;
        tierElement.textContent = '未定级';
        lpElement.textContent = '';
        winsElement.textContent = '0';
        lossesElement.textContent = '0';
        ratioElement.textContent = '(0%)';
        return;
    }
    
    const tier = queueData.tier;
    if (!tier || tier === 'NONE' || tier === 'UNRANKED') {
        // 未定级
        emblemElement.src = `assets/ranks/UNRANKED.png`;
        tierElement.textContent = '未定级';
        lpElement.textContent = '';
        winsElement.textContent = queueData.wins || '0';
        lossesElement.textContent = queueData.losses || '0';
        
        // 计算胜率
        const totalGames = (queueData.wins || 0) + (queueData.losses || 0);
        const winRatio = totalGames > 0 ? Math.round((queueData.wins / totalGames) * 100) : 0;
        ratioElement.textContent = `(${winRatio}%)`;
    } else {
        // 有段位数据
        const tierLower = tier.toLowerCase();
        rankCard.classList.add(tierLower);
        
        // 更新段位图标
        emblemElement.src = `assets/ranks/${tier}.png`;
        
        // 更新段位文本
        const tierMap = {
            'IRON': '黑铁',
            'BRONZE': '青铜',
            'SILVER': '白银',
            'GOLD': '黄金',
            'PLATINUM': '铂金',
            'DIAMOND': '钻石',
            'MASTER': '大师',
            'GRANDMASTER': '宗师',
            'CHALLENGER': '王者'
        };
        
        const divisionMap = {
            'I': 'Ⅰ',
            'II': 'Ⅱ',
            'III': 'Ⅲ',
            'IV': 'Ⅳ'
        };
        
        const tierName = tierMap[tier] || tier;
        const division = queueData.division && queueData.division !== 'NA' ? divisionMap[queueData.division] || queueData.division : '';
        
        // 段位显示
        if (tier === 'MASTER' || tier === 'GRANDMASTER' || tier === 'CHALLENGER') {
            tierElement.textContent = tierName;
        } else {
            tierElement.textContent = `${tierName} ${division}`;
        }
        
        // LP显示
        lpElement.textContent = `${queueData.leaguePoints || 0} LP`;
        
        // 胜场和负场
        winsElement.textContent = queueData.wins || '0';
        lossesElement.textContent = queueData.losses || '0';
        
        // 计算胜率
        const totalGames = (queueData.wins || 0) + (queueData.losses || 0);
        const winRatio = totalGames > 0 ? Math.round((queueData.wins / totalGames) * 100) : 0;
        ratioElement.textContent = `(${winRatio}%)`;
    }
}

// 重置排位信息为默认状态
function resetRankedDisplay() {
    // 重置单双排
    const soloRankCard = document.querySelector('.solo-rank');
    soloRankCard.classList.remove('iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'challenger');
    document.getElementById('solo-rank-emblem').src = 'assets/ranks/UNRANKED.png';
    document.getElementById('solo-rank-tier').textContent = '未定级';
    document.getElementById('solo-rank-lp').textContent = '';
    document.getElementById('solo-rank-wins').textContent = '0';
    document.getElementById('solo-rank-losses').textContent = '0';
    document.getElementById('solo-rank-ratio').textContent = '(0%)';
    
    // 重置灵活排位
    const flexRankCard = document.querySelector('.flex-rank');
    flexRankCard.classList.remove('iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'challenger');
    document.getElementById('flex-rank-emblem').src = 'assets/ranks/UNRANKED.png';
    document.getElementById('flex-rank-tier').textContent = '未定级';
    document.getElementById('flex-rank-lp').textContent = '';
    document.getElementById('flex-rank-wins').textContent = '0';
    document.getElementById('flex-rank-losses').textContent = '0';
    document.getElementById('flex-rank-ratio').textContent = '(0%)';
    
    // 重置云顶之弈单双排
    const tftRankCard = document.querySelector('.tft-rank');
    tftRankCard.classList.remove('iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'challenger');
    document.getElementById('tft-rank-emblem').src = 'assets/ranks/UNRANKED.png';
    document.getElementById('tft-rank-tier').textContent = '未定级';
    document.getElementById('tft-rank-lp').textContent = '';
    document.getElementById('tft-rank-wins').textContent = '0';
    document.getElementById('tft-rank-losses').textContent = '0';
    document.getElementById('tft-rank-ratio').textContent = '(0%)';
    
    // 重置云顶之弈双人排位
    const tftDuoRankCard = document.querySelector('.tft-duo-rank');
    tftDuoRankCard.classList.remove('iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'challenger');
    document.getElementById('tft-duo-rank-emblem').src = 'assets/ranks/UNRANKED.png';
    document.getElementById('tft-duo-rank-tier').textContent = '未定级';
    document.getElementById('tft-duo-rank-lp').textContent = '';
    document.getElementById('tft-duo-rank-wins').textContent = '0';
    document.getElementById('tft-duo-rank-losses').textContent = '0';
    document.getElementById('tft-duo-rank-ratio').textContent = '(0%)';
}

// 更新召唤师信息显示
function updateSummonerDisplay(summoner) {
    const summonerIcon = document.getElementById('summoner-icon');
    const summonerName = document.getElementById('summoner-name');
    const summonerLevel = document.getElementById('summoner-level');
    const summonerTagline = document.getElementById('summoner-tagline');
    const miniUserInfo = document.getElementById('mini-user-info');
    
    if (summoner) {
        // 更新顶栏小用户信息
        // miniUserInfo.innerHTML = `
        //     <img src="${IMAGE_URLS.PROFILE_ICON_BASE}${summoner.profileIconId}.png" loading="lazy" alt="图标">
        //     <span>${summoner.displayName || summoner.gameName || summoner.summonerName}#${summoner.tagLine}</span>
        // `;
        
        // 更新主用户信息
        summonerIcon.src = `${IMAGE_URLS.PROFILE_ICON_BASE}${summoner.profileIconId}.png`;
        summonerName.textContent = summoner.displayName || summoner.gameName || summoner.summonerName;
        summonerLevel.textContent = summoner.summonerLevel;
        
        // tagline紧跟在summonerName后面，样式小且浅色
        if (summoner.gameName && summoner.tagLine) {
            summonerTagline.textContent = `#${summoner.tagLine}`;
        } else {
            summonerTagline.textContent = '';
        }
    } else {
        // 重置为默认状态
        miniUserInfo.innerHTML = `<span>请先连接到系统</span>`;
        summonerIcon.src = `${IMAGE_URLS.PROFILE_ICON_BASE}29.png`;
        summonerName.textContent = STRINGS.UNKNOWN_USER;
        summonerLevel.textContent = '0';
        summonerTagline.textContent = '';
        updateRankedDisplay(null);
    }
}

// 加载战绩历史
async function loadMatchHistory(beginIndex = 0, endIndex = 6, appendData = false) {
    const matchLoading = document.getElementById('matches-loading');
    const matchesContainer = document.getElementById('matches-container');
    const paginationContainer = document.getElementById('pagination-container');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const currentPageSpan = document.getElementById('current-page');
    
    // 如果不是追加模式，清空之前的内容并显示加载动画
    if (!appendData) {
        matchesContainer.innerHTML = '';
        matchLoading.style.display = 'flex';
        
        // 更新当前页码显示
        currentPageSpan.textContent = currentMatchPage.toString();
        
        // 设置上一页按钮状态
        prevPageBtn.disabled = currentMatchPage <= 1;
        
        // 暂时禁用下一页按钮，直到加载完成确定是否有更多数据
        nextPageBtn.disabled = true;
    } else {
        // 追加模式下，显示加载更多的指示器
        const loadingMore = document.createElement('div');
        loadingMore.className = 'loading-more-container';
        loadingMore.innerHTML = `
            <div class="spinner small-spinner"></div>
            <p>加载更多...</p>
        `;
        matchesContainer.appendChild(loadingMore);
    }
    
    if (!currentSummoner || !currentSummoner.puuid) {
        console.error('无法加载战绩，用户信息不完整');
        matchesContainer.innerHTML = `<div class="error-message">尚未连接到客户端或获取用户信息，请先连接并获取用户信息</div>`;
        matchLoading.style.display = 'none';
        paginationContainer.style.display = 'none';
        return;
    }
    
    try {
        // 获取战绩数据
        const result = await api.getMatchHistory(currentSummoner.puuid, beginIndex, endIndex);
        
        // 如果正在加载更多，先删除加载更多指示器
        if (appendData) {
            const loadingMore = matchesContainer.querySelector('.loading-more-container');
            if (loadingMore) {
                matchesContainer.removeChild(loadingMore);
            }
        }
        
        if (result.status === 'success') {
            // 渲染战绩
            renderMatchHistory(result.data, appendData);
            
            // 更新分页控件可见性
            paginationContainer.style.display = 'flex';
            
            // 确定是否有更多数据可加载
            if (result.data && result.data.games && result.data.games.games) {
                // 如果返回的战绩数量小于请求的数量，说明没有更多数据了
                hasMoreMatches = result.data.games.games.length >= matchesPerPage;
                nextPageBtn.disabled = !hasMoreMatches;
            } else {
                hasMoreMatches = false;
                nextPageBtn.disabled = true;
            }
        } else {
            if (!appendData) {
                matchesContainer.innerHTML = `<div class="error-message">加载对局记录失败: ${result.message || '未知错误'}</div>`;
                paginationContainer.style.display = 'none';
            } else {
                // 追加模式下的错误处理
                const errorMsg = document.createElement('div');
                errorMsg.className = 'error-message';
                errorMsg.textContent = `加载更多对局记录失败: ${result.message || '未知错误'}`;
                matchesContainer.appendChild(errorMsg);
            }
        }
        
        // 隐藏加载动画，显示内容
        matchLoading.style.display = 'none';
    } catch (error) {
        console.error('加载战绩时出错:', error);
        
        if (!appendData) {
            matchesContainer.innerHTML = `<div class="error-message">加载对局记录失败: ${error.message || '未知错误'}</div>`;
            paginationContainer.style.display = 'none';
        } else {
            // 追加模式下的错误处理
            const loadingMore = matchesContainer.querySelector('.loading-more-container');
            if (loadingMore) {
                matchesContainer.removeChild(loadingMore);
            }
            
            const errorMsg = document.createElement('div');
            errorMsg.className = 'error-message';
            errorMsg.textContent = `加载更多对局记录失败: ${error.message || '未知错误'}`;
            matchesContainer.appendChild(errorMsg);
        }
        
        matchLoading.style.display = 'none';
    }
}

// 渲染战绩历史
function renderMatchHistory(data, appendData = false) {
    const matchesContainer = document.getElementById('matches-container');
    
    // 检查数据是否为空
    if (!data || !data.games || !data.games.games || data.games.games.length === 0) {
        if (!appendData) {
            matchesContainer.innerHTML = `<div class="no-data">${STRINGS.NO_DATA}</div>`;
        } else {
            // 追加模式下不覆盖现有内容，只显示一个提示
            const noMoreData = document.createElement('div');
            noMoreData.className = 'no-more-data';
            noMoreData.textContent = '没有更多的战绩记录';
            matchesContainer.appendChild(noMoreData);
        }
        return;
    }

    const games = data.games.games;
    // const currentPuuid = currentSummoner ? currentSummoner.puuid : null;
    
    // 创建文档片段来减少DOM操作
    const fragment = document.createDocumentFragment();

    games.forEach(game => {
        // 找到当前玩家在这场比赛中的数据
        let participant = game.participants[0];

        // if (currentPuuid) {
        //     participant = game.participants.find(p => {
        //         if (p.puuid === currentPuuid) return true;
        //         // 如果找不到通过puuid，尝试通过participantIdentities
        //         if (game.participantIdentities) {
        //             const identity = game.participantIdentities.find(id =>
        //                 id.player && id.player.puuid === currentPuuid);
        //             return identity && identity.participantId === p.participantId;
        //         }
        //         return false;
        //     });
        // }

        // if (!participant) return;

        // 判断是否获胜
        const isWin = participant.stats.win;
        
        // 获取游戏模式
        const queueId = game.queueId;
        const gameMode = getGameMode(queueId);
        
        // 获取KDA
        const kills = participant.stats.kills || 0;
        const deaths = participant.stats.deaths || 0;
        const assists = participant.stats.assists || 0;
        const kda = deaths === 0 ? 'Perfect' : ((kills + assists) / deaths).toFixed(2);
        
        // 获取英雄信息
        const championId = participant.championId;
        const championKey = getChampionKey(championId);
        const spell1Key = getSpellKey(participant.spell1Id);
        const spell2Key = getSpellKey(participant.spell2Id);

        // 创建战绩卡片
        const matchCard = document.createElement('div');
        matchCard.className = `match-card ${isWin ? 'win' : 'loss'}`;
        matchCard.dataset.matchId = game.gameId; // 存储matchId用于事件委托
        
        // 性能优化：使用模板字符串一次性构建HTML
        // 使用懒加载图片 (loading="lazy")
        matchCard.innerHTML = `
            <div class="match-content">
                <div class="match-info">
                    <div class="match-type">${gameMode}</div>
                    <div class="match-time">${formatTimestamp(game.gameCreation)}</div>
                    <div class="match-divider"></div>
                    <div class="match-result ${isWin ? 'win' : 'loss'}">${isWin ? '胜利' : '失败'}</div>
                    <div class="match-duration">${formatGameDuration(game.gameDuration)}</div>
                </div>
                <div class="champion-info">
                    <img class="champion-icon" loading="lazy" src="${IMAGE_URLS.CHAMPION_BASE}${championKey}.png" alt="英雄">
                    <div class="spells">
                        <img class="spell-icon" loading="lazy" src="${IMAGE_URLS.SPELL_BASE}${spell1Key}.png" alt="技能1">
                        <img class="spell-icon" loading="lazy" src="${IMAGE_URLS.SPELL_BASE}${spell2Key}.png" alt="技能2">
                    </div>
                    <div class="kda">
                        <span>${kills}</span> / <span class="deaths">${deaths}</span> / <span>${assists}</span>
                        <div class="kda-ratio">KDA: ${kda}</div>
                    </div>
                    <div class="items">
                        ${renderItems(participant.stats)}
                    </div>
                </div>
                <div class="other-info">
                    <!-- 预留内容 -->
                </div>
                <div class="down-button">
                    <button class="expand-btn" data-match-id="${game.gameId}" title="查看详情">
                        <i class="ri-arrow-down-s-line"></i>
                    </button>
                </div>
            </div>
            <div class="match-details" id="match-details-${game.gameId}">
                <div id="detail-content-${game.gameId}">
                    <div class="loading-container" style="height: 150px;">
                        <div class="spinner"></div>
                        <p>${STRINGS.LOADING}</p>
                    </div>
                </div>
            </div>
        `;

        fragment.appendChild(matchCard);
    });
    
    // 一次性添加所有卡片到容器
    if (!appendData) {
        matchesContainer.innerHTML = '';
    }
    matchesContainer.appendChild(fragment);
    
    // 使用事件委托为所有展开按钮添加点击事件
    // 这比单独给每个按钮添加事件更高效
    if (!matchesContainer.hasAttribute('data-has-event-delegation')) {
        matchesContainer.addEventListener('click', function(e) {
            // 寻找被点击的展开按钮
            const expandBtn = e.target.closest('.expand-btn');
            if (!expandBtn) return;
            
            const matchId = expandBtn.getAttribute('data-match-id');
            if (!matchId) return;
            
            const detailsContainer = document.getElementById(`match-details-${matchId}`);
            if (!detailsContainer) return;
            
            const isActive = detailsContainer.classList.contains('active');
            
            if (isActive) {
                // 如果已经展开，则收起
                expandBtn.classList.remove('active');
                detailsContainer.classList.remove('active');
            } else {
                // 如果未展开，则展开并加载数据
                expandBtn.classList.add('active');
                detailsContainer.classList.add('active');
                
                // 加载对局详情数据
                loadMatchDetail(matchId, detailsContainer);
            }
        });
        
        // 标记已添加事件委托
        matchesContainer.setAttribute('data-has-event-delegation', 'true');
    }
}

// 渲染物品栏 - 优化
function renderItems(stats) {
    const itemIds = [
        stats.item0, stats.item1, stats.item2,
        stats.item3, stats.item4, stats.item5
    ];
    
    // 将饰品(trinket)单独处理
    const trinketId = stats.item6;

    let itemsHtml = '';

    // 先添加主要装备
    itemIds.forEach((itemId) => {
        if (itemId && itemId !== 0) {
            itemsHtml += `<img class="item-icon" loading="lazy" src="${IMAGE_URLS.ITEM_BASE}${itemId}.png" alt="物品">`;
        } else {
            itemsHtml += `<div class="empty-item"></div>`;
        }
    });
    
    // 最后添加饰品
    if (trinketId && trinketId !== 0) {
        itemsHtml += `<img class="item-icon trinket" loading="lazy" src="${IMAGE_URLS.ITEM_BASE}${trinketId}.png" alt="饰品">`;
    } else {
        itemsHtml += `<div class="empty-item trinket"></div>`;
    }

    return itemsHtml;
}

// 格式化时间戳
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN');
}

// 格式化游戏时长
function formatGameDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} 分 ${remainingSeconds} 秒`;
}

// 获取游戏模式名称
function getGameMode(queueId) {
    const modes = {
        400: '匹配征召',
        420: '单双排位',
        430: '匹配赛',
        440: '灵活排位',
        450: '极地大乱斗',
        700: '冠军杯赛',
        900: '无限火力',
        1400: '终极魔典',
        1700: '斗魂竞技场',
        2300: '神木之门'
    };

    return modes[queueId] || '其他模式';
}

// 获取英雄键名（根据ID获取对应的英雄键）
function getChampionKey(championId) {
    const championMap = {
        1: 'Annie', 2: 'Olaf', 3: 'Galio', 4: 'TwistedFate', 5: 'XinZhao',
        6: 'Urgot', 7: 'Leblanc', 8: 'Vladimir', 9: 'Fiddlesticks', 10: 'Kayle',
        11: 'MasterYi', 12: 'Alistar', 13: 'Ryze', 14: 'Sion', 15: 'Sivir',
        16: 'Soraka', 17: 'Teemo', 18: 'Tristana', 19: 'Warwick', 20: 'Nunu',
        21: 'MissFortune', 22: 'Ashe', 23: 'Tryndamere', 24: 'Jax', 25: 'Morgana',
        26: 'Zilean', 27: 'Singed', 28: 'Evelynn', 29: 'Twitch', 30: 'Karthus',
        31: 'Chogath', 32: 'Amumu', 33: 'Rammus', 34: 'Anivia', 35: 'Shaco',
        36: 'DrMundo', 37: 'Sona', 38: 'Kassadin', 39: 'Irelia', 40: 'Janna',
        41: 'Gangplank', 42: 'Corki', 43: 'Karma', 44: 'Taric', 45: 'Veigar',
        48: 'Trundle', 50: 'Swain', 51: 'Caitlyn', 53: 'Blitzcrank', 54: 'Malphite',
        55: 'Katarina', 56: 'Nocturne', 57: 'Maokai', 58: 'Renekton', 59: 'JarvanIV',
        60: 'Elise', 61: 'Orianna', 62: 'MonkeyKing', 63: 'Brand', 64: 'LeeSin',
        67: 'Vayne', 68: 'Rumble', 69: 'Cassiopeia', 72: 'Skarner', 74: 'Heimerdinger',
        75: 'Nasus', 76: 'Nidalee', 77: 'Udyr', 78: 'Poppy', 79: 'Gragas',
        80: 'Pantheon', 81: 'Ezreal', 82: 'Mordekaiser', 83: 'Yorick', 84: 'Akali',
        85: 'Kennen', 86: 'Garen', 89: 'Leona', 90: 'Malzahar', 91: 'Talon',
        92: 'Riven', 96: 'KogMaw', 98: 'Shen', 99: 'Lux', 101: 'Xerath',
        102: 'Shyvana', 103: 'Ahri', 104: 'Graves', 105: 'Fizz', 106: 'Volibear',
        107: 'Rengar', 110: 'Varus', 111: 'Nautilus', 112: 'Viktor', 113: 'Sejuani',
        114: 'Fiora', 115: 'Ziggs', 117: 'Lulu', 119: 'Draven', 120: 'Hecarim',
        121: 'Khazix', 122: 'Darius', 126: 'Jayce', 127: 'Lissandra', 131: 'Diana',
        133: 'Quinn', 134: 'Syndra', 136: 'AurelionSol', 141: 'Kayn', 142: 'Zoe',
        143: 'Zyra', 145: 'Kaisa', 147: 'Seraphine', 150: 'Gnar', 154: 'Zac',
        157: 'Yasuo', 161: 'Velkoz', 163: 'Taliyah', 166: 'Akshan', 164: 'Camille',
        201: 'Braum', 202: 'Jhin', 203: 'Kindred', 222: 'Jinx', 223: 'TahmKench',
        234: 'Viego', 235: 'Senna', 236: 'Lucian', 238: 'Zed', 240: 'Kled',
        245: 'Ekko', 246: 'Qiyana', 254: 'Vi', 266: 'Aatrox', 267: 'Nami',
        268: 'Azir', 350: 'Yuumi', 360: 'Samira', 412: 'Thresh', 420: 'Illaoi',
        421: 'RekSai', 427: 'Ivern', 429: 'Kalista', 432: 'Bard', 497: 'Rakan',
        498: 'Xayah', 516: 'Ornn', 517: 'Sylas', 526: 'Rell', 518: 'Neeko',
        523: 'Aphelios', 555: 'Pyke', 777: 'Yone', 875: 'Sett', 876: 'Lillia',
        887: 'Gwen', 888: 'Renata', 895: 'Nilah', 897: 'KSante', 200: 'Belveth',
        902: 'Milio', 950: 'Naafiri', 221: 'Zeri', 711: 'Vex', 147: 'Seraphine',
        901: 'Smolder'
    };

    // 返回对应的英雄键名，如果没有匹配则返回默认值
    return championMap[championId] || 'Aatrox';
}

// 获取技能键名（根据ID获取对应的技能键）
function getSpellKey(spellId) {
    const spellMap = {
        1: 'SummonerBoost', // 净化
        3: 'SummonerExhaust', // 虚弱
        4: 'SummonerFlash', // 闪现
        6: 'SummonerHaste', // 幽灵疾步
        7: 'SummonerHeal', // 治疗
        11: 'SummonerSmite', // 惩戒
        12: 'SummonerTeleport', // 传送
        13: 'SummonerMana', // 清晰术
        14: 'SummonerDot', // 点燃
        21: 'SummonerBarrier', // 屏障
        30: 'SummonerPoroRecall', // 极地大乱斗回城
        31: 'SummonerPoroThrow', // 极地大乱斗投掷
        32: 'SummonerSnowball', // 雪球
        39: 'SummonerSnowURFSnowball_Mark' // URF模式雪球
    };

    // 返回对应的技能键名，如果没有匹配则返回默认值
    return spellMap[spellId] || 'SummonerFlash';
}

// 初始化按钮事件
function initializeButtons() {
    // 刷新战绩按钮
    document.getElementById('refresh-matches-btn').addEventListener('click', 
        debounce(function() {
            // 重置页码并刷新战绩
            currentMatchPage = 1;
            hasMoreMatches = true;
            
            if (viewingPlayerInfo && viewingPlayerInfo.puuid) {
                // 刷新其他玩家的战绩
                loadPlayerMatchHistory(viewingPlayerInfo.puuid, 0, matchesPerPage - 1);
            } else {
                // 刷新自己的战绩
                loadMatchHistory(0, matchesPerPage - 1, false);
            }
        }, 500, 'refresh-matches'));

    // 刷新召唤师信息按钮
    document.getElementById('refresh-summoner-btn').addEventListener('click', 
        debounce(function() {
            refreshSummonerInfo();
        }, 500, 'refresh-summoner'));
        
    // 分页按钮事件
    document.getElementById('prev-page-btn').addEventListener('click', 
        debounce(function() {
            if (currentMatchPage > 1) {
                currentMatchPage--;
                const beginIndex = (currentMatchPage - 1) * matchesPerPage;
                const endIndex = beginIndex + matchesPerPage - 1;
                
                if (viewingPlayerInfo && viewingPlayerInfo.puuid) {
                    // 加载其他玩家的战绩
                    loadPlayerMatchHistory(viewingPlayerInfo.puuid, beginIndex, endIndex);
                } else {
                    // 加载自己的战绩
                    loadMatchHistory(beginIndex, endIndex, false);
                }
            }
        }, 300, 'prev-page'));
        
    document.getElementById('next-page-btn').addEventListener('click', 
        debounce(function() {
            if (hasMoreMatches) {
                currentMatchPage++;
                const beginIndex = (currentMatchPage - 1) * matchesPerPage;
                const endIndex = beginIndex + matchesPerPage - 1;
                
                if (viewingPlayerInfo && viewingPlayerInfo.puuid) {
                    // 加载其他玩家的战绩
                    loadPlayerMatchHistory(viewingPlayerInfo.puuid, beginIndex, endIndex);
                } else {
                    // 加载自己的战绩
                    loadMatchHistory(beginIndex, endIndex, false);
                }
            }
        }, 300, 'next-page'));
}

// 刷新召唤师信息
async function refreshSummonerInfo() {
    if (!isConnected) {
        showToast('未连接到客户端，无法刷新信息', 'error');
        return;
    }

    try {
        // 显示加载提示
        showToast('正在获取最新的召唤师信息', 'info');
        
        // 清除相关缓存以获取最新数据
        api.clearCacheByPrefix('currentSummoner');
        if (currentSummoner && currentSummoner.puuid) {
            api.clearCacheByPrefix(`rankedStats_${currentSummoner.puuid}`);
        }
        if (currentSummoner && currentSummoner.puuid) {
            api.clearCacheByPrefix(`matchHistory_${currentSummoner.puuid}`);
        }

        // 重新获取召唤师数据
        const result = await api.getCurrentSummoner();

        if (result.status === 'success') {
            currentSummoner = result.data;
            console.log('刷新召唤师数据成功:', currentSummoner);
            updateSummonerDisplay(currentSummoner);
            
            // 获取排位数据
            if (currentSummoner.puuid) {
                await loadRankedData(currentSummoner.puuid);
            }
            
            // 根据页面情况加载其他内容
            const activePage = document.querySelector('.page.active');
            if (activePage && activePage.id === 'match-history-page') {
                loadMatchHistory();
            }
            
            showToast('刷新成功', 'success');
        } else {
            console.error('刷新召唤师信息失败:', result.message);
            showToast(result.message || '刷新召唤师信息失败', 'error');
        }
    } catch (error) {
        console.error('刷新召唤师信息时发生错误:', error);
        showToast('与服务器通信时发生错误，请稍后重试', 'error');
    }
}

// 初始化深色模式
function initializeDarkMode() {
    const darkModeToggle = document.getElementById('dark-mode-switch');

    // 检查本地存储中的深色模式设置
    const isDarkMode = localStorage.getItem('darkMode') === 'true';

    // 设置初始状态
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        darkModeToggle.checked = true;
    }

    // 深色模式切换事件
    darkModeToggle.addEventListener('change', function () {
        if (this.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('darkMode', 'true');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('darkMode', 'false');
        }
    });
}

// 显示提示消息
function showToast(message, type = 'info') {
    // 将新的Toast添加到队列
    toastQueue.push({ message, type });

    // 如果没有Toast正在显示，则显示队列中的第一个
    if (!isToastShowing) {
        processToastQueue();
    }
}

// 加载对局详情
async function loadMatchDetail(matchId, detailsContainer) {
    try {
        const detailContent = document.getElementById(`detail-content-${matchId}`);
        
        // 显示加载中...
        detailContent.innerHTML = `
            <div class="loading-container" style="height: 150px;">
                <div class="spinner"></div>
                <p>${STRINGS.LOADING}</p>
            </div>
        `;
        
        // 请求后端API获取详情数据
        const result = await api.getMatchDetail(matchId);
        
        if (result.status === 'success') {
            // 计算牛马标签
            const matchData = calculateHorseRank(result);
            // console.log(matchData);

            renderMatchDetail(matchData.data, detailContent);
        } else {
            detailContent.innerHTML = `
                <div class="error-message">
                    <p>加载对局详情失败：${result.message || STRINGS.UNKNOWN_ERROR}</p>
                    <button class="secondary-btn retry-btn" data-match-id="${matchId}">
                        <i class="ri-refresh-line"></i> 重试
                    </button>
                </div>
            `;
            
            // 添加重试按钮事件
            const retryBtn = detailContent.querySelector('.retry-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', function() {
                    loadMatchDetail(matchId, detailsContainer);
                });
            }
        }
    } catch (error) {
        console.error('加载对局详情时出错:', error);
        document.getElementById(`detail-content-${matchId}`).innerHTML = `
            <div class="error-message">
                <p>加载对局详情时出错：${error.message || STRINGS.UNKNOWN_ERROR}</p>
                <button class="secondary-btn retry-btn" data-match-id="${matchId}">
                    <i class="ri-refresh-line"></i> 重试
                </button>
            </div>
        `;
        
        // 添加重试按钮事件
        const retryBtn = document.getElementById(`detail-content-${matchId}`).querySelector('.retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', function() {
                loadMatchDetail(matchId, detailsContainer);
            });
        }
    }
}

// 渲染对局详情
function renderMatchDetail(matchData, container) {
    if (!matchData) {
        container.innerHTML = `<div class="no-data">${STRINGS.NO_DATA}</div>`;
        return;
    }
    
    const participants = matchData.participants;
    const participantIdentities = matchData.participantIdentities;
    const teams = matchData.teams;
    
    // 获取当前召唤师的PUUID
    const currentPuuid = currentSummoner ? currentSummoner.puuid : null;
    
    // 将玩家按照队伍分组
    const blueTeam = participants.filter(p => p.teamId === 100);
    const redTeam = participants.filter(p => p.teamId === 200);
    
    // 队伍结果
    const blueTeamWin = teams.find(t => t.teamId === 100)?.win === "Win";
    const redTeamWin = teams.find(t => t.teamId === 200)?.win === "Win";
    
    // 使用DocumentFragment减少DOM操作
    const fragment = document.createDocumentFragment();
    const playerList = document.createElement('div');
    playerList.className = 'player-list';
    
    // 添加蓝队
    playerList.appendChild(createTeamElement(blueTeam, "蓝队", blueTeamWin, currentPuuid, participantIdentities));
    
    // 添加红队
    playerList.appendChild(createTeamElement(redTeam, "红队", redTeamWin, currentPuuid, participantIdentities));
    
    fragment.appendChild(playerList);
    
    // 清空容器并添加内容
    container.innerHTML = '';
    container.appendChild(fragment);
}

// 创建队伍元素 - 新辅助函数以提高性能
function createTeamElement(players, teamName, isWin, currentPuuid, participantIdentities) {
    const teamContainer = document.createElement('div');
    teamContainer.className = `compact-team-container ${isWin ? 'win' : 'loss'}`;
    
    // 队伍头部
    teamContainer.innerHTML = `
        <div class="team-header">
            <div class="team-name">
                ${teamName}
                <div class="team-result ${isWin ? 'win' : 'loss'}">${isWin ? '胜利' : '失败'}</div>
            </div>
        </div>
        
        <div class="table-header">
            <div class="th-cell th-player">玩家</div>
            <div class="th-cell th-kda">KDA</div>
            <div class="th-cell th-damage">伤害/承伤</div>
            <div class="th-cell th-vision">视野</div>
            <div class="th-cell th-cs">补刀</div>
            <div class="th-cell th-gold">金币</div>
            <div class="th-cell th-items">装备</div>
            <div class="th-cell th-tag">标签</div>
        </div>
    `;
    
    // 创建一个文档片段来保存所有队员行
    const playersFragment = document.createDocumentFragment();
    
    // 添加所有队员
    players.forEach(player => {
        const playerRow = createPlayerRowElement(player, participantIdentities, currentPuuid);
        playersFragment.appendChild(playerRow);
    });
    
    // 将所有队员添加到队伍容器
    teamContainer.appendChild(playersFragment);
    
    return teamContainer;
}

// 创建玩家行元素 - 新辅助函数以提高性能
function createPlayerRowElement(player, participantIdentities, currentPuuid) {
    // 获取玩家标识信息
    const identity = participantIdentities.find(p => p.participantId === player.participantId);
    const playerInfo = identity?.player || {};
    
    // 确定是否为当前用户
    const isCurrent = playerInfo.puuid === currentPuuid;
    
    // 计算KDA
    const stats = player.stats;
    const kills = stats.kills || 0;
    const deaths = stats.deaths || 0;
    const assists = stats.assists || 0;
    const kda = deaths === 0 ? 'Perfect' : ((kills + assists) / deaths).toFixed(2);
    
    // 获取伤害数据
    const damageDealt = stats.totalDamageDealtToChampions || 0;
    const damageTaken = stats.totalDamageTaken || 0;
    const formattedDamageDealt = formatLargeNumber(damageDealt);
    const formattedDamageTaken = formatLargeNumber(damageTaken);
    
    // 获取视野得分
    const visionScore = stats.visionScore || 0;
    
    // 获取补刀数据
    const minions = stats.totalMinionsKilled || 0;
    const jungleMinions = stats.neutralMinionsKilled || 0;
    const totalCS = minions + jungleMinions;
    
    // 获取经济数据
    const goldEarned = stats.goldEarned || 0;
    const formattedGold = formatLargeNumber(goldEarned);
    
    // 处理召唤师名称，截断过长的名字
    const summonerName = `${playerInfo.gameName || playerInfo.summonerName || '未知玩家'}#${playerInfo.tagLine}`;
    const truncatedName = summonerName.length > 20 ? summonerName.substring(0, 10) + '...' : summonerName;
    
    // 获取英雄和技能信息以准备渲染
    const championKey = getChampionKey(player.championId);
    const spell1Key = getSpellKey(player.spell1Id);
    const spell2Key = getSpellKey(player.spell2Id);
    
    // 创建玩家行
    const playerRow = document.createElement('div');
    playerRow.className = `compact-player-row ${isCurrent ? 'current-player' : ''}`;
    
    // 设置HTML内容
    playerRow.innerHTML = `
        <div class="player-info-cell">
            <div class="champion-summoner">
                <img class="champion-avatar" loading="lazy" src="${IMAGE_URLS.CHAMPION_BASE}${championKey}.png" alt="英雄">
                <div class="summoner-spells">
                    <img loading="lazy" src="${IMAGE_URLS.SPELL_BASE}${spell1Key}.png" alt="技能1">
                    <img loading="lazy" src="${IMAGE_URLS.SPELL_BASE}${spell2Key}.png" alt="技能2">
                </div>
                <div class="player-name clickable ${isCurrent ? 'current' : ''}" 
                     data-puuid="${playerInfo.puuid || ''}" 
                     data-game-name="${playerInfo.gameName || playerInfo.summonerName || '未知玩家'}"
                     data-tag-line="${playerInfo.tagLine || ''}">${truncatedName}</div>
            </div>
        </div>
        
        <div class="player-kda-cell">
            <div class="kda-stats">${kills}/<span class="deaths">${deaths}</span>/${assists}</div>
            <div class="kda-ratio">[${kda}]</div>
        </div>
        
        <div class="damage-cell">
            <div class="damage-stats">
                <div class="damage-dealt">${formattedDamageDealt}</div>
                <div class="damage-taken">${formattedDamageTaken}</div>
            </div>
        </div>
        
        <div class="vision-cell">
            <div class="vision-score">${visionScore}</div>
        </div>
        
        <div class="cs-cell">
            <div class="cs-count">${totalCS}</div>
        </div>
        
        <div class="gold-cell">
            <div class="gold-earned">${formattedGold}</div>
        </div>
        
        <div class="items-cell">
            ${renderCompactItems(stats)}
        </div>
        
        <div class="tag-cell">
            <div class="horse-rank horse-rank-${player.horseRank}">${getHorseRankCN(player.horseRank) || '未知'}</div>
        </div>
    `;
    
    // 添加点击事件处理，查看玩家信息
    const playerNameElement = playerRow.querySelector('.player-name.clickable');
    if (playerNameElement && playerInfo.puuid) {
        playerNameElement.addEventListener('click', () => {
            showPlayerCard(playerInfo.puuid, playerInfo.gameName || playerInfo.summonerName || '未知玩家', playerInfo.tagLine || '');
        });
    }
    
    return playerRow;
}

// 渲染紧凑的物品列表 - 优化
function renderCompactItems(stats) {
    // 定义所有装备槽，保持顺序
    const items = [
        stats.item0 || 0, 
        stats.item1 || 0, 
        stats.item2 || 0,
        stats.item3 || 0, 
        stats.item4 || 0, 
        stats.item5 || 0, 
        stats.item6 || 0
    ];
    
    // 检查是否有任何装备
    if (items.every(item => item === 0)) {
        return `<div class="no-items">无装备</div>`;
    }
    
    let html = `<div class="item-list">`;
    
    // 遍历所有装备槽，无论是否有装备
    items.forEach(itemId => {
        if (itemId && itemId !== 0) {
            // 有装备，显示装备图标 (使用懒加载)
            html += `<img class="item-icon" loading="lazy" src="${IMAGE_URLS.ITEM_BASE}${itemId}.png" alt="物品">`;
        } else {
            // 无装备，显示空装备槽
            html += `<div class="item-icon empty-item"></div>`;
        }
    });
    
    html += `</div>`;
    return html;
}

// 格式化大数字 (例如：12345 -> 12.3K)
function formatLargeNumber(num) {
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// 处理Toast队列
function processToastQueue() {
    if (toastQueue.length === 0) {
        isToastShowing = false;
        return;
    }

    isToastShowing = true;
    const { message, type } = toastQueue.shift();

    // 获取Toast标题
    let title = '';
    switch (type) {
        case 'success':
            title = STRINGS.SUCCESS;
            break;
        case 'error':
            title = STRINGS.ERROR;
            break;
        case 'warning':
            title = STRINGS.WARNING;
            break;
        case 'info':
        default:
            title = STRINGS.INFO;
            break;
    }

    // 创建toast元素
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
    `;

    // 添加到文档
    document.body.appendChild(toast);

    // 显示toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // 3秒后移除
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentElement) {
                document.body.removeChild(toast);
            }
            // 处理队列中的下一个Toast
            processToastQueue();
        }, 300);
    }, 3000);
}

// 清理过期缓存函数
function cleanupExpiredCache() {
    if (!dataCache) return;
    
    const now = Date.now();
    const keysToDelete = [];
    
    // 找出过期的缓存项
    Object.keys(dataCache).forEach(key => {
        if (dataCache[key] && dataCache[key].expiry < now) {
            keysToDelete.push(key);
        }
    });
    
    // 删除过期项
    keysToDelete.forEach(key => {
        delete dataCache[key];
    });
    
    console.log(`已清理 ${keysToDelete.length} 个过期缓存项`);
}

// 初始化玩家卡片事件
function initializePlayerCard() {
    // 关闭玩家卡片按钮
    document.getElementById('close-player-card').addEventListener('click', function() {
        document.getElementById('player-card-overlay').style.display = 'none';
        // 重置查看的玩家信息，确保回到我的战绩
        viewingPlayerInfo = null;
    });
    
    // 点击overlay背景关闭卡片
    document.getElementById('player-card-overlay').addEventListener('click', function(e) {
        if (e.target === this) {
            this.style.display = 'none';
            // 重置查看的玩家信息，确保回到我的战绩
            viewingPlayerInfo = null;
        }
    });
    
    // 查看完整战绩按钮
    document.getElementById('view-full-player-history').addEventListener('click', function() {
        if (viewingPlayerInfo) {
            // 关闭卡片
            document.getElementById('player-card-overlay').style.display = 'none';
            
            // 显示玩家战绩页面
            showPlayerHistoryPage(viewingPlayerInfo.puuid, viewingPlayerInfo.gameName, viewingPlayerInfo.tagLine);
        }
    });
}

// 显示玩家卡片
async function showPlayerCard(puuid, gameName, tagLine) {
    if (!puuid) {
        showToast('玩家信息不完整，无法查看', 'error');
        return;
    }
    
    // 存储当前查看的玩家信息
    viewingPlayerInfo = { puuid, gameName, tagLine };
    
    // 更新卡片标题
    const cardHeader = document.querySelector('.player-card-header h3');
    cardHeader.textContent = '玩家信息 - ' + gameName;
    
    // 显示卡片和加载状态
    const overlay = document.getElementById('player-card-overlay');
    const content = document.getElementById('player-card-content');
    overlay.style.display = 'flex';
    content.innerHTML = `
        <div class="loading-container" style="height: 150px;">
            <div class="spinner"></div>
            <p>加载中...</p>
        </div>
    `;
    
    try {
        // 并行请求玩家数据
        const [summonerResult, rankedResult, matchesResult] = await Promise.all([
            api.getSummonerByPuuid(puuid),
            api.getRankedStats(puuid),
            api.getMatchHistory(puuid, 0, 3)
        ]);
        
        // 检查玩家基本信息是否获取成功
        if (summonerResult.status !== 'success') {
            content.innerHTML = `<div class="error-message">获取玩家信息失败: ${summonerResult.message || '未知错误'}</div>`;
            return;
        }
        
        // 渲染玩家卡片内容
        renderPlayerCardContent(content, summonerResult.data, 
            rankedResult.status === 'success' ? rankedResult.data : null, 
            matchesResult.status === 'success' ? matchesResult.data : null);
        
    } catch (error) {
        console.error('加载玩家信息时出错:', error);
        content.innerHTML = `<div class="error-message">加载玩家信息时出错: ${error.message || '未知错误'}</div>`;
    }
}

// 渲染玩家卡片内容
function renderPlayerCardContent(container, summoner, rankedData, matchesData) {
    // 创建玩家信息概要
    const summary = document.createElement('div');
    summary.className = 'player-summary';
    summary.innerHTML = `
        <div class="player-avatar">
            <img src="${IMAGE_URLS.PROFILE_ICON_BASE}${summoner.profileIconId}.png" alt="玩家图标">
            <div class="player-level">${summoner.summonerLevel}</div>
        </div>
        <div class="player-info">
            <div class="player-name-display">${summoner.displayName || summoner.gameName || summoner.summonerName}</div>
            <div class="player-tagline-display">${summoner.gameName && summoner.tagLine ? `#${summoner.tagLine}` : ''}</div>
        </div>
    `;
    
    // 创建排位信息
    const ranks = document.createElement('div');
    ranks.className = 'player-ranks-simple';
    
    if (rankedData && Array.isArray(rankedData) && rankedData.length > 0) {
        // 找出几种主要排位
        const soloRank = rankedData.find(queue => queue.queueType === 'RANKED_SOLO_5x5');
        const flexRank = rankedData.find(queue => queue.queueType === 'RANKED_FLEX_SR');
        
        // 添加单双排
        if (soloRank) {
            ranks.appendChild(createSimpleRankCard(soloRank, '单双排'));
        }
        
        // 添加灵活排位
        if (flexRank) {
            ranks.appendChild(createSimpleRankCard(flexRank, '灵活排位'));
        }
    } else {
        ranks.innerHTML = '<div class="no-data">无排位数据</div>';
    }
    
    // 创建最近战绩
    const recentMatches = document.createElement('div');
    recentMatches.className = 'player-recent-matches';
    recentMatches.innerHTML = '<h4>最近战绩</h4>';
    
    if (matchesData && matchesData.games && matchesData.games.games && matchesData.games.games.length > 0) {
        const matchesContainer = document.createElement('div');
        matchesContainer.className = 'simple-matches-container';
        
        matchesData.games.games.forEach(game => {
            const participant = game.participants[0];
            
            const isWin = participant.stats.win;
            const championId = participant.championId;
            const championKey = getChampionKey(championId);
            const kills = participant.stats.kills || 0;
            const deaths = participant.stats.deaths || 0;
            const assists = participant.stats.assists || 0;
            
            const matchCard = document.createElement('div');
            matchCard.className = `simple-match-card ${isWin ? 'win' : 'loss'}`;
            matchCard.innerHTML = `
                <img class="simple-champion" src="${IMAGE_URLS.CHAMPION_BASE}${championKey}.png" alt="英雄">
                <div class="simple-match-info">
                    <div class="simple-match-result">
                        <span class="result-${isWin ? 'win' : 'loss'}">${isWin ? '胜利' : '失败'}</span>
                        <span class="simple-match-mode">${getGameMode(game.queueId)}</span>
                    </div>
                    <div class="simple-match-stats">
                        <span>${kills}/${deaths}/${assists}</span>
                        <span>KDA: ${deaths === 0 ? 'Perfect' : ((kills + assists) / deaths).toFixed(2)}</span>
                    </div>
                </div>
                <div class="simple-match-time">${formatTimestamp(game.gameCreation)}</div>
            `;
            
            matchesContainer.appendChild(matchCard);
        });
        
        recentMatches.appendChild(matchesContainer);
    } else {
        recentMatches.innerHTML += '<div class="no-data">无战绩数据</div>';
    }
    
    // 清空容器并添加所有元素
    container.innerHTML = '';
    container.appendChild(summary);
    container.appendChild(ranks);
    container.appendChild(recentMatches);
}

// 创建简单排位卡片
function createSimpleRankCard(queueData, queueName) {
    const card = document.createElement('div');
    card.className = 'simple-rank-card';
    
    if (!queueData || !queueData.tier || queueData.tier === 'NONE' || queueData.tier === 'UNRANKED') {
        card.innerHTML = `
            <div class="simple-rank-emblem">
                <img src="assets/ranks/UNRANKED.png" alt="段位">
            </div>
            <div class="simple-rank-info">
                <div class="simple-rank-tier">${queueName}: 未定级</div>
                <div class="simple-rank-lp">0胜 0负</div>
            </div>
        `;
    } else {
        const tierMap = {
            'IRON': '黑铁',
            'BRONZE': '青铜',
            'SILVER': '白银',
            'GOLD': '黄金',
            'PLATINUM': '铂金',
            'DIAMOND': '钻石',
            'MASTER': '大师',
            'GRANDMASTER': '宗师',
            'CHALLENGER': '王者'
        };
        
        const divisionMap = {
            'I': 'Ⅰ',
            'II': 'Ⅱ',
            'III': 'Ⅲ',
            'IV': 'Ⅳ'
        };
        
        const tierName = tierMap[queueData.tier] || queueData.tier;
        const division = queueData.division && queueData.division !== 'NA' ? divisionMap[queueData.division] || queueData.division : '';
        
        // 段位显示
        let tierDisplay;
        if (queueData.tier === 'MASTER' || queueData.tier === 'GRANDMASTER' || queueData.tier === 'CHALLENGER') {
            tierDisplay = `${queueName}: ${tierName}`;
        } else {
            tierDisplay = `${queueName}: ${tierName} ${division}`;
        }
        
        // 胜率计算
        const totalGames = (queueData.wins || 0) + (queueData.losses || 0);
        const winRatio = totalGames > 0 ? Math.round((queueData.wins / totalGames) * 100) : 0;
        
        card.innerHTML = `
            <div class="simple-rank-emblem">
                <img src="assets/ranks/${queueData.tier}.png" alt="段位">
            </div>
            <div class="simple-rank-info">
                <div class="simple-rank-tier">${tierDisplay}</div>
                <div class="simple-rank-lp">${queueData.leaguePoints || 0} LP (${winRatio}%胜率)</div>
            </div>
        `;
    }
    
    return card;
}

// 显示玩家战绩页面
function showPlayerHistoryPage(puuid, gameName, tagLine) {
    // 保存导航历史
    addToNavigationStack();
    
    // 存储查看的玩家信息
    viewingPlayerInfo = { puuid, gameName, tagLine };
    
    // 获取页面元素
    const matchHistoryMenuItem = document.querySelector('.menu-item[data-page="match-history"]');
    const matchHistoryPage = document.getElementById('match-history-page');
    const pageTitle = document.querySelector('.page-title');
    
    // 激活战绩页面
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    matchHistoryMenuItem.classList.add('active');
    
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    matchHistoryPage.classList.add('active');
    
    // 更新页面标题
    pageTitle.textContent = `${gameName || '未知玩家'} 的战绩`;
    
    // 添加导航头部
    addNavigationHeader(matchHistoryPage, gameName);
    
    // 显示加载界面
    const matchesContainer = document.getElementById('matches-container');
    const matchLoading = document.getElementById('matches-loading');
    const paginationContainer = document.getElementById('pagination-container');
    
    matchesContainer.innerHTML = '';
    matchLoading.style.display = 'flex';
    
    // 重置页码
    currentMatchPage = 1;
    hasMoreMatches = true;
    document.getElementById('current-page').textContent = '1';
    document.getElementById('prev-page-btn').disabled = true;
    document.getElementById('next-page-btn').disabled = false;
    
    // 加载玩家战绩
    setTimeout(() => {
        loadPlayerMatchHistory(puuid, 0, matchesPerPage - 1);
    }, 100);
}

// 添加导航头部
function addNavigationHeader(container, playerName) {
    // 查找是否已存在导航头部
    let navHeader = container.querySelector('.player-history-navigation');
    
    if (!navHeader) {
        navHeader = document.createElement('div');
        navHeader.className = 'player-history-navigation';
        container.insertBefore(navHeader, container.firstChild);
    }
    
    navHeader.innerHTML = `
        <button class="navigation-back" id="back-to-history">
            <i class="ri-arrow-left-line"></i> 返回
        </button>
        <div class="breadcrumbs">
            <div class="breadcrumb-item"><a href="#" id="home-breadcrumb">首页</a></div>
            <div class="breadcrumb-item"><a href="#" id="my-history-breadcrumb">我的战绩</a></div>
            <div class="breadcrumb-item active">${playerName || '玩家'} 的战绩</div>
        </div>
    `;
    
    // 添加返回按钮事件
    document.getElementById('back-to-history').addEventListener('click', navigateBack);
    document.getElementById('home-breadcrumb').addEventListener('click', navigateToHome);
    document.getElementById('my-history-breadcrumb').addEventListener('click', navigateToMyHistory);
}

// 加载玩家战绩历史
async function loadPlayerMatchHistory(puuid, beginIndex = 0, endIndex = 6) {
    if (!puuid) {
        showToast('玩家信息不完整，无法查询战绩', 'error');
        return;
    }
    
    const matchLoading = document.getElementById('matches-loading');
    const matchesContainer = document.getElementById('matches-container');
    const paginationContainer = document.getElementById('pagination-container');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const currentPageSpan = document.getElementById('current-page');
    
    // 清空之前的内容并显示加载动画
    matchesContainer.innerHTML = '';
    matchLoading.style.display = 'flex';
    
    // 更新当前页码显示
    currentPageSpan.textContent = currentMatchPage.toString();
    
    // 设置上一页按钮状态
    prevPageBtn.disabled = currentMatchPage <= 1;
    
    // 暂时禁用下一页按钮，直到加载完成确定是否有更多数据
    nextPageBtn.disabled = true;
    
    try {
        // 获取战绩数据
        const result = await api.getMatchHistory(puuid, beginIndex, endIndex);
        
        if (result.status === 'success') {
            // 渲染战绩
            renderMatchHistory(result.data, false);
            
            // 更新分页控件可见性
            paginationContainer.style.display = 'flex';
            
            // 确定是否有更多数据可加载
            if (result.data && result.data.games && result.data.games.games) {
                // 如果返回的战绩数量小于请求的数量，说明没有更多数据了
                hasMoreMatches = result.data.games.games.length >= matchesPerPage;
                nextPageBtn.disabled = !hasMoreMatches;
            } else {
                hasMoreMatches = false;
                nextPageBtn.disabled = true;
            }
        } else {
            matchesContainer.innerHTML = `<div class="error-message">加载对局记录失败: ${result.message || '未知错误'}</div>`;
            paginationContainer.style.display = 'none';
        }
        
        // 隐藏加载动画，显示内容
        matchLoading.style.display = 'none';
    } catch (error) {
        console.error('加载战绩时出错:', error);
        matchesContainer.innerHTML = `<div class="error-message">加载对局记录失败: ${error.message || '未知错误'}</div>`;
        paginationContainer.style.display = 'none';
        matchLoading.style.display = 'none';
    }
}

// 导航系统相关函数
function addToNavigationStack() {
    // 获取当前页面状态
    const currentPage = document.querySelector('.page.active').id;
    const scrollPosition = window.scrollY;
    
    // 添加到导航堆栈
    navigationStack.push({
        page: currentPage,
        scroll: scrollPosition,
        viewingPlayer: viewingPlayerInfo ? { ...viewingPlayerInfo } : null,
        matchPage: currentMatchPage
    });
}

function navigateBack() {
    if (navigationStack.length > 0) {
        // 获取上一个页面状态
        const prevState = navigationStack.pop();
        
        // 重置当前查看的玩家
        viewingPlayerInfo = prevState.viewingPlayer;
        currentMatchPage = prevState.matchPage || 1;
        
        // 切换到上一个页面
        switch (prevState.page) {
            case 'match-history-page':
                // 回到我的战绩页面
                navigateToMyHistory();
                break;
            case 'summoner-page':
                // 回到个人信息页面
                navigateToHome();
                break;
            default:
                // 默认回到首页
                navigateToHome();
        }
        
        // 恢复滚动位置
        setTimeout(() => window.scrollTo(0, prevState.scroll || 0), 100);
    } else {
        // 没有历史，直接回到我的战绩
        navigateToMyHistory();
    }
}

function navigateToHome() {
    // 切换到个人信息页面
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    document.querySelector('.menu-item[data-page="summoner"]').classList.add('active');
    
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById('summoner-page').classList.add('active');
    
    // 更新页面标题
    document.querySelector('.page-title').textContent = '用户信息';
    
    // 重置查看的玩家
    viewingPlayerInfo = null;
}

function navigateToMyHistory() {
    // 重置查看的玩家
    viewingPlayerInfo = null;
    
    // 切换到战绩页面
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    document.querySelector('.menu-item[data-page="match-history"]').classList.add('active');
    
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById('match-history-page').classList.add('active');
    
    // 移除导航头部
    const navHeader = document.getElementById('match-history-page').querySelector('.player-history-navigation');
    if (navHeader) {
        navHeader.remove();
    }
    
    // 更新页面标题
    document.querySelector('.page-title').textContent = '历史记录';
    
    // 重新加载我的战绩
    currentMatchPage = 1;
    hasMoreMatches = true;
    const matchesContainer = document.getElementById('matches-container');
    const matchLoading = document.getElementById('matches-loading');
    
    matchesContainer.innerHTML = '';
    matchLoading.style.display = 'flex';
    
    document.getElementById('current-page').textContent = '1';
    document.getElementById('prev-page-btn').disabled = true;
    
    if (currentSummoner && currentSummoner.puuid) {
        setTimeout(() => {
            loadMatchHistory(0, matchesPerPage - 1, false);
        }, 100);
    } else {
        matchLoading.style.display = 'none';
        matchesContainer.innerHTML = `<div class="error-message">尚未连接到客户端或获取用户信息，请先连接并获取用户信息</div>`;
        document.getElementById('pagination-container').style.display = 'none';
    }
}
import { loadMatchHistory } from './match-history.js';
import { currentSummoner } from './summoner.js';
import { getConnectionStatus } from './connection.js';

// 导航堆栈
let navigationStack = [];

// 当前查看的其他玩家信息
export let viewingPlayerInfo = null;

// 设置当前查看的玩家信息
export function setViewingPlayerInfo(playerInfo) {
    viewingPlayerInfo = playerInfo;
}

// 初始化导航功能
export function initializeNavigation() {
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
                        document.getElementById('current-page').textContent = '1';
                        document.getElementById('prev-page-btn').disabled = true;
                        document.getElementById('next-page-btn').disabled = false;
                        
                        // 只有已连接并有用户数据时才加载战绩
                        if (getConnectionStatus() && currentSummoner) {
                            // 使用setTimeout以确保UI先更新显示加载中状态
                            setTimeout(() => {
                                loadMatchHistory(0, 6, false);
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

// 添加到导航堆栈
export function addToNavigationStack() {
    // 获取当前页面状态
    const currentPage = document.querySelector('.page.active').id;
    const scrollPosition = window.scrollY;
    
    // 添加到导航堆栈
    navigationStack.push({
        page: currentPage,
        scroll: scrollPosition,
        viewingPlayer: viewingPlayerInfo ? { ...viewingPlayerInfo } : null,
        matchPage: window.currentMatchPage || 1
    });
}

// 返回上一页
export function navigateBack() {
    if (navigationStack.length > 0) {
        // 获取上一个页面状态
        const prevState = navigationStack.pop();
        
        // 重置当前查看的玩家
        viewingPlayerInfo = prevState.viewingPlayer;
        window.currentMatchPage = prevState.matchPage || 1;
        
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

// 导航到首页
export function navigateToHome() {
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

// 导航到我的战绩页面
export function navigateToMyHistory() {
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
    window.currentMatchPage = 1;
    window.hasMoreMatches = true;
    const matchesContainer = document.getElementById('matches-container');
    const matchLoading = document.getElementById('matches-loading');
    
    matchesContainer.innerHTML = '';
    matchLoading.style.display = 'flex';
    
    document.getElementById('current-page').textContent = '1';
    document.getElementById('prev-page-btn').disabled = true;
    
    if (currentSummoner && currentSummoner.puuid) {
        setTimeout(() => {
            loadMatchHistory(0, 6, false);
        }, 100);
    } else {
        matchLoading.style.display = 'none';
        matchesContainer.innerHTML = `<div class="error-message">尚未连接到客户端或获取用户信息，请先连接并获取用户信息</div>`;
        document.getElementById('pagination-container').style.display = 'none';
    }
}

// 显示玩家战绩页面
export function showPlayerHistoryPage(puuid, gameName, tagLine) {
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
    window.currentMatchPage = 1;
    window.hasMoreMatches = true;
    document.getElementById('current-page').textContent = '1';
    document.getElementById('prev-page-btn').disabled = true;
    document.getElementById('next-page-btn').disabled = false;
    
    // 加载玩家战绩
    setTimeout(() => {
        loadPlayerMatchHistory(puuid, 0, 6);
    }, 100);
}

// 添加导航头部
export function addNavigationHeader(container, playerName) {
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
export async function loadPlayerMatchHistory(puuid, beginIndex = 0, endIndex = 6) {
    if (!puuid) {
        import('./ui-utils.js').then(({ showToast }) => {
            showToast('玩家信息不完整，无法查询战绩', 'error');
        });
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
    currentPageSpan.textContent = window.currentMatchPage.toString();
    
    // 设置上一页按钮状态
    prevPageBtn.disabled = window.currentMatchPage <= 1;
    
    // 暂时禁用下一页按钮，直到加载完成确定是否有更多数据
    nextPageBtn.disabled = true;
    
    try {
        const { api } = await import('./api.js');
        const { renderMatchHistory } = await import('./match-history.js');
        
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
                window.hasMoreMatches = result.data.games.games.length >= (endIndex - beginIndex + 1);
                nextPageBtn.disabled = !window.hasMoreMatches;
            } else {
                window.hasMoreMatches = false;
                nextPageBtn.disabled = true;
            }
        } else {
            const { showToast } = await import('./ui-utils.js');
            showToast(result.message || '加载对局记录失败', 'error');
            
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
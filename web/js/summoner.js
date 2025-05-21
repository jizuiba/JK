import { api } from './api.js';
import { showToast } from './ui-utils.js';
import { STRINGS } from './constants.js';
import { IMAGE_URLS } from './constants.js';

// 全局当前召唤师数据
export let currentSummoner = null;

// 加载召唤师数据
export async function loadSummonerData() {
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

// 更新召唤师信息显示
export function updateSummonerDisplay(summoner) {
    const summonerIcon = document.getElementById('summoner-icon');
    const summonerName = document.getElementById('summoner-name');
    const summonerLevel = document.getElementById('summoner-level');
    const summonerTagline = document.getElementById('summoner-tagline');
    const miniUserInfo = document.getElementById('mini-user-info');
    
    if (summoner) {
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
        resetRankedDisplay();
    }
}

// 加载排位数据
export async function loadRankedData(puuid) {
    try {
        const result = await api.getRankedStats(puuid);
        
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

// 刷新召唤师信息
export async function refreshSummonerInfo() {
    const { getConnectionStatus } = await import('./connection.js');
    const isConnected = getConnectionStatus();
    
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
            
            // 获取当前活动页面
            const activePage = document.querySelector('.page.active');
            
            // 根据页面情况加载其他内容
            if (activePage && activePage.id === 'match-history-page') {
                const { loadMatchHistory } = await import('./match-history.js');
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

// 更新排位信息显示
export function updateRankedDisplay(rankedData) {
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
export function resetRankedDisplay() {
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
import { api } from './api.js';
import { showToast } from './ui-utils.js';
import { showPlayerHistoryPage } from './navigation.js';
import { viewingPlayerInfo } from './navigation.js';
import { IMAGE_URLS } from './constants.js';
import { getGameMode, getChampionKey, formatTimestamp } from './utils.js';

// 初始化玩家卡片事件
export function initializePlayerCard() {
    // 关闭玩家卡片按钮
    document.getElementById('close-player-card').addEventListener('click', function() {
        document.getElementById('player-card-overlay').style.display = 'none';
        // 重置为null在navigation.js中完成
    });
    
    // 点击overlay背景关闭卡片
    document.getElementById('player-card-overlay').addEventListener('click', function(e) {
        if (e.target === this) {
            this.style.display = 'none';
            // 重置为null在navigation.js中完成
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
export async function showPlayerCard(puuid, gameName, tagLine) {
    if (!puuid) {
        showToast('玩家信息不完整，无法查看', 'error');
        return;
    }
    
    // 存储当前查看的玩家信息
    const { setViewingPlayerInfo } = await import('./navigation.js');
    setViewingPlayerInfo({ puuid, gameName, tagLine });
    
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
            api.getMatchHistory(puuid, 0, 4)
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
export function renderPlayerCardContent(container, summoner, rankedData, matchesData) {
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
import { api } from './api.js';
import { showToast } from './ui-utils.js';
import { debounce } from './utils.js';
import { formatTimestamp, formatGameDuration, getGameMode, getChampionKey, getSpellKey, formatLargeNumber } from './utils.js';
import { STRINGS } from './constants.js';
import { IMAGE_URLS } from './constants.js';
import { currentSummoner } from './summoner.js';
import { showPlayerCard } from './player-card.js';
import { getConnectionStatus } from './connection.js';
import { viewingPlayerInfo } from './navigation.js';
import { calculateHorseRank, getHorseRankCN } from './horse-tag.js';

// 全局变量
export let currentMatchPage = 1; // 当前战绩页码
export let matchesPerPage = 7; // 每页显示的战绩数量
export let hasMoreMatches = true; // 是否有更多战绩

// 初始化按钮事件
export function initializeButtons() {
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
        debounce(async function() {
            const { refreshSummonerInfo } = await import('./summoner.js');
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

// 加载战绩历史
export async function loadMatchHistory(beginIndex = 0, endIndex = 6, appendData = false) {
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
export function renderMatchHistory(data, appendData = false) {
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
    
    // 创建文档片段来减少DOM操作
    const fragment = document.createDocumentFragment();

    games.forEach(game => {
        // 找到当前玩家在这场比赛中的数据
        let participant = game.participants[0];

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

// 加载对局详情
export async function loadMatchDetail(matchId, detailsContainer) {
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
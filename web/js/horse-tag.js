export function calculateHorseRank(matchData) {
    const participants = matchData.data.participants;
    const gameDuration = matchData.data.gameDuration;

    // 计算团队总伤害、总击杀和总助攻
    let team1TotalDamage = 0;
    let team2TotalDamage = 0;
    let team1TotalKills = 0; // 修改为仅计算击杀
    let team2TotalKills = 0;
    let team1TotalAssists = 0;
    let team2TotalAssists = 0;

    participants.forEach(participant => {
        if (participant.teamId === 100) {
            team1TotalDamage += participant.stats.totalDamageDealtToChampions;
            team1TotalKills += participant.stats.kills;
            team1TotalAssists += participant.stats.assists;
        } else {
            team2TotalDamage += participant.stats.totalDamageDealtToChampions;
            team2TotalKills += participant.stats.kills;
            team2TotalAssists += participant.stats.assists;
        }
    });

    // 计算每个玩家的马种分数
    participants.forEach(participant => {
        const stats = participant.stats;
        let playerScore = 100; // 基础分
        const teamTotalKills = participant.teamId === 100 ? team1TotalKills : team2TotalKills;
        const teamTotalDamage = participant.teamId === 100 ? team1TotalDamage : team2TotalDamage;

        // 分均补兵（修复重叠问题）
        const cpm = stats.totalMinionsKilled / (gameDuration / 60);
        if (cpm > 10) playerScore += 20;
        else if (cpm > 9) playerScore += 10;
        else if (cpm > 8) playerScore += 5;

        // 金钱比
        const moneyRank = getMoneyRank(participants, participant.participantId);
        if (moneyRank === 1) playerScore += 10;
        else if (moneyRank === 2) playerScore += 5;
        else if (moneyRank === 4 && !isSupportParticipant(participant)) playerScore -= 5;
        else if (moneyRank === 5 && !isSupportParticipant(participant)) playerScore -= 10;

        // KDA和击杀占比
        const deaths = Math.max(stats.deaths, 1); // 避免除以0
        const kda = (stats.kills + stats.assists) / deaths;
        
        // 正确计算参团率
        const engagementRate = teamTotalKills > 0 ? 
            (stats.kills + stats.assists) / teamTotalKills : 0;
            
        // 添加KDA加分公式: (k+a)/d + (k-d)/5*参团率
        const kdaBonus = kda + (stats.kills - stats.deaths) / 5 * engagementRate;
        playerScore += Math.round(kdaBonus * 2); // 给予适当权重
        
        // 击杀占比
        const killPercentage = teamTotalKills > 0 ? 
            (stats.kills / teamTotalKills) * 100 : 0;
            
        // 击杀数加分（修复重叠问题）
        if (killPercentage > 50) {
            if (stats.kills > 15) playerScore += 40;
            else if (stats.kills > 10) playerScore += 20;
            else if (stats.kills > 5) playerScore += 10;
        } else if (killPercentage > 35) {
            if (stats.kills > 10) playerScore += 20;
            else if (stats.kills > 5) playerScore += 5;
        }

        // 伤害占比（修复重叠问题）
        const damagePercentage = teamTotalDamage > 0 ? 
            (stats.totalDamageDealtToChampions / teamTotalDamage) * 100 : 0;
            
        if (damagePercentage > 50) {
            if (stats.totalDamageDealtToChampions > 15000) playerScore += 40;
            else if (stats.totalDamageDealtToChampions > 10000) playerScore += 20;
            else if (stats.totalDamageDealtToChampions > 5000) playerScore += 10;
        } else if (damagePercentage > 30) {
            if (stats.totalDamageDealtToChampions > 15000) playerScore += 20;
            else if (stats.totalDamageDealtToChampions > 10000) playerScore += 10;
            else if (stats.totalDamageDealtToChampions > 5000) playerScore += 5;
        }

        // 金钱转化比
        const goldEfficiency = stats.goldEarned / Math.max(stats.goldSpent, 1);
        if (goldEfficiency > 1.2) playerScore += 10; // 金钱利用效率高
        else if (goldEfficiency < 0.8) playerScore -= 5; // 金钱利用效率低
        
        // 助攻占比（修复重叠问题）
        const teamTotalAssists = participant.teamId === 100 ? team1TotalAssists : team2TotalAssists;
        const assistPercentage = teamTotalAssists > 0 ? 
            (stats.assists / teamTotalAssists) * 100 : 0;
            
        if (assistPercentage > 50) {
            if (stats.assists > 15) playerScore += 40;
            else if (stats.assists > 10) playerScore += 20;
            else if (stats.assists > 5) playerScore += 10;
        } else if (assistPercentage > 35) {
            if (stats.assists > 15) playerScore += 20;
            else if (stats.assists > 10) playerScore += 10;
            else if (stats.assists > 5) playerScore += 5;
        }

        // 参团率排名
        const engagementRank = getEngagementRank(participants, participant.participantId);
        if (engagementRank === 1) playerScore += 10;
        else if (engagementRank === 2) playerScore += 5;
        else if (engagementRank === 4) playerScore -= 5;
        else if (engagementRank === 5) playerScore -= 10;

        // 视野得分
        const visionRank = getVisionRank(participants, participant.participantId);
        if (visionRank === 1) playerScore += 10;
        else if (visionRank === 2) playerScore += 5;

        // 一血
        if (stats.firstBloodKill) playerScore += 10;
        else if (stats.firstBloodAssist) playerScore += 5;

        // 三杀及以上
        if (stats.pentaKills > 0) playerScore += 20;
        else if (stats.quadraKills > 0) playerScore += 10;
        else if (stats.tripleKills > 0) playerScore += 5;
        
        // 胜负加成
        if (stats.win) playerScore += 5;
        else if (stats.deaths >= 10) playerScore -= 10; // 大量死亡且失败
        
        // 更新玩家的马种分数
        participant.horseRankScore = Math.round(playerScore);
        participant.horseRank = getHorseRank(playerScore);
    });

    return matchData;
}

// 获取金钱排名
function getMoneyRank(participants, participantId) {
    const sortedParticipants = [...participants].sort((a, b) => b.stats.goldEarned - a.stats.goldEarned);
    return sortedParticipants.findIndex(p => p.participantId === participantId) + 1;
}

// 获取参团率排名 - 修正计算方法
function getEngagementRank(participants, participantId) {
    // 先计算每个玩家的参团率
    const team1Participants = participants.filter(p => p.teamId === 100);
    const team2Participants = participants.filter(p => p.teamId === 200);
    
    // 计算每个队伍的总击杀
    const team1TotalKills = team1Participants.reduce((sum, p) => sum + p.stats.kills, 0);
    const team2TotalKills = team2Participants.reduce((sum, p) => sum + p.stats.kills, 0);
    
    // 为每个玩家添加参团率属性
    participants.forEach(p => {
        const teamKills = p.teamId === 100 ? team1TotalKills : team2TotalKills;
        p.engagementRate = teamKills > 0 ? (p.stats.kills + p.stats.assists) / teamKills : 0;
    });
    
    // 根据参团率排序
    const sortedParticipants = [...participants].sort((a, b) => b.engagementRate - a.engagementRate);
    return sortedParticipants.findIndex(p => p.participantId === participantId) + 1;
}

// 获取视野得分排名
function getVisionRank(participants, participantId) {
    const sortedParticipants = [...participants].sort((a, b) => b.stats.visionScore - a.stats.visionScore);
    return sortedParticipants.findIndex(p => p.participantId === participantId) + 1;
}

// 改进判断是否是辅助位
function isSupportParticipant(participant) {
    // 多重判断条件，提高辅助判断准确性
    if (participant.timeline && participant.timeline.role === "SUPPORT") {
        return true;
    }
    
    // 如果没有明确的role信息，尝试使用其他特征判断
    const stats = participant.stats;
    const lowCS = stats.totalMinionsKilled < 70; // 辅助通常补刀少
    const highAssists = stats.assists > stats.kills * 2; // 辅助通常助攻多于击杀
    const hasWardItem = stats.item0 === 3853 || stats.item1 === 3853 || stats.item2 === 3853 ||
                        stats.item3 === 3853 || stats.item4 === 3853 || stats.item5 === 3853; // 辅助眼石
    
    return lowCS && highAssists || hasWardItem;
}

// 根据分数获取马种
function getHorseRank(score) {
    if (score < 95) return "Workhorse";
    if (score <= 105) return "InferiorHorse";
    if (score <= 125) return "AverageHorse";
    if (score <= 150) return "EliteHorse";
    if (score <= 180) return "JuniorGeneration";
    return "Heaven-ConnectedGeneration";
}

export function getHorseRankCN(US) {
    const chineseMap = {
        "Workhorse": "牛马",
        "InferiorHorse": "下等马",
        "AverageHorse": "中等马",
        "EliteHorse": "上等马",
        "JuniorGeneration": "小代",
        "Heaven-ConnectedGeneration": "通天代"
    };
    return chineseMap[US] || "未知术语";
}
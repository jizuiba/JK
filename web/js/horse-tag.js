export function calculateHorseRank(matchData) {
    const participants = matchData.data.participants;
    const gameDuration = matchData.data.gameDuration;

    // 计算团队总伤害、总击杀和总助攻
    let team1TotalDamage = 0;
    let team2TotalDamage = 0;
    let team1TotalKillsAndAssists = 0;
    let team2TotalKillsAndAssists = 0;

    participants.forEach(participant => {
        if (participant.teamId === 100) {
            team1TotalDamage += participant.stats.totalDamageDealtToChampions;
            team1TotalKillsAndAssists += participant.stats.kills + participant.stats.assists;
        } else {
            team2TotalDamage += participant.stats.totalDamageDealtToChampions;
            team2TotalKillsAndAssists += participant.stats.kills + participant.stats.assists;
        }
    });

    // 计算每个玩家的马种分数
    participants.forEach(participant => {
        const stats = participant.stats;
        let playerScore = 100; // 基础分

        // 分均补兵
        const cpm = stats.totalMinionsKilled / (gameDuration / 60);
        if (cpm > 8) playerScore += 5;
        if (cpm > 9) playerScore += 10;
        if (cpm > 10) playerScore += 20;

        // 金钱比
        const moneyRank = getMoneyRank(participants, participant.participantId);
        if (moneyRank === 1) playerScore += 10;
        if (moneyRank === 2) playerScore += 5;
        if (moneyRank === 4 && !isSupportParticipant(participant)) playerScore -= 5;
        if (moneyRank === 5 && !isSupportParticipant(participant)) playerScore -= 10;

        // KDA
        const kda = (stats.kills + stats.assists) / Math.max(stats.deaths, 1);
        const killPercentage = (stats.kills / (team1TotalKillsAndAssists + team2TotalKillsAndAssists)) * 100;
        if (killPercentage > 50 && stats.kills > 5) playerScore += 10;
        if (killPercentage > 50 && stats.kills > 10) playerScore += 20;
        if (killPercentage > 50 && stats.kills > 15) playerScore += 40;
        if (killPercentage > 35 && stats.kills > 5) playerScore += 5;
        if (killPercentage > 35 && stats.kills > 10) playerScore += 20;

        // 伤害比
        const damagePercentage = (stats.totalDamageDealtToChampions / (participant.teamId === 100 ? team1TotalDamage : team2TotalDamage)) * 100;
        if (damagePercentage > 50 && stats.totalDamageDealtToChampions > 15000) playerScore += 40;
        if (damagePercentage > 50 && stats.totalDamageDealtToChampions > 10000) playerScore += 20;
        if (damagePercentage > 50 && stats.totalDamageDealtToChampions > 5000) playerScore += 10;
        if (damagePercentage > 30 && stats.totalDamageDealtToChampions > 15000) playerScore += 20;
        if (damagePercentage > 30 && stats.totalDamageDealtToChampions > 10000) playerScore += 10;
        if (damagePercentage > 30 && stats.totalDamageDealtToChampions > 5000) playerScore += 5;

        // 金钱转化比
        const goldEfficiency = stats.goldEarned / Math.max(stats.goldSpent, 1);
        const assistPercentage = (stats.assists / (team1TotalKillsAndAssists + team2TotalKillsAndAssists)) * 100;
        if (assistPercentage > 50 && stats.assists > 5) playerScore += 10;
        if (assistPercentage > 50 && stats.assists > 10) playerScore += 20;
        if (assistPercentage > 50 && stats.assists > 15) playerScore += 40;
        if (assistPercentage > 35 && stats.assists > 5) playerScore += 5;
        if (assistPercentage > 35 && stats.assists > 10) playerScore += 10;
        if (assistPercentage > 35 && stats.assists > 15) playerScore += 20;

        // 参团率
        const engagementRate = (stats.kills + stats.assists) / (team1TotalKillsAndAssists + team2TotalKillsAndAssists);
        const engagementRank = getEngagementRank(participants, participant.participantId);
        if (engagementRank === 1) playerScore += 10;
        if (engagementRank === 2) playerScore += 5;
        if (engagementRank === 4) playerScore -= 5;
        if (engagementRank === 5) playerScore -= 10;

        // 视野得分
        const visionRank = getVisionRank(participants, participant.participantId);
        if (visionRank === 1) playerScore += 10;
        if (visionRank === 2) playerScore += 5;

        // 一血
        if (stats.firstBloodKill) playerScore += 10;
        if (stats.firstBloodAssist) playerScore += 5;

        // 三杀及以上
        if (stats.tripleKills > 0) playerScore += 5;
        if (stats.quadraKills > 0) playerScore += 10;
        if (stats.pentaKills > 0) playerScore += 20;

        // 更新玩家的马种分数
        participant.horseRankScore = playerScore;
        participant.horseRank = getHorseRank(playerScore);
    });

    return matchData;
}

// 获取金钱排名
function getMoneyRank(participants, participantId) {
    const sortedParticipants = [...participants].sort((a, b) => b.stats.goldEarned - a.stats.goldEarned);
    return sortedParticipants.findIndex(p => p.participantId === participantId) + 1;
}

// 获取参团率排名
function getEngagementRank(participants, participantId) {
    const sortedParticipants = [...participants].sort((a, b) => {
        const aEngagement = (a.stats.kills + a.stats.assists) / (a.stats.kills + a.stats.assists + b.stats.deaths);
        const bEngagement = (b.stats.kills + b.stats.assists) / (b.stats.kills + b.stats.assists + b.stats.deaths);
        return bEngagement - aEngagement;
    });
    return sortedParticipants.findIndex(p => p.participantId === participantId) + 1;
}

// 获取视野得分排名
function getVisionRank(participants, participantId) {
    const sortedParticipants = [...participants].sort((a, b) => b.stats.visionScore - a.stats.visionScore);
    return sortedParticipants.findIndex(p => p.participantId === participantId) + 1;
}

// 判断是否是辅助位
function isSupportParticipant(participant) {
    return participant.timeline.role === "SUPPORT";
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
// 存储防抖计时器
export const debounceTimers = {};

// 防抖动函数
export function debounce(func, wait, id) {
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

// 格式化时间戳
export function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN');
}

// 格式化游戏时长
export function formatGameDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} 分 ${remainingSeconds} 秒`;
}

// 获取游戏模式名称
export function getGameMode(queueId) {
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
export function getChampionKey(championId) {
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
export function getSpellKey(spellId) {
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

// 格式化大数字 (例如：12345 -> 12.3K)
export function formatLargeNumber(num) {
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
} 
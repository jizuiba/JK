// 数据缓存
let dataCache = {};

// API模块
export const api = {
    // 默认超时时间
    timeout: 20000, // 20秒超时，可能存在网络问题
    
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
    }
};

// 清理过期缓存函数
export function cleanupExpiredCache() {
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
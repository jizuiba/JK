// 引入初始化模块
import { initializeApp } from './init.js';

// 全局变量（供其他模块访问）
window.currentMatchPage = 1; // 当前战绩页码
window.matchesPerPage = 7; // 每页显示的战绩数量
window.hasMoreMatches = true; // 是否有更多战绩

// 当DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', function() {
    // 初始化应用
    initializeApp();
});
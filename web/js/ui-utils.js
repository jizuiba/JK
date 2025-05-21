import { STRINGS } from './constants.js';

// Toast相关变量
let toastQueue = []; // 用于管理Toast队列
let isToastShowing = false; // 标记是否有Toast正在显示

// 显示提示消息
export function showToast(message, type = 'info') {
    // 将新的Toast添加到队列
    toastQueue.push({ message, type });

    // 如果没有Toast正在显示，则显示队列中的第一个
    if (!isToastShowing) {
        processToastQueue();
    }
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

// 更新连接状态显示
export function updateConnectionStatus(status, text) {
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    if (!statusIndicator || !statusText) return;
    
    statusIndicator.className = `status-indicator ${status}`;
    statusText.textContent = text;
} 
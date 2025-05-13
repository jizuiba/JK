const { app, BrowserWindow, Menu, Tray, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');
const isDev = require('electron-is-dev');
const fs = require('fs');

// 保持对窗口对象的全局引用，如果不这样做，
// 当JavaScript对象被垃圾回收时，窗口将自动关闭
let mainWindow;
let tray = null;
let pyProc = null;
let pyPort = null;

// 获取python可执行文件的路径
const getPythonPath = () => {
  if (isDev) {
    return 'python';
  }
  
  // 记录当前环境
  console.log('======= 开始查找Python可执行文件 =======');
  console.log(`应用目录: ${app.getAppPath()}`);
  console.log(`资源目录: ${process.resourcesPath}`);
  console.log(`当前工作目录: ${process.cwd()}`);
  
  // 检查资源目录结构
  try {
    const resourcesDir = process.resourcesPath;
    if (fs.existsSync(resourcesDir)) {
      console.log(`资源目录存在: ${resourcesDir}`);
      const items = fs.readdirSync(resourcesDir);
      console.log(`资源目录内容: ${items.join(', ')}`);
      
      // 检查dist_python目录
      const distPythonDir = path.join(resourcesDir, 'dist_python');
      if (fs.existsSync(distPythonDir)) {
        console.log(`dist_python目录存在: ${distPythonDir}`);
        const pythonFiles = fs.readdirSync(distPythonDir);
        console.log(`dist_python目录内容: ${pythonFiles.join(', ')}`);
      } else {
        console.log(`dist_python目录不存在: ${distPythonDir}`);
      }
      
      // 检查app目录
      const appDir = path.join(resourcesDir, 'app');
      if (fs.existsSync(appDir)) {
        console.log(`app目录存在: ${appDir}`);
        const appFiles = fs.readdirSync(appDir);
        console.log(`app目录内容: ${appFiles.join(', ')}`);
      } else {
        console.log(`app目录不存在或者是asar文件: ${appDir}`);
        
        // 检查app.asar文件
        const appAsarFile = path.join(resourcesDir, 'app.asar');
        if (fs.existsSync(appAsarFile)) {
          console.log(`app.asar文件存在: ${appAsarFile}`);
        }
      }
    } else {
      console.log(`资源目录不存在: ${resourcesDir}`);
    }
  } catch (err) {
    console.error(`检查目录结构时出错: ${err.message}`);
  }
  
  // 尝试多种可能的路径
  const possiblePaths = [
    // 资源目录中的Python可执行文件
    path.join(process.resourcesPath, 'dist_python', 'main.exe'),
    // app目录中的Python可执行文件
    path.join(process.resourcesPath, 'app', 'dist_python', 'main.exe'),
    // 原始预期路径
    path.join(process.resourcesPath, 'app', 'dist_python', 'main', 'main.exe'),
    // 使用app.getAppPath()的路径
    path.join(app.getAppPath(), '..', '..', 'dist_python', 'main.exe'),
    // 基于app.asar的路径
    path.join(process.resourcesPath, 'app.asar.unpacked', 'dist_python', 'main.exe'),
  ];
  
  // 记录所有可能的路径
  console.log('尝试查找Python可执行文件...');
  for (const p of possiblePaths) {
    const exists = fs.existsSync(p);
    console.log(`检查路径: ${p}, 存在: ${exists}`);
    if (exists) {
      console.log(`找到Python可执行文件: ${p}`);
      return p;
    }
  }
  
  // 递归搜索所有可能的可执行文件
  console.log('开始递归搜索可执行文件...');
  let foundExecutable = null;
  
  const findExecutableInDir = (dir, depth = 0, maxDepth = 3) => {
    if (depth > maxDepth || !fs.existsSync(dir)) return;
    
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            findExecutableInDir(fullPath, depth + 1, maxDepth);
          } else if (item === 'main.exe') {
            console.log(`找到可能的Python可执行文件: ${fullPath}`);
            foundExecutable = foundExecutable || fullPath;
          }
        } catch (e) {
          console.log(`无法访问: ${fullPath}, 错误: ${e.message}`);
        }
      }
    } catch (e) {
      console.log(`无法读取目录: ${dir}, 错误: ${e.message}`);
    }
  };
  
  findExecutableInDir(process.resourcesPath);
  
  if (foundExecutable) {
    console.log(`递归搜索找到Python可执行文件: ${foundExecutable}`);
    return foundExecutable;
  }
  
  // 如果没有找到,返回资源目录下的路径作为默认值
  console.log('未找到任何Python可执行文件,使用默认路径');
  return path.join(process.resourcesPath, 'dist_python', 'main.exe');
};

// 启动Python后端
const startPython = () => {
  if (pyProc) {
    return;
  }
  
  console.log("========== 开始启动Python后端 ==========");
  
  // 确定端口号
  pyPort = '5000';
  
  // 启动Python进程
  if (isDev) {
    // 开发模式
    pyProc = spawn('python', ['main.py', '--no-web']);
  } else {
    // 生产模式
    const pythonPath = getPythonPath();
    console.log(`使用Python可执行文件路径: ${pythonPath}`);
    
    if (!fs.existsSync(pythonPath)) {
      console.error(`Python可执行文件不存在: ${pythonPath}`);
      
      // 在资源目录中直接查找
      const directPath = path.join(process.resourcesPath, 'dist_python', 'main.exe');
      console.log(`尝试直接使用资源目录中的路径: ${directPath}`);
      
      if (fs.existsSync(directPath)) {
        console.log(`找到直接路径下的Python可执行文件!`);
        try {
          console.log(`启动Python进程: ${directPath} --no-web`);
          pyProc = spawn(directPath, ['--no-web']);
        } catch (err) {
          console.error(`启动Python进程失败: ${err.message}`);
          dialog.showErrorBox(
            '启动错误',
            `无法启动Python进程: ${err.message}\n路径: ${directPath}`
          );
          app.quit();
          return;
        }
      } else {
        console.error(`直接路径下也找不到Python可执行文件!`);
        dialog.showErrorBox(
          '启动错误',
          `找不到Python可执行文件:\n${pythonPath}\n${directPath}\n\n请确保应用已正确打包。`
        );
        app.quit();
        return;
      }
    } else {
      // 可执行文件存在，启动它
      console.log(`找到Python可执行文件，尝试启动: ${pythonPath}`);
      try {
        pyProc = spawn(pythonPath, ['--no-web']);
      } catch (err) {
        console.error(`启动Python进程失败: ${err.message}`);
        dialog.showErrorBox(
          '启动错误',
          `无法启动Python进程: ${err.message}\n路径: ${pythonPath}`
        );
        app.quit();
        return;
      }
    }
  }
  
  // 处理Python进程的输出
  pyProc.stdout.on('data', (data) => {
    console.log(`Python stdout: ${data}`);
  });
  
  pyProc.stderr.on('data', (data) => {
    console.error(`Python stderr: ${data}`);
  });
  
  pyProc.on('close', (code) => {
    console.log(`Python进程退出，退出码: ${code}`);
    pyProc = null;
    
    // 如果Python进程异常退出，提示用户并退出应用
    if (code !== 0 && !app.isQuitting) {
      dialog.showErrorBox(
        'Python进程错误',
        `Python进程意外退出，退出码: ${code}\n请重新启动应用。`
      );
      app.quit();
    }
  });
  
  // 等待500ms确保Python进程已启动
  return new Promise((resolve) => {
    setTimeout(resolve, 500);
  });
};

// 结束Python进程
const exitPyProc = () => {
  if (pyProc) {
    if (process.platform === 'win32') {
      // Windows平台下使用taskkill强制结束进程
      spawn('taskkill', ['/pid', pyProc.pid, '/f', '/t']);
    } else {
      pyProc.kill();
    }
    pyProc = null;
  }
};

// 创建主窗口
const createWindow = async () => {
  // 首先启动Python后端
  await startPython();
  
  // 创建preload.js文件而不是内嵌
  const preloadPath = path.join(app.getPath('temp'), 'preload.js');
  const preloadScript = `
    const { contextBridge, ipcRenderer } = require('electron');
    
    // 使用contextBridge公开安全的API
    contextBridge.exposeInMainWorld('electronAPI', {
      minimizeWindow: () => ipcRenderer.send('window-control', 'minimize'),
      closeWindow: () => ipcRenderer.send('window-control', 'close')
    });
    
    // 设置DOM加载完成后的事件监听
    document.addEventListener('DOMContentLoaded', () => {
      console.log('Preload脚本: DOM已加载，准备设置窗口控制按钮');
      
      // 等待元素可用
      const setupControls = () => {
        const minimizeBtn = document.getElementById('window-minimize-button');
        const closeBtn = document.getElementById('window-close-button');
        
        console.log('按钮状态:', {
          minimizeBtn: !!minimizeBtn,
          closeBtn: !!closeBtn
        });
        
        if (minimizeBtn) {
          minimizeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('点击最小化按钮');
            ipcRenderer.send('window-control', 'minimize');
          });
        }
        
        if (closeBtn) {
          closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('点击关闭按钮');
            ipcRenderer.send('window-control', 'close');
          });
        }
      };
      
      // 等待元素加载完成
      setTimeout(setupControls, 500);
      
      // 再次尝试，以防首次尝试失败
      setTimeout(setupControls, 1500);
    });
  `;
  
  fs.writeFileSync(preloadPath, preloadScript);
  
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    minWidth: 1400,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: preloadPath
    },
    icon: path.join(__dirname, 'web', 'assets', 'logo.png'),
    frame: false,
    transparent: false, // 禁用透明背景
    backgroundColor: '#F4F7FB', // 设置不透明背景色
    titleBarStyle: 'hidden',
    show: false,
    hasShadow: true,
    // 禁用窗口最大化
    maximizable: false,
    resizable: true
  });
  
  // 当窗口准备好时显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  
  // 加载应用
  const startUrl = url.format({
    pathname: 'localhost:' + pyPort + '/index.html',
    protocol: 'http:',
    slashes: true
  });
  
  // 将窗口控制方法暴露给渲染进程
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('页面加载完成');
    
    // 注入额外脚本以确保按钮绑定
    mainWindow.webContents.executeJavaScript(`
      console.log('注入额外控制脚本');
      
      // 手动设置按钮事件
      document.addEventListener('DOMContentLoaded', function() {
        console.log('手动设置窗口控制按钮');
        
        function setupWindowControls() {
          const minimizeBtn = document.getElementById('window-minimize-button');
          const closeBtn = document.getElementById('window-close-button');
          
          console.log('手动按钮状态:', {
            minimizeBtn: !!minimizeBtn,
            closeBtn: !!closeBtn,
            electronAPI: !!window.electronAPI
          });
          
          if (minimizeBtn && window.electronAPI) {
            minimizeBtn.onclick = function(e) {
              console.log('手动按钮点击 - 最小化');
              window.electronAPI.minimizeWindow();
              e.preventDefault();
              e.stopPropagation();
              return false;
            };
          }
          
          if (closeBtn && window.electronAPI) {
            closeBtn.onclick = function(e) {
              console.log('手动按钮点击 - 关闭');
              window.electronAPI.closeWindow();
              e.preventDefault();
              e.stopPropagation();
              return false;
            };
          }
          
          // 通过API请求添加事件监听
          fetch('/api/minimize_window', { method: 'POST' })
            .then(response => response.json())
            .then(data => console.log('API窗口控制响应:', data))
            .catch(err => console.error('API窗口控制请求失败:', err));
        }
        
        // 立即执行一次
        setupWindowControls();
        
        // 延迟执行以确保DOM完全加载
        setTimeout(setupWindowControls, 1000);
      });
      
      // 直接处理已存在的按钮
      setTimeout(function() {
        console.log('直接处理已存在的按钮');
        
        const minimizeBtn = document.getElementById('window-minimize-button');
        const closeBtn = document.getElementById('window-close-button');
        
        if (minimizeBtn && window.electronAPI) {
          minimizeBtn.onclick = function(e) {
            console.log('延迟按钮点击 - 最小化');
            window.electronAPI.minimizeWindow();
            e.preventDefault();
            e.stopPropagation();
            return false;
          };
        }
        
        if (closeBtn && window.electronAPI) {
          closeBtn.onclick = function(e) {
            console.log('延迟按钮点击 - 关闭');
            window.electronAPI.closeWindow();
            e.preventDefault();
            e.stopPropagation();
            return false;
          };
        }
      }, 1000);
      
      true;
    `).catch(err => {
      console.error('注入窗口控制API失败:', err);
    });
  });
  
  // 设置IPC通信以实现窗口控制
  ipcMain.on('window-control', (event, command) => {
    console.log(`收到窗口控制命令: ${command}`);
    if (command === 'minimize') {
      mainWindow.minimize();
    } else if (command === 'close') {
      // 直接退出应用程序，而不是仅隐藏窗口
      app.isQuitting = true;
      app.quit();
    }
  });
  
  mainWindow.loadURL(startUrl);
  
  // 创建托盘图标
  createTray();
  
  // 打开开发者工具
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  
  // 处理窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // 处理外部链接
  mainWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });
  
  // 当窗口关闭前先隐藏，避免显示关闭动画
  mainWindow.on('close', () => {
    // 注释掉下面的代码以允许窗口直接关闭
    // if (!app.isQuitting) {
    //   mainWindow.hide();
    // }
  });
};

// 创建系统托盘图标
const createTray = () => {
  tray = new Tray(path.join(__dirname, 'web', 'assets', 'logo.png'));
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: '显示窗口', 
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        }
      } 
    },
    { type: 'separator' },
    { 
      label: '退出', 
      click: () => {
        app.isQuitting = true;
        app.quit();
      } 
    }
  ]);
  
  tray.setToolTip('JK');
  tray.setContextMenu(contextMenu);
  
  // 点击托盘图标时显示窗口
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });
};

// 当Electron完成初始化并准备创建浏览器窗口时调用此方法
app.on('ready', createWindow);

// 所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  // 在macOS上保持应用运行，除非用户明确退出
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // 在macOS上当dock图标被点击且没有其他窗口打开时，
  // 通常会在应用程序中重新创建一个窗口
  if (mainWindow === null) {
    createWindow();
  }
});

// 应用退出前关闭Python进程
app.on('before-quit', () => {
  app.isQuitting = true;
  exitPyProc();
});

// 窗口关闭时隐藏而不是退出
app.on('browser-window-created', (_, window) => {
  // 注释掉下面的代码以允许窗口直接关闭
  // window.on('close', (event) => {
  //   if (!app.isQuitting) {
  //     event.preventDefault();
  //     window.hide();
  //     return false;
  //   }
  // });
}); 
# JK 英雄联盟玩家信息查询工具

JK是一款专为英雄联盟玩家设计的信息查询工具，使用Electron和Python技术栈开发，提供简洁直观的用户界面和基础的数据查询功能。

## 项目架构

JK采用以下技术栈：

- **前端**：HTML/CSS/JavaScript
- **后端**：Python + Flask
- **桌面应用**：Electron

## 安装与运行

### 开发环境

#### 前置条件
- Node.js 18+
- Python 3.13
- 英雄联盟客户端（用于实际数据查询）

#### 安装步骤

1. 克隆代码库
```bash
git clone https://github.com/jizuiba/JK.git
cd JK
```

2. 安装Node.js依赖
```bash
npm install
```

3. 安装Python依赖
```bash
pip install -r requirements.txt
```

#### 运行开发环境

1. 使用Python启动
```bash
python main.py
```
这将在http://localhost:5000启动Flask应用，并打开浏览器。

2. 使用Electron启动
```bash
npm start
```

### 构建

使用以下命令构建Windows可执行文件：

```bash
npm run build
```
可用参数：
- `--npm-path`：指定npm路径，一般来说指定npm路径就行了。可选指定`--node-path`来指定Node.js路径。
- `--electron-only`：仅构建Electron应用
- `--python-only`：仅构建Python应用
生成的安装包将位于`dist_new`目录下。

**注意事项**
- 使用NVM管理的Node.js版本可能会出现找不到npm的情况。
- 我们可以选择指定npm路径，例如：
```bash
python build.py --npm-path "E:\softwares\nvm\v19.8.0\npm.cmd"
```
不在命令中指定，也可以在build.py中的DEFAULT_NVM_PATHS中添加NVM的默认路径。

## 项目结构

```
JK/
├── main.py              # Python Flask后端入口
├── electron.js          # Electron主进程
├── web/                 # 前端资源
│   ├── index.html       # 主HTML文件
│   ├── css/             # 样式文件
│   ├── js/              # JavaScript文件
│   │   ├── app.js       # 应用入口文件
│   │   ├── init.js      # 应用初始化
│   │   ├── constants.js # 常量定义(STRINGS和IMAGE_URLS)
│   │   ├── utils.js     # 通用工具函数(防抖、格式化等)
│   │   ├── api.js       # API调用封装和缓存管理
│   │   ├── ui-utils.js  # UI相关工具(Toast消息)
│   │   ├── connection.js # 连接状态管理
│   │   ├── summoner.js  # 召唤师信息处理
│   │   ├── settings.js  # 设置页面功能(深色模式)
│   │   ├── navigation.js # 导航功能
│   │   ├── player-card.js # 玩家卡片功能
│   │   ├── match-history.js # 战绩历史记录功能
│   │   └── horse-tag.js # 玩家表现评级系统，基于多项游戏数据（KDA、伤害、参团率等）计算"牛马"等级
│   └── assets/          # 图像和其他资源
├── build.py             # 构建脚本
├── package.json         # Node.js包配置
└── requirements.txt     # Python依赖
```

## 模块化结构说明

前端JavaScript代码已进行模块化拆分，各模块职责如下：

| 模块文件 | 职责描述 |
|---------|---------|
| app.js | 应用入口，引导初始化过程 |
| init.js | 应用初始化，包括DOM加载后的初始设置 |
| constants.js | 常量定义，包括文本字符串和资源URL |
| utils.js | 通用工具函数，如日期格式化、防抖、游戏数据转换等 |
| api.js | API调用封装和缓存管理，处理所有后端请求 |
| ui-utils.js | UI相关工具，如Toast消息提示 |
| connection.js | 连接状态管理，监控与游戏客户端的连接 |
| summoner.js | 召唤师信息处理，包括获取和更新当前玩家信息 |
| settings.js | 设置页面功能，如深色模式切换 |
| navigation.js | 导航功能，处理页面间的切换 |
| player-card.js | 玩家卡片功能，显示玩家详细信息 |
| match-history.js | 战绩历史记录功能，加载和显示游戏记录 |
| horse-tag.js | 玩家表现评级系统，基于多项游戏数据（KDA、伤害、参团率等）计算"牛马"等级 |

## API说明

Flask后端提供了以下API端点：

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/check_lcu_connection` | GET | 检查与英雄联盟客户端的连接状态 |
| `/api/get_current_summoner` | GET | 获取当前登录的召唤师信息 |
| `/api/get_match_history` | GET | 获取指定召唤师的比赛历史 |
| ~~`/api/get_summoner_background`~~ | GET | ~~获取召唤师背景图~~ |
| `/api/minimize_window` | POST | 最小化应用窗口 |
| `/api/close_window` | POST | 关闭应用窗口 |

## 贡献指南

欢迎提交问题报告和拉取请求。对于重大变更，请先开issue讨论您想要更改的内容。

## 许可证

MIT 

## 模块化重构说明

本项目前端代码经过模块化重构，将原本集中在app.js和index.html中的代码按功能拆分为多个独立模块。这次重构带来以下好处：

1. **提高可维护性** - 每个模块职责单一，便于理解和修改
2. **代码复用** - 共享功能被抽取到专用模块，避免重复代码
3. **解耦合** - 模块间通过明确的导入/导出接口交互，降低耦合度
4. **并行开发** - 不同开发者可以同时处理不同模块
5. **按需加载** - 支持将来实现按需加载和代码分割优化

重构过程保持了原有功能的完整性，同时优化了部分代码实现，如异步函数的正确使用和性能优化。
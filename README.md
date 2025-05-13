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

### 构建生产版本

使用以下命令构建Windows可执行文件：

```bash
npm run build
```

生成的安装包将位于`dist_new`目录下。

## 项目结构

```
JK/
├── main.py              # Python Flask后端入口
├── electron.js          # Electron主进程
├── web/                 # 前端资源
│   ├── index.html       # 主HTML文件
│   ├── css/             # 样式文件
│   ├── js/              # JavaScript文件
│   └── assets/          # 图像和其他资源
├── build.py             # 构建脚本
├── package.json         # Node.js包配置
└── requirements.txt     # Python依赖
```

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
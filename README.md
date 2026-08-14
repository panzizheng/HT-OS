# HT OS

HT OS 是一个基于 TypeScript 与 Vite 开发的**网页操作系统**。它在浏览器中模拟了一套完整的桌面环境：窗口管理、桌面图标、任务栏、开始菜单、文件系统，以及一系列内置应用（记事本、浏览器、终端、办公、画图、音乐、视频、EPP 编译器等等）。

所有数据都通过浏览器本地存储（IndexedDB / localStorage）真正持久化，刷新页面后依然存在；也可配合内置的后端服务，把文件系统保存到服务器磁盘。

![HT OS 启动界面](public/assets/logo.svg)

## 功能特性

- **桌面环境**：网格排列的桌面图标（位置持久化）、壁纸、右键菜单、图标拖拽重排，支持把文件和文件夹在桌面与文件管理器之间互相拖拽
- **窗口管理**：拖动、调整大小、最大化 / 最小化 / 关闭，窗口切换
- **虚拟文件系统**：基于 IndexedDB 的完整目录树（Windows 风格结构），支持新建 / 移动 / 复制 / 重命名 / 删除 / 搜索
- **内置应用**
  - 记事本 / Markdown 编辑器
  - 浏览器（含下载管理器）
  - HT 办公（PDF 内联预览，Word / Excel / PPT 文件信息与下载）
  - 终端、注册表编辑器、服务管理器、任务管理器、事件查看器、启动项管理
  - 画图、照片查看器、计算器、天气、AI 助手
  - 音乐播放器、视频播放器
  - **EPP 编译器**：自带编程语言的编译与运行环境（见 [EPP 编程指南](docs/EPP_Programming_Guide.md)）
- **系统机制**：UAC 权限提醒、通知中心、搜索、语言切换、用户设置持久化、启动屏与登录界面

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | TypeScript 5、Vite 5、原生 DOM API |
| 文件系统 | IndexedDB（前端虚拟 FS）、Express + multer（后端网络 FS） |
| 后端 | Express、CORS、Session Cookie 用户隔离 |
| 持久化 | IndexedDB（文件）、localStorage（设置 / 布局） |

## 快速开始

需要 Node.js（建议 18+）。

```bash
# 安装依赖
npm install

# 启动前端开发服务器（默认 http://localhost:5173）
npm run dev

# 启动后端服务（端口 3001）
npm run server

# 同时启动前后端
npm start
```

> 说明：`npm run dev` 使用浏览器本地 IndexedDB 文件系统，无需后端即可体验核心功能；启动后端后文件可同步到服务器磁盘（每个浏览器会话相互隔离）。

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run server` | 启动 Express 后端（3001 端口） |
| `npm start` | 同时启动前后端 |
| `npm run build` | 类型检查 + 生产构建到 `dist/` |
| `npm run preview` | 预览生产构建 |

## 目录结构

```
ht-os/
├── src/                 # 前端源码
│   ├── apps/            # 内置应用（记事本、浏览器、音乐、EPP 编译器……）
│   │   └── epp/         # EPP 语言编译器 / 运行器核心
│   ├── desktop/         # 桌面、任务栏、开始菜单、启动屏、对话框
│   ├── wm/              # 窗口管理器
│   ├── fs/              # 文件系统（IndexedDB / 远程后端）
│   ├── kernel/          # 内核模块（事件总线、设置、注册表、服务、UAC……）
│   └── styles/          # 样式
├── server/              # Express 后端（网络文件系统）
├── public/assets/       # 图标与壁纸资源
├── docs/                # 文档（EPP 编程指南）
└── index.html
```

## 文档

- [EPP 编程规范和指南](docs/EPP_Programming_Guide.md)

## License

[MIT](LICENSE)

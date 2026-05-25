# 菠萝工具箱

面向个人创作者的一站式工具网站，基于 **Next.js 15** + **Tailwind CSS 4** 构建。

## 功能概览

| 工具 | 路径 |
|------|------|
| 图片变清晰 | `/tools/image-sharpen` |
| 压缩图片 | `/tools/image-compress` |
| AI 角色聊天 | `/tools/ai-chat` |
| 热点中心（抖音 / 小红书） | `/tools/hot-trends` |
| 影视资源搜索 | `/tools/media-search` |
| 制作爬虫 | `/tools/spider-builder` |
| 音乐转格式 | `/tools/music-convert` |
| 视频链接提取 | `/tools/video-extract` |
| AI 生视频 | `/tools/ai-video` |
| 智能抠图 | `/tools/smart-cutout` |
| 我的素材库 | `/tools/assets` |

当前为**前端演示版**，按钮与表单交互为模拟效果，未接入真实后端。

## 环境要求

- Node.js 18.17 或更高版本
- npm / yarn / pnpm

## 运行方式

### 方式一：一键启动（推荐）

```bash
cd /Users/bolo/pineapple-toolbox
chmod +x start.sh
./start.sh
```

### 方式二：手动命令

```bash
cd /Users/bolo/pineapple-toolbox
npm install    # 仅首次需要
npm run dev
```

浏览器打开 **[http://127.0.0.1:3000](http://127.0.0.1:3000)** 即可访问。

> ⚠️ **不能直接双击 HTML 文件**打开。必须在终端运行 `./start.sh`，看到「已启动」后再访问。

> 若出现 **Internal Server Error**：先按 `Ctrl+C` 停掉旧终端，再重新运行 `./start.sh`（脚本会自动关闭 3000 端口上的旧进程）。

> 项目使用**静态导出**，不依赖 `next start`，更稳定。已内置便携版 Node（`.node-portable`）。

### 打不开？常见原因

| 现象 | 解决办法 |
|------|----------|
| 浏览器显示「无法连接」 | 先运行 `./start.sh`，等终端出现 `Ready` 再刷新 |
| 提示 `command not found: npm` | 安装 [Node.js](https://nodejs.org)，或使用项目内 `./start.sh`（已内置便携 Node） |
| 端口被占用 | 换端口：`npm run dev -- -p 3001`，然后打开 http://localhost:3001 |

## 其他命令

```bash
npm run build   # 生产构建
npm run start   # 运行生产构建后的站点
npm run lint    # 代码检查
```

## 项目结构

```
src/
├── app/              # 页面路由
│   ├── page.tsx      # 首页
│   └── tools/        # 各工具子页面
├── components/       # 公共组件（导航、页脚、卡片等）
└── lib/tools.ts      # 工具元数据
```

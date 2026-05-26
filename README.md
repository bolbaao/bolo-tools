# 菠萝工具箱

面向个人创作者的一站式工具网站，基于 **Next.js 15** + **Tailwind CSS 4** 构建，配套 **Node.js API** 提供真实能力。

## 功能概览

| 工具 | 路径 | 实现方式 |
|------|------|----------|
| 图片变清晰 | `/tools/image-sharpen` | 浏览器 Canvas 锐化 |
| 压缩图片 | `/tools/image-compress` | 浏览器 Canvas 压缩 |
| 智能抠图 | `/tools/smart-cutout` | 浏览器 AI（@imgly/background-removal） |
| 闲聊对话 | `/tools/ai-chat` | 火山方舟 Ark API |
| 热点中心 | `/tools/hot-trends` | 服务端拉取热点 |
| 影视查找 | `/tools/media-search` | TMDB 搜索 · 热门 · 详情 |
| 制作爬虫 | `/tools/spider-builder` | 服务端 Cheerio 抓取 |
| 音乐转格式 | `/tools/music-convert` | 浏览器解锁 NCM/KGM/KWM/XM；ffmpeg 互转 |
| 视频链接提取 | `/tools/video-extract` | 抖音 / B 站 / YouTube / X / Telegram / Instagram 等 |
| AI 生视频 | `/tools/ai-video` | Replicate API（可选） |
| 我的素材库（隐藏入口） | `/tools/assets` | 双击导航栏「菠」+ 密码 |

## 环境要求

- Node.js 18.17+
- **ffmpeg**：音频格式互转（云音乐解锁不需要）→ `brew install ffmpeg`
- **酷狗解锁**：运行 `./scripts/download-kgm-mask.sh` 下载 `public/static/kgm.mask`
- **yt-dlp**（可选）：视频链接提取 → `brew install yt-dlp`

## 配置 API Key

复制环境变量模板并填写：

```bash
cp .env.example .env
```

| 变量 | 用途 | 是否必需 |
|------|------|----------|
| `ARK_API_KEY` | 闲聊对话（火山方舟） | 使用该功能时必需 |
| `ARK_BASE_URL` | API 地址（默认北京方舟 v3） | 可选 |
| `ARK_MODEL` | 模型 ID 或 `ep-xxx` 接入点 | 必需 |
| `TMDB_API_KEY` | 影视搜索 | 使用该功能时必需 |
| `REPLICATE_API_TOKEN` | AI 生视频 | 可选 |
| `ASSETS_PASSWORD` | 素材库访问密码 | 使用素材库时必需 |

### 闲聊对话：火山方舟

在 [火山方舟控制台](https://console.volcengine.com/ark) 获取 API Key 与模型 ID，写入 `.env`：

```bash
ARK_API_KEY=你的密钥
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_MODEL=doubao-1-5-pro-32k-250115
```

## 运行方式

### 一键启动（推荐）

```bash
./start.sh
```

脚本会：安装依赖 → 构建前端 → 启动 **静态站点 + API**（同端口 3000）

浏览器打开：**http://127.0.0.1:3000**

### 开发模式

```bash
npm install
npm run build
npm run start          # 前端 + API

# 或仅改前端时：
npm run dev            # 需另开终端运行 npm run dev:api 才能调 API
```

## 项目结构

```
src/                 # Next.js 前端
server/              # Express API
  routes/            # 各工具接口
  index.mjs          # 统一服务（静态 + API）
.env.example         # 环境变量模板
```

## 其他命令

```bash
npm run build        # 构建静态站点到 out/
npm run lint         # 代码检查
./stop.sh            # 停止 3000 端口服务
```

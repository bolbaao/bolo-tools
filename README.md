# 菠萝工具箱

面向个人创作者的一站式工具网站，基于 **Next.js 15** + **Tailwind CSS 4** 构建，配套 **Node.js API** 提供真实能力。

## 功能概览

| 工具 | 路径 | 实现方式 |
|------|------|----------|
| 图像工坊 | `/tools/image-studio` | 压缩 / 变清晰 / 抠图（本地）· 火山方舟 Seedream 文生图 |
| AI 对话 | `/tools/ai-chat` | DeepSeek · 闲聊为主，可操控工具 |
| 热点中心 | `/tools/hot-trends` | 抖音官方热搜 · 小红书探索页热门笔记 |
| 影视搜索 | `/tools/media-search` | 豆瓣+TMDB 并行检索 · 资源链接包 |
| 制作爬虫 | `/tools/spider-builder` | 服务端 Cheerio 抓取 |
| 音乐工坊 | `/tools/music-convert` | 本地解锁 NCM/KGM/KWM/XM · 批量转码 · ZIP |
| 视频链接提取 | `/tools/video-extract` | 抖音 / B 站 / YouTube / X / Telegram / Instagram 等 |
| 文档转换 | `/tools/doc-convert` | PDF↔Word（需 LibreOffice）· PDF→图片 · 图片→PDF |
| 字幕工坊 | `/tools/subtitle-workshop` | 本地 faster-whisper 语音转写 · 提取内嵌字幕 · 时间平移 |
| GIF 动图 | `/tools/gif-maker` | 视频片段 → GIF（ffmpeg） |
| 文本工具箱 | `/tools/text-toolbox` | 字数统计 · 去重 · JSON · Markdown 预览（本地） |
| 我的素材库（隐藏入口） | `/tools/assets` | 双击导航栏「菠」+ 密码 |

## 环境要求

- Node.js 18.17+
- **ffmpeg**：音频格式互转（云音乐解锁不需要）→ `brew install ffmpeg`
- **faster-whisper**（字幕工坊 · 本地语音转写）：`python3 -m pip install --user faster-whisper` 或运行 `./scripts/install-deps.sh`（首次转写会自动下载模型，无需 API Key）
- **LibreOffice**（可选，PDF ↔ Word）：下载到项目内、无需系统安装 → `./scripts/download-libreoffice.sh`，并在 `.env` 设置 `LIBREOFFICE_PATH=.local/LibreOffice.app/Contents/MacOS/soffice`（PDF 转图片、图片转 PDF 不需要）
- **酷狗解锁**：运行 `./scripts/download-kgm-mask.sh` 下载 `public/static/kgm.mask`
- **yt-dlp**（可选）：视频链接提取 → `brew install yt-dlp`

## 配置 API Key

复制环境变量模板并填写：

```bash
cp .env.example .env
```

| 变量 | 用途 | 是否必需 |
|------|------|----------|
| `DEEPSEEK_API_KEY` | AI 对话、AI 全网搜索摘要 | 使用该功能时必需 |
| `TAVILY_API_KEY` | AI 全网搜索（推荐） | 搜索时二选一 |
| `SERPER_API_KEY` | AI 全网搜索（Google 结果） | 搜索时二选一 |
| `DEEPSEEK_BASE_URL` | DeepSeek API（默认 `https://api.deepseek.com/v1`） | 可选 |
| `DEEPSEEK_MODEL` | 模型（默认 `deepseek-chat`） | 可选 |
| `TMDB_API_KEY` | 影视搜索 | 使用该功能时必需 |
| `ARK_API_KEY` | AI 对话（可选）、图片识别、图像工坊 · AI 生图 | 使用对应功能时必需 |
| `WHISPER_MODEL` | 字幕工坊 · 本地转写模型（默认 `base`） | 可选 |
| `OPENAI_API_KEY` | 字幕工坊 · 云端转写（本地不可用时的备选） | 可选 |
| `ASSETS_PASSWORD` | 素材库访问密码 | 使用素材库时必需 |

### AI 对话

默认优先 **DeepSeek**（大陆可直接用）。也支持 **ChatGPT（OpenAI 兼容 API）** 与火山方舟。

**DeepSeek（推荐，国内免代理）**

在 [DeepSeek 开放平台](https://platform.deepseek.com/api_keys) 获取 API Key：

```bash
DEEPSEEK_API_KEY=你的密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
```

**ChatGPT（大陆需代理或中转）**

1. 在 `.env` 中指定使用 OpenAI，并填入 Key（若已配置 DeepSeek，需注释掉 `DEEPSEEK_API_KEY` 或设置 `CHAT_PROVIDER=openai`）：

```bash
CHAT_PROVIDER=openai
OPENAI_API_KEY=sk-你的密钥
OPENAI_MODEL=gpt-4o-mini
```

2. 任选一种联网方式：

- **本机 VPN / Clash**：在 `.env` 增加（端口按客户端实际修改）  
  `HTTPS_PROXY=http://127.0.0.1:7890`  
  保持 `OPENAI_BASE_URL=https://api.openai.com/v1`
- **OpenAI 兼容中转**：将 `OPENAI_BASE_URL` 改为你购买的中转服务提供的 `https://xxx/v1` 地址（无需代理）

修改后重启 `./start.sh`。

**主打**轻松闲聊；**次要**在用户明确要求时充当智能助手（跳转工具、预填链接等）。

### AI 全网搜索

在 [Tavily](https://tavily.com) 或 [Serper](https://serper.dev) 申请 API Key（推荐 Tavily），并配置 `DEEPSEEK_API_KEY` 用于生成带引用的综合回答。工具入口：`/tools/ai-search`。

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

# 或仅改前端时（API 与前端分端口，避免与 start.sh 的 3000 冲突）：
npm run dev:all        # 推荐：同时启动 API(3001) + 前端(3002)
# 或手动：
npm run dev:api        # 终端 1：API http://127.0.0.1:3001
npm run dev            # 终端 2：前端 http://127.0.0.1:3002
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

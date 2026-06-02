# 开发者手册

面向部署与二次开发。普通使用说明见 [README.md](README.md)。

## 技术栈

- **Next.js 15** + **Tailwind CSS 4** 静态前端（`out/`）
- **Express** API（`server/`），与静态站点同端口提供服务
- 数据与账号：本地 JSON 文件（`data/users/`）

## 管理员账号

默认管理员在 `./start.sh` 启动时自动创建：

| 用户名 | 密码 |
|--------|------|
| `bolo` | `123456` |

手动创建或重置：

```bash
node scripts/create-admin-user.mjs bolo 123456
```

管理员登录后，站点顶部会显示「开发者手册」入口，并可访问 `/tools/admin` 用户管理。

## 环境要求

- Node.js 18.17+
- **ffmpeg**：音频格式互转（云音乐解锁不需要）→ `brew install ffmpeg`
- **faster-whisper**（字幕工坊 · 本地语音转写）：`python3 -m pip install --user faster-whisper` 或 `./scripts/install-deps.sh`
- **LibreOffice**（可选，PDF ↔ Word）：`./scripts/download-libreoffice.sh`，并在 `.env` 设置 `LIBREOFFICE_PATH=.local/LibreOffice.app/Contents/MacOS/soffice`
- **酷狗解锁**：`./scripts/download-kgm-mask.sh`
- **yt-dlp**（可选）：视频链接提取 → `brew install yt-dlp`

## 配置 API Key

```bash
cp .env.example .env
```

| 变量 | 用途 | 是否必需 |
|------|------|----------|
| `DEEPSEEK_API_KEY` | AI 对话、全网搜索摘要、做 App、写作、工作流 | 使用该功能时必需 |
| `TAVILY_API_KEY` | AI 全网搜索（推荐） | 搜索时二选一 |
| `SERPER_API_KEY` | AI 全网搜索（Google） | 搜索时二选一 |
| `DEEPSEEK_BASE_URL` | DeepSeek API（默认 `https://api.deepseek.com/v1`） | 可选 |
| `DEEPSEEK_MODEL` | 模型（默认 `deepseek-chat`） | 可选 |
| `ARK_API_KEY` | AI 对话（可选）、图片识别、图像工坊 · AI 生图、云端转写 | 使用对应功能时必需 |
| `WHISPER_MODEL` | 字幕工坊 · 本地转写模型（默认 `base`） | 可选 |
| `ASSETS_PASSWORD` | 素材库访问密码 | 使用素材库时必需 |
| `CONVERTAPI_SECRET` | PDF ↔ Word（ConvertAPI） | PDF↔Word 时必需 |

### AI 对话

默认优先 **DeepSeek**（大陆可直接用），也支持 **火山方舟**（`.env` 中 `CHAT_PROVIDER=ark`）。

### Cookie 与视频解析

详见 [cookies/README.md](cookies/README.md)。

## 运行方式

### 一键启动（推荐）

```bash
./start.sh
```

安装依赖 → 构建前端 → 启动静态站点 + API（端口 3000）。

### 开发模式

```bash
npm install
npm run build
npm run start          # 前端 + API

# 或前后端分端口（避免与 start.sh 的 3000 冲突）：
npm run dev:all        # API(3001) + 前端(3002)
npm run dev:api        # 仅 API http://127.0.0.1:3001
npm run dev            # 仅前端 http://127.0.0.1:3002
```

停止服务：`./stop.sh`

## 项目结构

```
src/                 # Next.js 前端
server/              # Express API
  routes/            # 各工具接口
  lib/               # 业务逻辑
  index.mjs          # 统一服务（静态 + API）
data/users/          # 用户与记忆数据
.env.example         # 环境变量模板
DEVELOPER.md         # 本文件
```

## 常用命令

```bash
npm run build        # 构建静态站点到 out/
npm run lint         # 代码检查
node scripts/create-admin-user.mjs [用户名] [密码]
```

## 功能与路径

| 工具 | 路径 | 实现方式 |
|------|------|----------|
| 图像工坊 | `/tools/image-studio` | 本地处理 + 火山方舟 Seedream |
| AI 对话 | `/tools/ai-chat` | DeepSeek / 火山方舟 |
| 一键做 App | `/tools/app-builder` | DeepSeek 生成单页 HTML |
| AI 写作助手 | `/tools/ai-writer` | DeepSeek |
| AI 工作流 | `/tools/ai-workflow` | DeepSeek 多步流水线 |
| 社媒一键分发 | `/tools/social-publish` | Playwright + Cookie |
| 热点中心 | `/tools/hot-trends` | 抖音 / 小红书抓取 |
| 影视搜索 | `/tools/media-search` | TMDB |
| 制作爬虫 | `/tools/spider-builder` | Cheerio |
| 音乐工坊 | `/tools/music-convert` | 本地解锁 + ffmpeg |
| 视频链接提取 | `/tools/video-extract` | yt-dlp |
| 文档转换 | `/tools/doc-convert` | ConvertAPI / 本地 PDF 处理 |
| 字幕工坊 | `/tools/subtitle-workshop` | faster-whisper / 云端 |
| AI 视频剪辑 | `/tools/ai-video-edit` | DeepSeek + ffmpeg + edge-tts |
| GIF 动图 | `/tools/gif-maker` | ffmpeg |
| 文本工具箱 | `/tools/text-toolbox` | 纯前端 |
| 用户管理 | `/tools/admin` | 管理员专用 |
| 素材库 | `/tools/assets` | 密码门控 |

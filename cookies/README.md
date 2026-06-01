# 抖音 Cookie — 尽量长期可用

抖音会定期让 Cookie 失效，**没有任何方法能 100% 永久有效**，但可以用下面方案**自动维护**，平时不用反复手配。

## 一次性配置（推荐）

在终端执行（Chrome 里先登录 [douyin.com](https://www.douyin.com)）：

```bash
chmod +x scripts/setup-douyin-cookies.sh
./scripts/setup-douyin-cookies.sh
```

脚本会：

1. 从 Chrome 导出 Cookie 到 `cookies/douyin.txt`
2. 在 `.env` 写入 `YTDLP_COOKIES=./cookies/douyin.txt`
3. 可选：安装 **每天 8:00 自动刷新** 的 macOS 计划任务

然后重新 `./start.sh`。

## 解析时自动策略

即使不配置 `.env`，服务端也会按顺序尝试：

1. `cookies/douyin.txt`（定时刷新后的文件）
2. Chrome / Safari / Edge 浏览器里的 Cookie

## 日常注意

| 做法 | 说明 |
|------|------|
| Chrome 保持登录抖音 | 自动刷新才有有效 Cookie |
| 偶尔仍失败 | 再运行一次 `./scripts/setup-douyin-cookies.sh` |
| 更新 yt-dlp | `pip3 install -U yt-dlp` |
| 从浏览器读 Cookie 失败 | 完全退出 Chrome（Cmd+Q）后再解析，或依赖 cookies.txt |

## 手动方式

`.env` 中可设置：

```bash
YTDLP_COOKIES=./cookies/douyin.txt
# 或
YTDLP_COOKIES_FROM_BROWSER=chrome
```

---

# 微信视频号 Cookie（腾讯元宝 · Safari）

依赖 [腾讯元宝](https://yuanbao.tencent.com)，需 Safari 登录后导出 Cookie。

## 一键配置

```bash
chmod +x scripts/setup-yuanbao-cookies.sh
./scripts/setup-yuanbao-cookies.sh --install-cron
```

脚本会：

1. 从 **Safari** 导出 Cookie 到 `cookies/yuanbao.txt`
2. 在 `.env` 写入 `YUANBAO_SPH_COOKIES` 与 `YUANBAO_COOKIES_FROM_BROWSER=safari`
3. 安装 **每天 8:05 自动刷新** 的 macOS 计划任务

**前提**：Safari 已打开并登录 https://yuanbao.tencent.com

### 自动维护策略

| 时机 | 行为 |
|------|------|
| `./start.sh` 启动时 | 从浏览器重新导出 `cookies/yuanbao.txt` |
| 每天 8:05 | launchd 计划任务自动刷新 |
| 视频号解析失败时 | 服务端自动从浏览器重试导出并重试解析 |

## 日常注意

| 做法 | 说明 |
|------|------|
| Safari 保持登录元宝 | 自动刷新才有有效 Cookie |
| 偶尔仍失败 | 再运行 `./scripts/setup-yuanbao-cookies.sh` |
| 终端需磁盘权限 | 系统设置 → 隐私 → 完全磁盘访问 → 勾选终端/Cursor |

## 手动复制

1. Safari 打开 https://yuanbao.tencent.com 并登录  
2. 开发 → 显示 Web 检查器 → Network → 刷新  
3. 点任意 `yuanbao.tencent.com` 请求 → Headers → 复制 **Cookie**  
4. 写入 `.env`：`YUANBAO_SPH_COOKIE=粘贴内容`  
   或保存到 `cookies/yuanbao.txt` 并设置 `YUANBAO_SPH_COOKIES=./cookies/yuanbao.txt`

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

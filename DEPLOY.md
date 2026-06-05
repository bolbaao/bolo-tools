# 云服务器部署

将春雨集部署到 Linux 云主机。**不要在 Mac 上打包 `node_modules` 再上传**——原生模块（ffmpeg、sharp 等）必须与服务器 CPU 架构一致。

---

## 腾讯云 + 宝塔面板（推荐流程）

适用于腾讯云 CVM / 轻量应用服务器，并已安装 [宝塔 Linux 面板](https://www.bt.cn/)。

### 1. 腾讯云安全组

登录 [腾讯云控制台](https://console.cloud.tencent.com/) → 云服务器 → 安全组 → **入站规则**：

| 端口 | 说明 |
|------|------|
| 80 | HTTP（宝塔网站） |
| 443 | HTTPS |
| 8888 | 宝塔面板（若从外网访问面板） |
| 22 | SSH（建议仅你的 IP） |

**一般不必对外开放 3000**：用户通过域名访问，由宝塔 Nginx 反代到本机 `127.0.0.1:3000` 即可。

### 2. 本机打 Linux 包（Mac + Docker）

```bash
cd pineapple-toolbox
./scripts/pack-for-server.sh --docker --full
```

得到 `dist/pineapple-toolbox-*-linux-amd64.tar.gz`。

### 3. 上传到服务器

任选其一：

- **宝塔「文件」**：进入例如 `/www/wwwroot/`，新建目录 `chunyu`，上传 `tar.gz` → 右键「解压」
- **SFTP / 终端**：`scp dist/*.tar.gz root@公网IP:/www/wwwroot/chunyu/`

解压后目录应包含 `start-server.sh`、`server/`、`out/`、`node_modules/` 等。

### 4. 宝塔安装运行环境

**软件商店** 安装（若未装）：

1. **Nginx**（网站反代）
2. **Node.js 版本管理器**（或「PM2 管理器」）→ 安装 **Node.js 18 或 20**
3. **Python 项目管理器** 非必须；本项目 Python 已打在 `.local/python-venv` 里

**终端**（宝塔左侧「终端」或 SSH）进入项目目录：

```bash
cd /www/wwwroot/chunyu    # 以你实际路径为准
cp .env.example .env
```

用宝塔「文件」在线编辑 `.env`，至少设置：

```bash
HOST=127.0.0.1
PORT=3000
APP_BASE_URL=https://你的域名
COOKIE_SECURE=true
USER_SESSION_SECRET=请填一串随机长字符
ADMIN_USERNAME=管理员名
ADMIN_PASSWORD=强密码
ASSETS_PASSWORD=素材库密码
# 以及 DEEPSEEK_API_KEY 等，见 .env.example
```

说明：对外用 Nginx 时，`HOST=127.0.0.1` 即可（仅本机反代访问，更安全）。若暂时用 `http://公网IP:3000` 测试，可改为 `HOST=0.0.0.0`，并在宝塔「安全」中放行 3000。

初始化管理员（终端执行一次）：

```bash
node scripts/ensure-admin-user.mjs
```

### 5. 用 PM2 常驻运行（宝塔）

**方式 A — PM2 管理器（最简单）**

1. 软件商店 → **PM2 管理器** → 设置  
2. **添加项目**  
   - 项目名称：`chunyu`  
   - 启动文件：选择项目里的 `start-server.sh`  
   - 项目路径：`/www/wwwroot/chunyu`  
   - 运行用户：`www`（与网站一致即可）  
3. 保存并 **启动**

**方式 B — 网站 → Node 项目**

部分宝塔版本有「Node 项目」：路径填 `/www/wwwroot/chunyu`，启动命令：

```bash
bash /www/wwwroot/chunyu/start-server.sh
```

端口填 `3000`。

**方式 C — 终端手动 PM2**

```bash
cd /www/wwwroot/chunyu
npm install -g pm2    # 若未装
pm2 start start-server.sh --name chunyu
pm2 save
pm2 startup           # 按提示执行，开机自启
```

确认本机可访问：

```bash
curl -s http://127.0.0.1:3000/api/health
```

### 6. 宝塔添加网站 + 反向代理

1. **网站** → **添加站点**  
   - 域名：你的域名（已解析到该服务器公网 IP）  
   - 根目录可随意（例如 `/www/wwwroot/chunyu`），**不要**用 PHP 模式跑本项目  
2. 站点设置 → **反向代理** → 添加反向代理  
   - 代理名称：`chunyu`  
   - 目标 URL：`http://127.0.0.1:3000`  
   - 发送域名：`$host`  
   - 勾选「启用代理」  
3. **SSL** → Let's Encrypt 申请证书 → 强制 HTTPS  
4. 把 `.env` 里 `APP_BASE_URL` 改成 `https://你的域名`，`COOKIE_SECURE=true`，在 PM2 里 **重启** 项目

**上传大小**：工具会上传视频/图片，在站点 **配置文件** 中加大限制，例如：

```nginx
client_max_body_size 512m;
proxy_read_timeout 600s;
proxy_send_timeout 600s;
```

（放在 `server { ... }` 内，保存后重载 Nginx。）

### 7. 宝塔防火墙

**安全** → 放行 **80、443**（若用 IP:3000 测试再放行 3000）。

### 8. 常见问题（宝塔）

| 现象 | 处理 |
|------|------|
| 外网打不开域名 | 查腾讯云安全组 80/443、域名解析 A 记录、PM2 是否在跑 |
| 502 Bad Gateway | PM2 未启动或端口不是 3000；`curl http://127.0.0.1:3000/api/health` |
| 登录后掉线 / Cookie 无效 | `APP_BASE_URL` 与浏览器地址一致；HTTPS 时 `COOKIE_SECURE=true` |
| 上传失败 / 413 | Nginx 加大 `client_max_body_size` |
| 字幕/口播报错 | 确认包为 `--docker` 构建，或服务器执行过 `./scripts/install-deps-linux.sh --full` |
| PDF↔Word 不可用 | `.env` 配置 `CONVERTAPI_SECRET`，或完整包含 `.local/libreoffice` |

视频平台 Cookie 需在服务器维护 `cookies/*.txt`，见 [cookies/README.md](cookies/README.md)（无法用本机 Safari 自动导出）。

### 9. 3D 工坊 · 模型打包上传（约 2.7GB）

3D 生成**单独打一个模型包**上传（不要和 Mac 的 `mlsharp-venv` 一起打包，Linux 上需重新装运行时）。

**在你 Mac 上**（需已执行过 `./scripts/download-mlsharp-3d-maker.sh`）：

```bash
./scripts/pack-mlsharp-3d.sh
```

生成 `dist/mlsharp-3d-model-*.tar.gz`（约 2.7GB，仅权重，不含 Windows 的 5GB+ `python_env`）。

**宝塔上传**：

1. 先把站点主程序部署到 `/www/wwwroot/chunyu`
2. 宝塔 **文件** → 进入 `chunyu` → 上传 `mlsharp-3d-model-*.tar.gz`（大文件可断点/分批，或先用 `scp`）
3. **终端**：

```bash
cd /www/wwwroot/chunyu
bash scripts/unpack-mlsharp-3d.sh mlsharp-3d-model-20250603.tar.gz   # 换成实际文件名
```

脚本会解压到 `.local/mlsharp-3d-maker/` 并自动执行 `install-mlsharp-linux.sh`（下载 PyTorch、ML-Sharp，约 10–20 分钟，需联网）。

**腾讯云 GPU 实例**（有 NVIDIA 显卡时，生成更快）：

```bash
export MLSHARP_CUDA=1
bash scripts/unpack-mlsharp-3d.sh mlsharp-3d-model-*.tar.gz
```

`.env` 可增加（有 GPU 时预览视频）：

```bash
MLSHARP3D_FORCE_RENDER=1
```

安装完成后在 PM2 管理器 **重启** `chunyu`，打开站点「3D 工坊」测试。

| 步骤 | 说明 |
|------|------|
| 本机 `pack-mlsharp-3d.sh` | 精简模型包，适合上传 |
| 服务器 `unpack-mlsharp-3d.sh` | 解压 + 安装 Linux 版 sharp |
| 勿上传 Mac 版 `mlsharp-venv` | 架构不兼容，体积也大 |
| `--full` 打包 | 仅当你要原样迁移整个 8GB+ 目录 |

---

## 方式一：Docker 一键打完整包（在 Mac 上操作）

需要已安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)。

```bash
# 标准包：Node 依赖 + 前端构建 + yt-dlp/ffmpeg/Python 虚拟环境
./scripts/pack-for-server.sh --docker

# 大包：另含 LibreOffice（PDF↔Word）+ Whisper 语音模型
./scripts/pack-for-server.sh --docker --full
```

生成文件在 `dist/pineapple-toolbox-*-linux-amd64.tar.gz`。

上传到服务器：

```bash
scp dist/pineapple-toolbox-*-linux-amd64.tar.gz user@你的服务器:/opt/
ssh user@你的服务器
cd /opt && mkdir -p chunyu && tar -xzf pineapple-toolbox-*-linux-amd64.tar.gz -C chunyu --strip-components=1
cd chunyu   # 进入解压后的目录（名称以实际为准）
cp .env.example .env
nano .env   # 填写 API Key，见下方「生产环境 .env」
./start-server.sh
```

浏览器访问：宝塔用户请用域名 + 反向代理（见上文）；临时测试可用 `http://公网IP:3000`（需放行 3000）。

## 方式二：只传源码，在服务器上安装

适合服务器能访问 npm / GitHub / HuggingFace 镜像。

**本机打包：**

```bash
./scripts/pack-for-server.sh
```

**服务器：**

```bash
sudo apt update
sudo apt install -y nodejs npm curl python3 python3-venv xz-utils   # Node 建议 18+，可用 nvm 安装更新版

tar -xzf pineapple-toolbox-*-source.tar.gz -C /opt/chunyu
cd /opt/chunyu
cp .env.example .env && nano .env

npm ci
npm run build
./scripts/install-deps-linux.sh --full
./start-server.sh
```

## 方式三：在 Linux 本机直接打完整包

```bash
./scripts/install-deps-linux.sh --full
npm ci && npm run build
./scripts/pack-for-server.sh --bundle
```

## 生产环境 .env 要点

```bash
HOST=0.0.0.0
PORT=3000
APP_BASE_URL=https://你的域名
COOKIE_SECURE=true                    # HTTPS 站点
USER_SESSION_SECRET=随机长字符串       # 必设
ALLOW_PUBLIC_API=0                    # 公网建议保持 0，需登录再调 API
ADMIN_USERNAME=你的管理员名
ADMIN_PASSWORD=强密码
ASSETS_PASSWORD=素材库密码
# DEEPSEEK_API_KEY、ARK_API_KEY 等按功能填写，见 .env.example
```

PDF↔Word：配置 `CONVERTAPI_SECRET`，或确保已运行 `./scripts/install-deps-linux.sh` 且存在 `.local/libreoffice/`。

视频解析：在服务器上手动维护 `cookies/douyin.txt` 等（无法从 Safari 自动导出），见 [cookies/README.md](cookies/README.md)。

## systemd 常驻（可选）

`/etc/systemd/system/chunyu.service`：

```ini
[Unit]
Description=春雨集
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/chunyu
EnvironmentFile=/opt/chunyu/.env
ExecStart=/opt/chunyu/start-server.sh
Restart=on-failure
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now chunyu
```

## 体积与可选组件

| 组件 | 约大小 | 安装方式 |
|------|--------|----------|
| Node + 前端 | ~500MB | `npm ci` + `npm run build` |
| yt-dlp / ffmpeg | ~80MB | `install-deps-linux.sh` |
| Python 虚拟环境 | ~200MB | 同上 |
| LibreOffice | ~250MB | `--full` 或 `--with-libreoffice` |
| Whisper base 模型 | ~150MB | `--with-whisper-model` |
| MLSharp 3D 权重 | ~2.7GB | `./scripts/pack-mlsharp-3d.sh` 上传后 `unpack-mlsharp-3d.sh` |
| MLSharp 运行时 | ~2GB+ | 在服务器上 `install-mlsharp-linux.sh` 自动安装 |

## 架构说明

- **x86_64（amd64）**：`--docker` 默认目标，最常见云主机。
- **ARM（aarch64）**：在 ARM 服务器上不要用 `--docker`（那是 amd64 镜像）；请用方式二/三在**本机架构**执行 `install-deps-linux.sh` 与 `npm ci`。

更多开发说明见 [DEVELOPER.md](DEVELOPER.md)。

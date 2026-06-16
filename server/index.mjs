import "./lib/env.mjs";
import { env } from "./lib/env.mjs";
import { describeAiStack } from "./lib/chat-config.mjs";
import { ensureAdminUser, getAuthUserFromRequest } from "./lib/user-auth.mjs";
import {
  apiRateLimit,
  authRateLimit,
  heavyApiRateLimit,
  requireAuthIfPublic,
  validateSecurityConfig,
} from "./lib/security.mjs";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import audioRouter from "./routes/audio.mjs";
import videoRouter from "./routes/video.mjs";
import mediaRouter from "./routes/media.mjs";
import webVideoRouter from "./routes/web-video.mjs";
import trendsRouter from "./routes/trends.mjs";
import assetsRouter from "./routes/assets.mjs";
import documentsRouter from "./routes/documents.mjs";
import subtitleRouter from "./routes/subtitle.mjs";
import gifRouter from "./routes/gif.mjs";
import arkImageRouter from "./routes/ark-image.mjs";
import aiSearchRouter from "./routes/ai-search.mjs";
import chatRouter from "./routes/chat.mjs";
import feedbackRouter from "./routes/feedback.mjs";
import authRouter from "./routes/auth.mjs";
import memoryRouter from "./routes/memory.mjs";
import homeBackgroundRouter from "./routes/home-background.mjs";
import adminRouter from "./routes/admin.mjs";
import aiWriterRouter from "./routes/ai-writer.mjs";
import storyboardRouter from "./routes/storyboard.mjs";
import mlsharp3dRouter from "./routes/mlsharp-3d.mjs";
import socialPublishRouter from "./routes/social-publish.mjs";
import { startUserMediaCleanupInterval } from "./lib/user-media-library.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "out");
const OUT_ROOT = path.resolve(OUT_DIR);
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function isPathUnderRoot(resolved, root) {
  return resolved === root || resolved.startsWith(root + path.sep);
}

function resolveFile(urlPath) {
  let p = decodeURIComponent(urlPath.split("?")[0]);
  if (!p || p.includes("\0") || /\.\./.test(p)) return null;
  p = p.replace(/^\/+/, "");
  if (!p || p.endsWith("/")) p = `${p || ""}index.html`;

  const candidates = [
    p,
    `${p.replace(/\.html$/, "")}.html`,
    path.join(p, "index.html"),
  ];

  for (const rel of candidates) {
    const resolved = path.resolve(OUT_ROOT, rel);
    if (!isPathUnderRoot(resolved, OUT_ROOT)) continue;
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
  }

  const fallback = path.resolve(OUT_ROOT, "404.html");
  return isPathUnderRoot(fallback, OUT_ROOT) && fs.existsSync(fallback) ? fallback : null;
}

const API_ONLY = process.env.API_ONLY === "1" || process.env.API_ONLY === "true";
const hasOut = fs.existsSync(OUT_DIR);

if (!hasOut && !API_ONLY) {
  console.error("❌ 未找到 out 目录，请先运行: npm run build");
  console.error("   开发 API 可运行: npm run dev:api");
  process.exit(1);
}

try {
  validateSecurityConfig();
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    res.status(413).json({
      ok: false,
      error: "上传内容过大，请减少图片数量或换用更小的图片后重试",
    });
    return;
  }
  next(err);
});

app.get("/api/health", (req, res) => {
  const user = getAuthUserFromRequest(req);
  if (user?.isAdmin) {
    const aiStack = describeAiStack();
    res.json({
      ok: true,
      service: "pineapple-toolbox-api",
      mode: API_ONLY || !hasOut ? "api-only" : "full",
      features: {
        auth: true,
        memory: true,
        imageVision: aiStack.vision.configured,
      },
      aiStack,
    });
    return;
  }
  res.json({ ok: true, service: "pineapple-toolbox-api" });
});

app.use("/api/auth", authRateLimit, authRouter);
app.use("/api/feedback", apiRateLimit, feedbackRouter);
app.use("/api/trends", apiRateLimit, trendsRouter);
app.use("/api/assets", apiRateLimit, assetsRouter);
app.use("/api/memory", memoryRouter);
app.use("/api/home-background", apiRateLimit, homeBackgroundRouter);
app.use("/api/admin", adminRouter);

app.use("/api/audio", requireAuthIfPublic, heavyApiRateLimit, audioRouter);
app.use("/api/video", requireAuthIfPublic, heavyApiRateLimit, videoRouter);
app.use("/api/media", requireAuthIfPublic, heavyApiRateLimit, mediaRouter);
app.use("/api/web-video", requireAuthIfPublic, heavyApiRateLimit, webVideoRouter);
app.use("/api/documents", requireAuthIfPublic, heavyApiRateLimit, documentsRouter);
app.use("/api/subtitle", requireAuthIfPublic, heavyApiRateLimit, subtitleRouter);
app.use("/api/gif", requireAuthIfPublic, heavyApiRateLimit, gifRouter);
app.use("/api/ark-image", requireAuthIfPublic, heavyApiRateLimit, arkImageRouter);
app.use("/api/mlsharp-3d", requireAuthIfPublic, heavyApiRateLimit, mlsharp3dRouter);
app.use("/api/ai-search", requireAuthIfPublic, heavyApiRateLimit, aiSearchRouter);
app.use("/api/chat", requireAuthIfPublic, heavyApiRateLimit, chatRouter);
app.use("/api/ai-writer", requireAuthIfPublic, heavyApiRateLimit, aiWriterRouter);
app.use("/api/storyboard", heavyApiRateLimit, storyboardRouter);
app.use("/api/social-publish", requireAuthIfPublic, heavyApiRateLimit, socialPublishRouter);

if (hasOut && !API_ONLY) {
  app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ ok: false, error: "接口不存在" });
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.status(404).json({ ok: false, error: "Not Found" });
      return;
    }
    const file = resolveFile(req.path);
    if (!file) {
      res.status(403).end("Forbidden");
      return;
    }
    const ext = path.extname(file);
    const contentType = MIME[ext] || "application/octet-stream";
    fs.stat(file, (err, stat) => {
      if (err) {
        res.status(404).end("Not Found");
        return;
      }
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", stat.size);
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      fs.createReadStream(file).pipe(res);
    });
  });
} else {
  app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ ok: false, error: "接口不存在" });
      return;
    }
    res.status(404).json({ ok: false, error: "开发模式仅提供 API，请访问 Next 开发服（npm run dev）" });
  });
}

try {
  const adminName = env("ADMIN_USERNAME", "bolo");
  const adminPass = env("ADMIN_PASSWORD", "123456");
  const admin = ensureAdminUser(adminName, adminPass);
  if (admin.created) {
    console.log(`✓ 已创建管理员账号: ${adminName}`);
  } else if (admin.promoted) {
    console.log(`✓ 已将 ${adminName} 设为管理员（保留原密码）`);
  }
} catch (err) {
  console.warn(`⚠️ 管理员账号初始化失败: ${err.message}`);
}

app.listen(PORT, HOST, () => {
  startUserMediaCleanupInterval();
  const stack = describeAiStack();
  if (API_ONLY || !hasOut) {
    console.log(`🍍 API 开发服务: http://${HOST}:${PORT}/api/health`);
  } else {
    console.log(`春雨集 已启动: http://${HOST}:${PORT}`);
    console.log(`   API: http://${HOST}:${PORT}/api/health`);
  }
  console.log(
    `   AI 文案: ${stack.chat.configured ? stack.chat.label : "未配置"} (${stack.chat.envKey ?? "—"})`,
  );
  console.log(
    `   图像识别: ${stack.vision.configured ? stack.vision.label : "未配置"} (${stack.vision.envKey ?? "—"})`,
  );
});

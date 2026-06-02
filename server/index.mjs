import "./lib/env.mjs";
import { env } from "./lib/env.mjs";
import { describeAiStack } from "./lib/chat-config.mjs";
import { ensureAdminUser } from "./lib/user-auth.mjs";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import chatRouter from "./routes/chat.mjs";
import audioRouter from "./routes/audio.mjs";
import videoRouter from "./routes/video.mjs";
import mediaRouter from "./routes/media.mjs";
import spiderRouter from "./routes/spider.mjs";
import trendsRouter from "./routes/trends.mjs";
import assetsRouter from "./routes/assets.mjs";
import documentsRouter from "./routes/documents.mjs";
import subtitleRouter from "./routes/subtitle.mjs";
import gifRouter from "./routes/gif.mjs";
import arkImageRouter from "./routes/ark-image.mjs";
import aiSearchRouter from "./routes/ai-search.mjs";
import feedbackRouter from "./routes/feedback.mjs";
import authRouter from "./routes/auth.mjs";
import memoryRouter from "./routes/memory.mjs";
import chatHistoryRouter from "./routes/chat-history.mjs";
import adminRouter from "./routes/admin.mjs";
import appBuilderRouter from "./routes/app-builder.mjs";
import aiWriterRouter from "./routes/ai-writer.mjs";
import aiWorkflowRouter from "./routes/ai-workflow.mjs";
import aiVideoEditRouter from "./routes/ai-video-edit.mjs";
import socialPublishRouter from "./routes/social-publish.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "out");
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

function resolveFile(urlPath) {
  let p = decodeURIComponent(urlPath.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(OUT_DIR, p);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  const htmlAlt = path.join(OUT_DIR, p + ".html");
  if (fs.existsSync(htmlAlt)) return htmlAlt;
  const indexInDir = path.join(OUT_DIR, p, "index.html");
  if (fs.existsSync(indexInDir)) return indexInDir;
  return path.join(OUT_DIR, "404.html");
}

const API_ONLY = process.env.API_ONLY === "1" || process.env.API_ONLY === "true";
const hasOut = fs.existsSync(OUT_DIR);

if (!hasOut && !API_ONLY) {
  console.error("❌ 未找到 out 目录，请先运行: npm run build");
  console.error("   开发 API 可运行: npm run dev:api");
  process.exit(1);
}

const app = express();
const jsonDefault = express.json({ limit: "2mb" });
const jsonChat = express.json({ limit: "15mb" });
app.use((req, res, next) => {
  if (req.method === "POST" && req.path.startsWith("/api/chat")) {
    return jsonChat(req, res, next);
  }
  return jsonDefault(req, res, next);
});

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

app.get("/api/health", (_req, res) => {
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
});

app.use("/api/chat", chatRouter);
app.use("/api/audio", audioRouter);
app.use("/api/video", videoRouter);
app.use("/api/media", mediaRouter);
app.use("/api/spider", spiderRouter);
app.use("/api/trends", trendsRouter);
app.use("/api/assets", assetsRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/subtitle", subtitleRouter);
app.use("/api/gif", gifRouter);
app.use("/api/ark-image", arkImageRouter);
app.use("/api/ai-search", aiSearchRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/auth", authRouter);
app.use("/api/memory", memoryRouter);
app.use("/api/chat-history", chatHistoryRouter);
app.use("/api/admin", adminRouter);
app.use("/api/app-builder", appBuilderRouter);
app.use("/api/ai-writer", aiWriterRouter);
app.use("/api/ai-workflow", aiWorkflowRouter);
app.use("/api/ai-video-edit", aiVideoEditRouter);
app.use("/api/social-publish", socialPublishRouter);

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
    if (!file.startsWith(OUT_DIR)) {
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
    console.log(`✓ 已创建管理员账号: ${adminName} / ${adminPass}`);
  } else if (admin.promoted) {
    console.log(`✓ 已将 ${adminName} 设为管理员（保留原密码）`);
  }
} catch (err) {
  console.warn(`⚠️ 管理员账号初始化失败: ${err.message}`);
}

app.listen(PORT, HOST, () => {
  const stack = describeAiStack();
  if (API_ONLY || !hasOut) {
    console.log(`🍍 API 开发服务: http://${HOST}:${PORT}/api/health`);
  } else {
    console.log(`春雨集 已启动: http://${HOST}:${PORT}`);
    console.log(`   API: http://${HOST}:${PORT}/api/health`);
  }
  console.log(
    `   AI 对话: ${stack.chat.configured ? stack.chat.label : "未配置"} (${stack.chat.envKey ?? "—"})`,
  );
  console.log(
    `   AI 识图: ${stack.vision.configured ? stack.vision.label : "未配置"} (${stack.vision.envKey ?? "—"})`,
  );
});

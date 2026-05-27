import "./lib/env.mjs";
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
import xaiImageRouter from "./routes/xai-image.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "out");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
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
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "pineapple-toolbox-api", mode: API_ONLY || !hasOut ? "api-only" : "full" });
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
app.use("/api/xai-image", xaiImageRouter);

if (hasOut && !API_ONLY) {
  app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ ok: false, error: "接口不存在" });
      return;
    }
    if (req.method !== "GET") {
      res.status(404).json({ ok: false, error: "Not Found" });
      return;
    }
    const file = resolveFile(req.path);
    if (!file.startsWith(OUT_DIR)) {
      res.status(403).end("Forbidden");
      return;
    }
    const ext = path.extname(file);
    fs.readFile(file, (err, data) => {
      if (err) {
        res.status(404).end("Not Found");
        return;
      }
      res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
      res.end(data);
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

app.listen(PORT, HOST, () => {
  if (API_ONLY || !hasOut) {
    console.log(`🍍 API 开发服务: http://${HOST}:${PORT}/api/health`);
  } else {
    console.log(`🍍 菠萝工具箱 已启动: http://${HOST}:${PORT}`);
    console.log(`   API: http://${HOST}:${PORT}/api/health`);
  }
});

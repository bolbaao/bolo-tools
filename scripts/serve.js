#!/usr/bin/env node
/**
 * 静态文件服务器 — 无需 next start，避免 Internal Server Error
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const HOST = "127.0.0.1";
const OUT_DIR = path.join(__dirname, "..", "out");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};

function send(res, status, body, type) {
  res.writeHead(status, { "Content-Type": type || "text/plain" });
  res.end(body);
}

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

if (!fs.existsSync(OUT_DIR)) {
  console.error("❌ 未找到 out 目录，请先运行: npm run build");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const file = resolveFile(req.url || "/");
  const ext = path.extname(file);

  if (!file.startsWith(OUT_DIR)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      const fallback = path.join(OUT_DIR, "404.html");
      fs.readFile(fallback, (e2, d2) => {
        if (e2) send(res, 404, "Not Found");
        else send(res, 404, d2, MIME[".html"]);
      });
      return;
    }
    send(res, 200, data, MIME[ext] || "application/octet-stream");
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ 端口 ${PORT} 已被占用。请先运行: ./stop.sh`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log(`🍍 菠萝工具箱 已启动: http://${HOST}:${PORT}`);
});

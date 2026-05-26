import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..", "..");
const COOKIE_FILE = path.join(PROJECT_ROOT, "cookies", "douyin.txt");
const EXPORT_SCRIPT = path.join(PROJECT_ROOT, "scripts", "export-douyin-cookies.py");

/** 从 Safari/Chrome 等重新导出 cookies/douyin.txt */
export function refreshDouyinCookies() {
  return new Promise((resolve) => {
    if (!fs.existsSync(EXPORT_SCRIPT)) {
      resolve(false);
      return;
    }

    const browser = env("YTDLP_COOKIES_FROM_BROWSER") || "safari";
    const proc = spawn("python3", [EXPORT_SCRIPT], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, DOUYIN_BROWSER: browser },
    });

    let ok = false;
    proc.on("close", (code) => {
      ok =
        code === 0 &&
        fs.existsSync(COOKIE_FILE) &&
        fs.statSync(COOKIE_FILE).size > 80;
      resolve(ok);
    });
    proc.on("error", () => resolve(false));
  });
}

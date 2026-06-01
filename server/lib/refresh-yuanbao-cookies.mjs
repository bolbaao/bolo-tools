import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..", "..");
const COOKIE_FILE = path.join(PROJECT_ROOT, "cookies", "yuanbao.txt");
const EXPORT_SCRIPT = path.join(PROJECT_ROOT, "scripts", "export-yuanbao-cookies.py");

/** 从浏览器重新导出 cookies/yuanbao.txt */
export function refreshYuanbaoCookies() {
  return new Promise((resolve) => {
    if (!fs.existsSync(EXPORT_SCRIPT)) {
      resolve(false);
      return;
    }

    const browser = env("YUANBAO_COOKIES_FROM_BROWSER") || env("YTDLP_COOKIES_FROM_BROWSER") || "safari";
    const proc = spawn("python3", [EXPORT_SCRIPT], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, YUANBAO_COOKIES_FROM_BROWSER: browser },
    });

    proc.on("close", (code) => {
      const ok =
        code === 0 &&
        fs.existsSync(COOKIE_FILE) &&
        fs.statSync(COOKIE_FILE).size > 80;
      resolve(ok);
    });
    proc.on("error", () => resolve(false));
  });
}

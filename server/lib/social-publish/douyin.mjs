import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { env } from "../env.mjs";
import { refreshDouyinCookies } from "../refresh-douyin-cookies.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..", "..", "..");
const DOUYIN_PUBLISH_SCRIPT = path.join(PROJECT_ROOT, "scripts", "douyin_publish.py");

/** 抖音是否走全自动（默认开启，可用 SOCIAL_PUBLISH_DOUYIN_AUTO=0 关闭） */
export function isDouyinAutomationEnabled(opts = {}) {
  if (opts.douyinAuto === false) return false;
  if (opts.douyinAuto === true) return true;
  if (env("SOCIAL_PUBLISH_DOUYIN_AUTO", "1") !== "1") return false;
  return true;
}

export function getDouyinPublishHint() {
  const headed = env("SOCIAL_PUBLISH_HEADED", "1") === "1";
  return [
    "抖音默认可全自动：上传视频、填写标题与正文后即可发布",
    headed
      ? "首次使用若需要登录，会弹出浏览器，按提示登录创作者中心后重试即可"
      : "无界面模式需先完成账号登录配置，请按站点说明操作",
  ].join("；");
}

export async function refreshDouyinCookiesIfNeeded() {
  if (env("DOUYIN_PUBLISH_REFRESH_COOKIES", "1") !== "1") return false;
  return refreshDouyinCookies();
}

export function runDouyinPublish(jobDirPath) {
  return new Promise(async (resolve) => {
    if (!fs.existsSync(DOUYIN_PUBLISH_SCRIPT)) {
      resolve({ ok: false, error: "未找到 scripts/douyin_publish.py" });
      return;
    }

    await refreshDouyinCookiesIfNeeded();

    const browsersPath =
      env("PLAYWRIGHT_BROWSERS_PATH") || path.join(PROJECT_ROOT, ".local", "ms-playwright");
    const child = spawn("python3", [DOUYIN_PUBLISH_SCRIPT, "--job-dir", jobDirPath], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: browsersPath,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });

    const timeoutMs =
      Number(env("DOUYIN_PUBLISH_TIMEOUT_MS", env("SOCIAL_PUBLISH_TIMEOUT_MS", "900000"))) ||
      900000;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ ok: false, error: "抖音自动发布超时（视频较大时可增大 DOUYIN_PUBLISH_TIMEOUT_MS）" });
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      const line = stdout.trim().split("\n").filter(Boolean).pop();
      if (line) {
        try {
          const parsed = JSON.parse(line);
          resolve(parsed);
          return;
        } catch {
          /* fall through */
        }
      }
      if (code === 0) {
        resolve({ ok: true, message: stdout.trim() || "抖音发布完成" });
      } else {
        resolve({
          ok: false,
          error: (stderr || stdout || `退出码 ${code}`).trim().slice(0, 800),
        });
      }
    });
  });
}

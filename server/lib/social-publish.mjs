import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import OpenAI from "openai";
import { fileURLToPath } from "url";
import { HttpError } from "./http-error.mjs";
import { env } from "./env.mjs";
import { getChatProviderLabel, resolveChatConfig } from "./chat-config.mjs";
import { getAccountStatus } from "./social-publish/accounts.mjs";
import {
  getDouyinPublishHint,
  isDouyinAutomationEnabled,
  runDouyinPublish,
} from "./social-publish/douyin.mjs";
import { createJobId, jobDir, writeJob, readJob } from "./social-publish/jobs.mjs";
import {
  SOCIAL_PUBLISH_PLATFORMS,
  getPlatform,
  listPlatformIds,
  normalizePlatformIds,
} from "./social-publish/platforms.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..", "..");
const PUBLISH_SCRIPT = path.join(PROJECT_ROOT, "scripts", "social_publish.py");

export const MAX_PUBLISH_VIDEO_MB = Number(env("SOCIAL_PUBLISH_MAX_MB", "512")) || 512;

function isOtherPlatformAutomationEnabled() {
  return env("SOCIAL_PUBLISH_AUTOMATION", "0") === "1";
}

function isPlatformAutomationEnabled(platformId, opts = {}) {
  if (platformId === "douyin") return isDouyinAutomationEnabled(opts);
  return isOtherPlatformAutomationEnabled();
}

export function getSocialPublishCapabilities() {
  const automation = isOtherPlatformAutomationEnabled();
  const douyinAuto = isDouyinAutomationEnabled();
  const accounts = Object.values(SOCIAL_PUBLISH_PLATFORMS).map((p) => ({
    ...getAccountStatus(p),
    label: p.label,
    creatorUrl: p.creatorUrl,
    contentTypes: p.contentTypes,
  }));
  return {
    platforms: Object.values(SOCIAL_PUBLISH_PLATFORMS).map((p) => ({
      id: p.id,
      label: p.label,
      contentTypes: p.contentTypes,
      creatorUrl: p.creatorUrl,
      titleMax: p.titleMax,
      descMax: p.descMax,
    })),
    accounts,
    aiConfigured: Boolean(resolveChatConfig()),
    automationEnabled: automation,
    douyinAutoEnabled: douyinAuto,
    douyinAutoHint: getDouyinPublishHint(),
    automationHint: douyinAuto
      ? `抖音：${getDouyinPublishHint()}`
      : automation
        ? "已开启多平台自动发布（实验功能）"
        : "除抖音外，其它平台以辅助发布为主；抖音全自动默认开启",
  };
}

/**
 * @param {{ title: string, description: string, tags?: string, platforms: string[], captions?: Record<string,string> }} opts
 */
export async function adaptCaptionsForPlatforms(opts) {
  const chatConfig = resolveChatConfig();
  if (!chatConfig) {
    throw new HttpError(503, "未配置 AI（DEEPSEEK_API_KEY 或 ARK_API_KEY），无法生成各平台文案");
  }
  const platforms = normalizePlatformIds(opts.platforms);
  if (!platforms.length) throw new HttpError(400, "请至少选择一个发布平台");

  const title = opts.title?.trim() || "";
  const description = opts.description?.trim() || "";
  if (!title && !description) throw new HttpError(400, "请填写标题或正文");

  const client = new OpenAI({
    apiKey: chatConfig.apiKey,
    baseURL: chatConfig.baseURL,
    timeout: 120000,
    maxRetries: 0,
  });

  const captions = { ...(opts.captions || {}) };
  const provider = getChatProviderLabel(chatConfig.provider);

  for (const platformId of platforms) {
    if (captions[platformId]?.trim()) continue;
    const platform = getPlatform(platformId);
    const completion = await client.chat.completions.create({
      model: chatConfig.model,
      messages: [
        {
          role: "system",
          content:
            "你是中文新媒体运营。根据用户提供的统一素材，为指定平台改写标题与正文。只输出 JSON，格式：{\"title\":\"...\",\"description\":\"...\"}，不要 markdown 代码块或其它说明。",
        },
        {
          role: "user",
          content: [
            `平台：${platform.label}`,
            platform.adaptHint,
            `标题上限约 ${platform.titleMax} 字，正文上限约 ${platform.descMax} 字`,
            opts.tags?.trim() ? `建议话题/标签：${opts.tags.trim()}` : "",
            "",
            "统一标题：",
            title || "（无）",
            "",
            "统一正文：",
            description || "（无）",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      temperature: 0.55,
      max_tokens: 1024,
    });
    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    let parsed = { title: title.slice(0, platform.titleMax), description: description };
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      parsed = { title: title || platform.label, description: raw || description };
    }
    captions[platformId] = JSON.stringify({
      title: String(parsed.title ?? title).slice(0, platform.titleMax),
      description: String(parsed.description ?? description).slice(0, platform.descMax),
    });
  }

  return { captions, provider };
}

function parseCaptionEntry(entry, platform) {
  if (!entry) return { title: "", description: "" };
  try {
    const o = JSON.parse(entry);
    return {
      title: String(o.title ?? "").slice(0, platform.titleMax),
      description: String(o.description ?? "").slice(0, platform.descMax),
    };
  } catch {
    return { title: "", description: String(entry) };
  }
}

function runPlaywrightPublish(jobDirPath, platformId) {
  return new Promise((resolve) => {
    if (!fs.existsSync(PUBLISH_SCRIPT)) {
      resolve({ ok: false, error: "未找到 scripts/social_publish.py" });
      return;
    }
    const child = spawn(
      "python3",
      [PUBLISH_SCRIPT, "--job-dir", jobDirPath, "--platform", platformId],
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    const timeoutMs = Number(env("SOCIAL_PUBLISH_TIMEOUT_MS", "600000")) || 600000;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ ok: false, error: "自动发布超时" });
    }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        try {
          const line = stdout.trim().split("\n").pop();
          resolve(JSON.parse(line));
        } catch {
          resolve({ ok: true, message: stdout.trim() || "发布完成" });
        }
      } else {
        resolve({
          ok: false,
          error: (stderr || stdout || `退出码 ${code}`).trim().slice(0, 500),
        });
      }
    });
  });
}

/**
 * @param {{ title: string, description: string, tags?: string, platforms: string[], captions?: Record<string,string>, videoPath?: string | null, videoName?: string }} opts
 */
export async function runSocialPublish(opts) {
  const platforms = normalizePlatformIds(opts.platforms);
  if (!platforms.length) throw new HttpError(400, "请至少选择一个发布平台");

  const title = opts.title?.trim() || "";
  const description = opts.description?.trim() || "";
  if (!title && !description) throw new HttpError(400, "请填写标题或正文");

  const douyinOnlyAuto = isDouyinAutomationEnabled(opts);
  const otherAutomation = isOtherPlatformAutomationEnabled();
  if (platforms.includes("douyin") && douyinOnlyAuto && !opts.videoPath) {
    throw new HttpError(400, "抖音全自动发布需要上传视频文件");
  }
  let captions = opts.captions || {};
  const missingAdapt = platforms.some((id) => !captions[id]?.trim());
  if (missingAdapt && resolveChatConfig()) {
    const adapted = await adaptCaptionsForPlatforms({
      title,
      description,
      tags: opts.tags,
      platforms,
      captions,
    });
    captions = adapted.captions;
  }

  const jobId = createJobId();
  const dir = jobDir(jobId);
  fs.mkdirSync(dir, { recursive: true });

  let videoFile = null;
  if (opts.videoPath && fs.existsSync(opts.videoPath)) {
    const ext = path.extname(opts.videoName || opts.videoPath) || ".mp4";
    videoFile = `video${ext}`;
    fs.copyFileSync(opts.videoPath, path.join(dir, videoFile));
  }

  const job = {
    id: jobId,
    createdAt: new Date().toISOString(),
    title,
    description,
    tags: opts.tags?.trim() || "",
    platforms,
    captions,
    videoFile,
    mode: douyinOnlyAuto || otherAutomation ? "automate" : "assist",
    douyinAuto: douyinOnlyAuto,
  };
  writeJob(job);

  const results = [];

  for (const platformId of platforms) {
    const platform = getPlatform(platformId);
    const account = getAccountStatus(platform);
    const cap = parseCaptionEntry(captions[platformId], platform);
    const platformAuto = isPlatformAutomationEnabled(platformId, opts);
    const needsVideo = platform.needsVideoForAuto && !videoFile;

    if (needsVideo && platformAuto) {
      results.push({
        platformId,
        label: platform.label,
        status: "skipped",
        mode: "assist",
        creatorUrl: platform.creatorUrl,
        title: cap.title,
        description: cap.description,
        message: "自动发布需要上传视频文件",
      });
      continue;
    }

    const tryAuto =
      platformAuto &&
      videoFile &&
      (account.ready || (platformId === "douyin" && douyinOnlyAuto));
    if (tryAuto) {
      const auto =
        platformId === "douyin"
          ? await runDouyinPublish(dir)
          : await runPlaywrightPublish(dir, platformId);
      if (auto.ok) {
        results.push({
          platformId,
          label: platform.label,
          status: "published",
          mode: "automate",
          message: auto.message || "已提交创作者中心发布",
          url: auto.url,
        });
        continue;
      }
      results.push({
        platformId,
        label: platform.label,
        status: "failed",
        mode: "automate",
        creatorUrl: platform.creatorUrl,
        title: cap.title,
        description: cap.description,
        message: auto.error || "自动发布失败",
        fallbackAssist: true,
      });
      continue;
    }

    results.push({
      platformId,
      label: platform.label,
      status: account.ready ? "ready" : "needs_login",
      mode: "assist",
      creatorUrl: platform.creatorUrl,
      title: cap.title || title,
      description: cap.description || description,
      accountHint: account.hint,
      message: account.ready
        ? "文案已就绪：请打开创作者中心，粘贴标题与描述后上传视频并发布"
        : account.hint,
    });
  }

  const updated = {
    ...job,
    results,
    completedAt: new Date().toISOString(),
  };
  writeJob(updated);

  const published = results.filter((r) => r.status === "published").length;
  const ready = results.filter((r) => r.status === "ready").length;

  return {
    jobId,
    results,
    summary:
      published > 0
        ? `${published} 个平台已自动提交，${ready} 个待你在创作者中心确认`
        : ready > 0
          ? `${ready} 个平台文案已生成，请按提示打开创作者中心完成发布`
          : "请按各平台提示配置登录后重试",
    captions,
  };
}

export function parseCaptionsField(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

export { listPlatformIds };
export { isDouyinAutomationEnabled, getDouyinPublishHint, runDouyinPublish } from "./social-publish/douyin.mjs";

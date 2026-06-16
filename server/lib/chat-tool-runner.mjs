import { AGENT_TOOLS } from "../../shared/agent-tools.mjs";
import { generateAppHtml } from "./app-builder.mjs";
import { generateWriting } from "./ai-writer.mjs";
import { synthesizeSearchAnswer } from "./ai-search-synthesize.mjs";
import { runWorkflow } from "./ai-workflow.mjs";
import {
  generateArkImage,
  editArkImage,
  beautifyArkImage,
  eraseArkImage,
  removeWatermarkArkImage,
  replaceBackgroundArkImage,
} from "./ark-image.mjs";
import { extractTextFromImageDataUrl } from "./photo-vision.mjs";
import { HttpError } from "./http-error.mjs";
import {
  buildAgentImageFetchPlan,
  runImageFetchPlan,
  wantsXiaohongshuImageSource,
} from "./chat-image-intent.mjs";
import { normalizePlatformIds } from "./image-search.mjs";
import { generatePptx } from "./ppt-generate.mjs";
import { formatMediaSearchReply } from "./chat-media-intent.mjs";
import { formatResourceNotFound, formatSearchNotFound } from "../../shared/public-error.mjs";
import { assertSearchAllowed, searchMediaResources } from "./media-resource-fetch.mjs";
import { fetchTrends, formatHeat } from "./trends-fetch.mjs";
import { searchWebWithUnderstanding } from "./web-search-understand.mjs";
import { extractVerifiedVideoByUrl } from "./video-extract-service.mjs";
import { runSpider, SPIDER_PRESETS } from "./spider-run.mjs";
import { adaptCaptionsForPlatforms, runSocialPublish } from "./social-publish.mjs";
import { addUserMemory, listUserMemories, formatMemoriesForPrompt } from "./user-memory.mjs";
import {
  putChatArtifact,
  formatArtifactLink,
  formatArtifactImageReply,
} from "./chat-tool-artifacts.mjs";
import { getLatestChatUpload } from "./user-media-library.mjs";
import {
  pickFirstRaw,
  pickRawFiles,
  getImageDataUrl,
  convertAudioFile,
  makeGifFromVideo,
  runDocConvert,
  compressImageFile,
  transcribeMediaFile,
  extractEmbeddedSubtitle,
} from "./chat-tool-media.mjs";
import fs from "fs";
import os from "os";
import path from "path";

function pickField(fields, keys, fallback = "") {
  for (const key of keys) {
    const val = String(fields?.[key] ?? "").trim();
    if (val) return val;
  }
  return String(fallback || "").trim();
}

/** 当前请求无附件时，复用最近一次对话上传的文件 */
export function resolveToolRawFiles(context = {}) {
  const raw = (Array.isArray(context.rawFiles) ? context.rawFiles : []).filter(
    (f) => f?.buffer?.length,
  );
  if (raw.length) return raw;
  const cached = getLatestChatUpload(context.userId, ["video", "audio", "image"]);
  return cached ? [cached] : [];
}

function formatVideoExtractResult(data) {
  const lines = [
    `**${data.title}**`,
    data.uploader ? `作者：${data.uploader}` : "",
    data.duration ? `时长：${Math.round(data.duration)} 秒` : "",
    "",
    "**下载链接**",
  ].filter(Boolean);

  for (const f of data.formats.slice(0, 6)) {
    lines.push(`- ${f.resolution} · ${f.ext} → [点击下载](${f.downloadUrl})`);
  }

  if (data.verified) {
    lines.push("", `_✓ 已通过大模型检索与平台内容校验_`);
  }
  return lines.join("\n");
}

function formatSearchResult(query, summary, results) {
  if (!summary && !results?.length) {
    return formatSearchNotFound(query);
  }
  const lines = [summary || "暂时无法生成摘要，请查看下方参考来源。", ""];
  if (results?.length) {
    lines.push("**参考来源**");
    for (const [i, r] of results.slice(0, 6).entries()) {
      lines.push(`${i + 1}. [${r.title}](${r.url})`);
    }
  }
  return lines.join("\n");
}

function formatHotTrends(platform, list) {
  const label = platform === "xiaohongshu" ? "小红书" : "抖音";
  const lines = [`**${label}热点榜**`, ""];
  for (const [i, item] of (list || []).slice(0, 15).entries()) {
    const heat = item.heat ? ` · ${formatHeat(item.heat)}` : "";
    const tag = item.tag ? ` · ${item.tag}` : "";
    lines.push(`${i + 1}. ${item.title}${heat}${tag}`);
  }
  return lines.join("\n");
}

function runTextToolbox(fields, fallbackText) {
  const tab = pickField(fields, ["tab"], "stats");
  const input = pickField(fields, ["input"], fallbackText);
  if (!input) throw new HttpError(400, "请提供待处理文本");

  if (tab === "dedupe") {
    const lines = input.split("\n");
    const seen = new Set();
    const out = [];
    for (const line of lines) {
      const key = line.trim();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(line);
    }
    return `**去重结果**\n\n\`\`\`\n${out.join("\n")}\n\`\`\``;
  }

  if (tab === "json") {
    try {
      const parsed = JSON.parse(input);
      return `**JSON 格式化**\n\n\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\``;
    } catch (e) {
      throw new HttpError(400, e instanceof Error ? e.message : "JSON 解析失败");
    }
  }

  if (tab === "markdown") {
    const preview = input.slice(0, 2000);
    return `**Markdown 预览**（原文 ${input.length} 字）\n\n\`\`\`markdown\n${preview}${input.length > 2000 ? "\n…" : ""}\n\`\`\``;
  }

  const trimmed = input.trim();
  const words = (trimmed.match(/[\u4e00-\u9fff]|[a-zA-Z0-9]+/g) || []).length;
  return [
    "**文本统计**",
    "",
    `- 字符数：${input.length}`,
    `- 不含空格：${input.replace(/\s/g, "").length}`,
    `- 词数：${words}`,
    `- 行数：${trimmed ? trimmed.split("\n").length : 0}`,
    `- 段落：${trimmed ? trimmed.split(/\n\s*\n/).filter(Boolean).length : 0}`,
  ].join("\n");
}

function formatSpiderResult(data) {
  const lines = [`**${data.pageTitle}**`, ""];
  for (const [i, item] of data.items.slice(0, 25).entries()) {
    lines.push(item.link ? `${i + 1}. [${item.title}](${item.link})` : `${i + 1}. ${item.title}`);
  }
  if (!data.items.length) lines.push("_暂未抓取到内容，可换网址或关键词重试_");
  return lines.join("\n");
}

function formatWorkflowResult(result) {
  const lines = ["**工作流已完成**", ""];
  for (const step of result.results || []) {
    lines.push(`### ${step.stepTitle}`, "", step.output, "");
  }
  return lines.join("\n").trim();
}

function formatSocialAdapt(captions, platforms) {
  const lines = ["**各平台文案已生成**", ""];
  for (const id of platforms) {
    try {
      const o = JSON.parse(captions[id] || "{}");
      lines.push(`**${id}**`, `- 标题：${o.title || "—"}`, `- 正文：${(o.description || "—").slice(0, 300)}`, "");
    } catch {
      lines.push(`**${id}**`, captions[id] || "—", "");
    }
  }
  return lines.join("\n");
}

function formatSocialPublishResult(data) {
  const lines = [data.summary || "发布任务已处理", ""];
  for (const r of data.results || []) {
    lines.push(`- **${r.label}**：${r.message || r.status}`);
    if (r.url) lines.push(`  ${r.url}`);
  }
  return lines.join("\n");
}

async function runImageStudio(fields, context) {
  const mode = pickField(fields, ["mode"], "generate") || "generate";
  const prompt = pickField(fields, ["prompt"], context.lastUserMessage);

  if (mode === "generate") {
    if (!prompt) throw new HttpError(400, "请描述要生成的画面");
    const result = await generateArkImage({ prompt, aspectRatio: "1:1", resolution: "1k" });
    if (result.imageBase64) {
      const id = putChatArtifact({
        buffer: Buffer.from(result.imageBase64, "base64"),
        filename: `generated-${Date.now()}.png`,
        contentType: result.mimeType || "image/png",
      });
      return formatArtifactImageReply("图片已生成", id, "生成的图片");
    }
    if (result.imageUrl) {
      return `**图片已生成**\n\n![生成的图片](${result.imageUrl})`;
    }
    throw new HttpError(502, "未返回图片");
  }

  const imageDataUrl = getImageDataUrl(context.chatFiles, context.rawFiles);
  if (!imageDataUrl) throw new HttpError(400, "请上传图片附件");

  if (mode === "beautify") {
    const result = await beautifyArkImage({
      imageDataUrl,
      level: pickField(fields, ["level"], "standard") || "standard",
    });
    if (result.imageBase64) {
      const id = putChatArtifact({
        buffer: Buffer.from(result.imageBase64, "base64"),
        filename: `beautify-${Date.now()}.png`,
        contentType: result.mimeType || "image/png",
      });
      return formatArtifactImageReply("人像美化完成", id, "美化结果");
    }
    if (result.imageUrl) {
      return `**人像美化完成**\n\n![美化结果](${result.imageUrl})`;
    }
    throw new HttpError(502, "未返回图片");
  }

  if (mode === "watermark") {
    const result = await removeWatermarkArkImage({
      imageDataUrl,
      level: pickField(fields, ["level"], "standard") || "standard",
    });
    if (result.imageBase64) {
      const id = putChatArtifact({
        buffer: Buffer.from(result.imageBase64, "base64"),
        filename: `watermark-${Date.now()}.png`,
        contentType: result.mimeType || "image/png",
      });
      return formatArtifactImageReply("水印已去除", id, "去水印结果");
    }
    if (result.imageUrl) {
      return `**水印已去除**\n\n![去水印结果](${result.imageUrl})`;
    }
    throw new HttpError(502, "未返回图片");
  }

  if (mode === "bgreplace") {
    const bgPrompt = prompt || pickField(fields, ["backgroundPrompt"], "简洁干净的纯色背景");
    const result = await replaceBackgroundArkImage({
      imageDataUrl,
      backgroundPrompt: bgPrompt,
    });
    if (result.imageBase64) {
      const id = putChatArtifact({
        buffer: Buffer.from(result.imageBase64, "base64"),
        filename: `bg-${Date.now()}.png`,
        contentType: result.mimeType || "image/png",
      });
      return formatArtifactImageReply("背景已替换", id, "换背景结果");
    }
    if (result.imageUrl) {
      return `**背景已替换**\n\n![换背景结果](${result.imageUrl})`;
    }
    throw new HttpError(502, "未返回图片");
  }

  if (mode === "edit" || mode === "cutout") {
    const editPrompt =
      mode === "cutout"
        ? "去除背景，只保留主体，输出干净透明或纯白背景"
        : prompt || "按用户要求修图";
    const result = await editArkImage({ prompt: editPrompt, imageDataUrl, resolution: "2k" });
    if (result.imageBase64) {
      const id = putChatArtifact({
        buffer: Buffer.from(result.imageBase64, "base64"),
        filename: `${mode}-${Date.now()}.png`,
        contentType: result.mimeType || "image/png",
      });
      const title = mode === "cutout" ? "抠图完成" : "修图完成";
      const alt = mode === "cutout" ? "抠图结果" : "修图结果";
      return formatArtifactImageReply(title, id, alt);
    }
    if (result.imageUrl) {
      return `**处理完成**\n\n![处理结果](${result.imageUrl})`;
    }
    throw new HttpError(502, "未返回图片");
  }

  if (mode === "compress") {
    const file = pickFirstRaw(context.rawFiles, ["image"]);
    if (!file) throw new HttpError(400, "请上传图片");
    const r = await compressImageFile(file, Number(fields.quality) || 80);
    return r.text;
  }

  if (mode === "sharpen") {
    const result = await editArkImage({
      prompt: "提升清晰度与细节，适度锐化，保持自然",
      imageDataUrl,
      resolution: "2k",
    });
    if (result.imageBase64) {
      const id = putChatArtifact({
        buffer: Buffer.from(result.imageBase64, "base64"),
        filename: `sharpen-${Date.now()}.png`,
        contentType: result.mimeType || "image/png",
      });
      return formatArtifactImageReply("清晰化完成", id, "清晰化结果");
    }
    if (result.imageUrl) {
      return `**清晰化完成**\n\n![清晰化结果](${result.imageUrl})`;
    }
    throw new HttpError(502, "未返回图片");
  }

  if (mode === "erase") {
    const result = await eraseArkImage({
      imageDataUrl,
      level: pickField(fields, ["level"], "standard") || "standard",
      hint: prompt,
    });
    if (result.imageBase64) {
      const id = putChatArtifact({
        buffer: Buffer.from(result.imageBase64, "base64"),
        filename: `erase-${Date.now()}.png`,
        contentType: result.mimeType || "image/png",
      });
      return formatArtifactImageReply("智能消除完成", id, "消除结果");
    }
    if (result.imageUrl) {
      return `**智能消除完成**\n\n![消除结果](${result.imageUrl})`;
    }
    throw new HttpError(502, "未返回图片");
  }

  if (mode === "ocr") {
    const result = await extractTextFromImageDataUrl(imageDataUrl);
    if (!result?.text) throw new HttpError(422, "未能识别出文字");
    return `**图片文字提取完成**（${result.providerLabel}）\n\n${result.text}`;
  }

  throw new HttpError(400, "不支持的图像处理模式");
}

/**
 * @param {{ toolId: string, title: string, fields: Record<string, string> }} action
 * @param {{ lastUserMessage?: string, chatFiles?: object[], rawFiles?: object[], userId?: string }} context
 */
async function runAgentTool(action, context = {}) {
  const toolId = String(action?.toolId || "").trim();
  const fields = action?.fields && typeof action.fields === "object" ? action.fields : {};
  const fallback = String(context.lastUserMessage || "").replace(/\n\[已附加.*\]$/, "").trim();
  const toolContext = { ...context, rawFiles: resolveToolRawFiles(context) };
  const toolMeta = AGENT_TOOLS.find((t) => t.id === toolId);
  if (toolMeta?.adminOnly && !context.isAdmin) {
    return { ok: false, error: "需要管理员权限" };
  }

  try {
    switch (toolId) {
      case "media-download": {
        const keyword = pickField(fields, ["keyword", "query", "q"], fallback);
        const allowed = assertSearchAllowed(keyword);
        if (!allowed.ok) throw new HttpError(400, allowed.error);
        const result = await searchMediaResources(keyword);
        return { ok: true, text: formatMediaSearchReply(result) };
      }

      case "ai-search": {
        const query = pickField(fields, ["query", "q"], fallback);
        const searchPayload = await searchWebWithUnderstanding(query, {
          depth: "advanced",
          history: context.history,
        });
        let summary = searchPayload.answer || "";
        try {
          summary = await synthesizeSearchAnswer(query, searchPayload, {
            topic: searchPayload.topic,
          });
        } catch {
          summary = summary || "未能生成 AI 摘要，请查看下方来源。";
        }
        return {
          ok: true,
          text: formatSearchResult(query, summary, searchPayload.results),
        };
      }

      case "ppt-generate": {
        const topic = pickField(fields, ["topic", "title", "input", "query"], fallback);
        const result = await generatePptx(topic, { history: context.history });
        const id = putChatArtifact({
          buffer: result.buffer,
          filename: result.filename,
          contentType: result.contentType,
        });
        return {
          ok: true,
          text: `**PPT 已生成：${result.title}**\n\n_共 ${result.slideCount} 页_\n\n${formatArtifactLink(id, `下载 ${result.filename}`)}`,
        };
      }

      case "ai-writer": {
        const input = pickField(fields, ["input", "topic", "text"], fallback);
        const result = await generateWriting({
          mode: pickField(fields, ["mode"], "article") || "article",
          input,
          topic: pickField(fields, ["topic"]),
          tone: pickField(fields, ["tone"]),
          length: pickField(fields, ["length"]),
          targetLang: pickField(fields, ["targetLang"]),
        });
        return { ok: true, text: `**${result.modeLabel}**\n\n${result.text}` };
      }

      case "ai-workflow": {
        const input = pickField(fields, ["input", "topic"], fallback);
        const result = await runWorkflow({
          workflowId: pickField(fields, ["workflowId"], "content-pipeline") || "content-pipeline",
          input,
          runAll: true,
        });
        return { ok: true, text: formatWorkflowResult(result) };
      }

      case "app-builder": {
        const description = pickField(fields, ["description", "input"], fallback);
        const result = await generateAppHtml({
          description,
          appType: pickField(fields, ["appType"], "tool") || "tool",
          appName: pickField(fields, ["appName"]),
          presetId: pickField(fields, ["presetId"]),
        });
        const id = putChatArtifact({
          buffer: Buffer.from(result.html, "utf8"),
          filename: `${(result.title || "app").replace(/[^\w\u4e00-\u9fff-]+/g, "-") || "app"}.html`,
          contentType: "text/html; charset=utf-8",
        });
        return {
          ok: true,
          text: `**${result.title || "应用"}已生成**\n\n${formatArtifactLink(id, "下载 HTML 应用")}\n\n_可用浏览器打开预览_`,
        };
      }

      case "video-extract": {
        const url = pickField(fields, ["url", "link"], fallback);
        const data = await extractVerifiedVideoByUrl(url, { query: fallback });
        return { ok: true, text: formatVideoExtractResult(data) };
      }

      case "hot-trends": {
        const platform = pickField(fields, ["platform"], "douyin") || "douyin";
        const { list } = await fetchTrends(platform);
        return { ok: true, text: formatHotTrends(platform, list) };
      }

      case "text-toolbox": {
        return { ok: true, text: runTextToolbox(fields, fallback) };
      }

      case "spider-builder": {
        const url = pickField(fields, ["url"], fallback);
        const presetKey = pickField(fields, ["preset"]);
        const preset = presetKey && SPIDER_PRESETS[presetKey] ? presetKey : undefined;
        const data = await runSpider({
          url,
          preset,
          listSelector: pickField(fields, ["listSelector"]),
          itemSelector: pickField(fields, ["itemSelector"]),
          limit: Number(fields.limit) || 30,
        });
        return { ok: true, text: formatSpiderResult(data) };
      }

      case "social-publish": {
        const title = pickField(fields, ["title"], "");
        const description = pickField(fields, ["description", "input"], fallback);
        const tags = pickField(fields, ["tags"]);
        const platformsRaw = pickField(fields, ["platforms"], "douyin");
        const platforms = platformsRaw.split(/[,，\s]+/).filter(Boolean);
        const videoFile = pickFirstRaw(toolContext.rawFiles, ["video"]);

        if (videoFile) {
          const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pineapple-chat-social-"));
          try {
            const ext = path.extname(videoFile.originalname) || ".mp4";
            const videoPath = path.join(tmpDir, `video${ext}`);
            fs.writeFileSync(videoPath, videoFile.buffer);
            const data = await runSocialPublish({
              title,
              description,
              tags,
              platforms,
              videoPath,
              videoName: videoFile.originalname,
            });
            return { ok: true, text: formatSocialPublishResult(data) };
          } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
          }
        }

        const { captions } = await adaptCaptionsForPlatforms({
          title,
          description,
          tags,
          platforms,
        });
        return { ok: true, text: formatSocialAdapt(captions, platforms) };
      }

      case "music-convert": {
        const audio = pickFirstRaw(toolContext.rawFiles, ["audio", "video"]);
        if (!audio) throw new HttpError(400, "请上传音频或含音轨的视频");
        const r = await convertAudioFile(audio, pickField(fields, ["format"], "MP3"));
        return { ok: true, text: r.text };
      }

      case "gif-maker": {
        const video = pickFirstRaw(toolContext.rawFiles, ["video"]);
        if (!video) throw new HttpError(400, "请上传视频");
        const r = await makeGifFromVideo(video, fields);
        return { ok: true, text: r.text };
      }

      case "doc-convert": {
        const mode = pickField(fields, ["mode"], "pdf-to-word") || "pdf-to-word";
        const r = await runDocConvert(mode, toolContext.rawFiles);
        return { ok: true, text: r.text };
      }

      case "subtitle-workshop": {
        const tab = pickField(fields, ["tab"], "transcribe") || "transcribe";
        const media = pickFirstRaw(toolContext.rawFiles, ["video", "audio"]);
        if (!media) throw new HttpError(400, "请上传视频或音频");
        if (tab === "extract") {
          try {
            const r = await extractEmbeddedSubtitle(media);
            return { ok: true, text: r.text };
          } catch (e) {
            const msg = e instanceof HttpError ? e.message : e?.message || "";
            if (/未检测到|无字幕|subtitle stream/i.test(msg)) {
              const r = await transcribeMediaFile(media, "text");
              return {
                ok: true,
                text: `_视频无内嵌字幕轨，已改为语音转写：_\n\n${r.text}`,
              };
            }
            throw e;
          }
        }
        const r = await transcribeMediaFile(media, "text");
        return { ok: true, text: r.text };
      }

      case "image-fetch": {
        const query = pickField(fields, ["query", "keyword", "q"], fallback);
        const source = pickField(fields, ["source", "platform", "platforms"], "");
        const platforms = normalizePlatformIds(source);
        const preferXhs =
          platforms.includes("xiaohongshu") ||
          /xiaohongshu|xhs|小红书/i.test(source) ||
          wantsXiaohongshuImageSource(fallback);
        const plan = buildAgentImageFetchPlan(query, fallback || query, { platforms, preferXhs });
        if (!plan) throw new HttpError(400, "请说明要找什么图片");
        const text = await runImageFetchPlan(plan, fallback || query);
        return { ok: true, text };
      }

      case "image-studio": {
        const text = await runImageStudio(fields, toolContext);
        return { ok: true, text };
      }

      case "memory": {
        if (!context.userId) throw new HttpError(401, "请先登录后再使用记忆库");
        const content = pickField(fields, ["content"], fallback);
        if (!content) throw new HttpError(400, "请提供要记住的内容");
        if (pickField(fields, ["action"], "add") === "list") {
          const block = formatMemoriesForPrompt(context.userId, 15);
          return {
            ok: true,
            text: block
              ? `**你的记忆**\n\n${block}`
              : "**记忆库为空**，可以说「记住：…」让我帮你保存。",
          };
        }
        addUserMemory(context.userId, content, "agent");
        const total = listUserMemories(context.userId).length;
        return { ok: true, text: `**已记住**\n\n> ${content}\n\n_当前共 ${total} 条记忆_` };
      }

      default: {
        const tool = AGENT_TOOLS.find((t) => t.id === toolId);
        return {
          ok: false,
          error: tool ? `「${tool.title}」执行失败，请检查参数或附件` : "未知工具",
          keepAction: false,
        };
      }
    }
  } catch (e) {
    const msg = e instanceof HttpError ? e.message : e?.message || "工具执行失败";
    return { ok: false, error: msg, keepAction: false };
  }
}

export async function executeAgentTool(action, context = {}) {
  return runAgentTool(action, context);
}

export async function mergeToolResultIntoReply(reply, agentAction, context) {
  if (!agentAction) return { reply, agentAction: null };

  const intro = String(reply || "").trim();
  const result = await runAgentTool(agentAction, context);

  if (result.ok) {
    const parts = [intro, result.text].filter(Boolean);
    return { reply: parts.join("\n\n"), agentAction: null };
  }

  const parts = [intro, result.error ? `⚠️ ${result.error}` : ""].filter(Boolean);
  return {
    reply: parts.join("\n\n"),
    agentAction: result.keepAction ? agentAction : null,
  };
}

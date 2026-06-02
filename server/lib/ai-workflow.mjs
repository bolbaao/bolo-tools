import OpenAI from "openai";
import { HttpError } from "./http-error.mjs";
import { getChatProviderLabel, resolveChatConfig } from "./chat-config.mjs";
import { env } from "./env.mjs";

/** @typedef {{ id: string, title: string, prompt: string }} WorkflowStep */

/** @type {Record<string, { label: string, description: string, steps: WorkflowStep[] }>} */
export const WORKFLOW_PRESETS = {
  "content-pipeline": {
    label: "内容创作流水线",
    description: "从选题到大纲、正文再到润色，帮你写完一整篇文章",
    steps: [
      {
        id: "outline",
        title: "生成大纲",
        prompt:
          "根据用户提供的主题与要求，输出文章大纲。使用 Markdown 标题层级（##、###），每条下用一句话说明要点。不要写正文。",
      },
      {
        id: "draft",
        title: "撰写正文",
        prompt:
          "根据主题、要求与已有大纲，撰写完整正文。结构清晰，段落适中，语言自然。使用 Markdown 格式。",
      },
      {
        id: "polish",
        title: "润色成稿",
        prompt:
          "在已有正文基础上润色：修正语病、优化表达、统一语气，输出最终成稿。保持 Markdown 结构，不要添加编辑说明。",
      },
    ],
  },
  "social-pack": {
    label: "社媒内容包",
    description: "围绕一个主题写好社媒正文，再配标题和话题标签，一次打包",
    steps: [
      {
        id: "body",
        title: "撰写正文",
        prompt:
          "根据主题撰写适合小红书/公众号的社媒正文：开头吸睛、段落短、可读性强，可加适量 emoji。直接输出正文。",
      },
      {
        id: "titles",
        title: "标题备选",
        prompt:
          "根据已有正文，给出 5 个吸引点击的标题备选，编号列表输出，每条一行，不要解释。",
      },
      {
        id: "tags",
        title: "话题标签",
        prompt:
          "根据正文内容，给出 8–12 个适合发布的话题标签（含 # 号），空格或换行分隔，不要解释。",
      },
    ],
  },
  "script-pipeline": {
    label: "视频脚本流水线",
    description: "想好视频要讲什么，再出分镜和完整口播稿，拿来就能录",
    steps: [
      {
        id: "hook",
        title: "开场钩子",
        prompt:
          "根据主题，写 3 个适合短视频开头的「钩子」文案（15 字以内），编号列出，风格有冲击力。",
      },
      {
        id: "outline",
        title: "分镜大纲",
        prompt:
          "根据主题与钩子方向，输出视频分镜大纲：按时间顺序，每段含「画面建议 + 口播要点」，Markdown 列表。",
      },
      {
        id: "script",
        title: "完整口播稿",
        prompt:
          "根据分镜大纲，撰写完整口播稿，口语化、节奏感强，可直接用于录制。分段落，标注可选画面提示（括号内）。",
      },
    ],
  },
};

function buildStepContext(workflow, stepIndex, input, previousOutputs) {
  const preset = WORKFLOW_PRESETS[workflow];
  if (!preset) throw new HttpError(400, "未知工作流");

  const step = preset.steps[stepIndex];
  if (!step) throw new HttpError(400, "无效的步骤");

  const prior = preset.steps
    .slice(0, stepIndex)
    .map((s) => {
      const out = previousOutputs?.[s.id];
      return out ? `【${s.title}】\n${out}` : null;
    })
    .filter(Boolean)
    .join("\n\n");

  const userParts = [`工作流：${preset.label}`, `当前步骤：${step.title}`, ""];
  if (input?.trim()) userParts.push(`用户输入/主题：\n${input.trim()}`, "");
  if (prior) userParts.push("前序步骤结果：", prior, "");
  userParts.push("请完成当前步骤任务。");

  return { preset, step, system: step.prompt, user: userParts.join("\n") };
}

async function runSingleStep(workflow, stepIndex, input, previousOutputs) {
  const chatConfig = resolveChatConfig();
  if (!chatConfig) {
    throw new HttpError(503, "未配置 DEEPSEEK_API_KEY 或 ARK_API_KEY");
  }

  const { preset, step, system, user } = buildStepContext(workflow, stepIndex, input, previousOutputs);
  const timeoutMs = Number(env("AI_WORKFLOW_TIMEOUT_MS", "120000")) || 120000;
  const client = new OpenAI({
    apiKey: chatConfig.apiKey,
    baseURL: chatConfig.baseURL,
    timeout: timeoutMs,
    maxRetries: 0,
  });

  const completion = await client.chat.completions.create({
    model: chatConfig.model,
    messages: [
      { role: "system", content: `你是 AI 工作流助手。${system}` },
      { role: "user", content: user },
    ],
    temperature: 0.6,
    max_tokens: 4096,
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) throw new HttpError(502, `步骤「${step.title}」未返回有效内容`);

  return {
    stepId: step.id,
    stepTitle: step.title,
    stepIndex,
    totalSteps: preset.steps.length,
    output: text,
    provider: getChatProviderLabel(chatConfig.provider),
  };
}

export function listWorkflowPresets() {
  return Object.entries(WORKFLOW_PRESETS).map(([id, w]) => ({
    id,
    label: w.label,
    description: w.description,
    steps: w.steps.map((s) => ({ id: s.id, title: s.title })),
  }));
}

/**
 * @param {{ workflowId: string, input: string, stepIndex?: number, previousOutputs?: Record<string, string>, runAll?: boolean }} opts
 */
export async function runWorkflow(opts) {
  const { workflowId, input, previousOutputs = {}, runAll = false } = opts;
  const preset = WORKFLOW_PRESETS[workflowId];
  if (!preset) throw new HttpError(400, "未知工作流");
  if (!input?.trim()) throw new HttpError(400, "请填写主题或初始素材");

  if (!runAll) {
    const stepIndex = Number(opts.stepIndex);
    if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= preset.steps.length) {
      throw new HttpError(400, "请指定有效步骤");
    }
    const result = await runSingleStep(workflowId, stepIndex, input, previousOutputs);
    return { results: [result], completed: stepIndex >= preset.steps.length - 1 };
  }

  const results = [];
  const outputs = { ...previousOutputs };

  for (let i = 0; i < preset.steps.length; i++) {
    const result = await runSingleStep(workflowId, i, input, outputs);
    results.push(result);
    outputs[result.stepId] = result.output;
  }

  return { results, completed: true };
}

import { AGENT_TOOLS } from "../../shared/agent-tools.mjs";

export function buildAgentSystemPrompt() {
  const toolLines = AGENT_TOOLS.map(
    (tool) =>
      `- ${tool.id} · ${tool.title}：${tool.description}\n  字段 ${JSON.stringify(tool.fields)}`,
  ).join("\n");

  return `你是春雨集 AI 助手，像 ChatGPT 一样与用户自然对话。

核心原则：
1. 能直接回答的问题 → 在对话里给出完整答案
2. 需要站内工具才能完成的任务 → 输出 agent JSON，系统会自动调用工具并把结果呈现给用户
3. 不要让用户「自己去打开工具页操作」；工具执行后结果（含下载链接）会自动追加到回复
4. 所有 listed 工具均支持对话内自动执行，包括需上传附件的：转码、GIF、文档转换、字幕、图像处理等
5. 用户上传视频/音频并要求「提取字幕」「转写」时 → 必须输出 subtitle-workshop 的 agent JSON（tab=extract 或 transcribe），禁止引导去工具页

影视/动漫/电影：
- 用户说「想看 XX」「找 XX 下载」→ 系统会自动检索网盘链接；也可输出 media-download 的 agent JSON

附件与工具：
- 用户已上传图片/音视频/文档时，输出对应 toolId 的 agent JSON，系统会用附件执行
- 生成类文件（图片、音频、GIF、HTML 等）会以下载链接形式返回

回答风格：
- 用中文，语气友好、清晰
- 适当使用 Markdown：小标题、列表、加粗、代码块
- 不要编造无法验证的事实或链接

可用工具（需要时在回复末尾附加 JSON，系统会自动执行）：
${toolLines}

何时输出 agent JSON：
- 任务需要搜索全网、写长文、解析视频链接、查热点、检索影视资源、处理文本等
- 在 JSON 前可写一句简短说明；执行结果会自动追加，无需你编造工具输出

格式（仅此一处）：
\`\`\`agent
{"toolId":"工具id","fields":{"字段名":"值"},"summary":"一句话说明"}
\`\`\`

规则：
1. fields 只填能从用户消息推断出的值，缺失留空字符串
2. 用户附带了图片/音视频/文档时，优先结合附件内容回答；文档内容可直接分析，不必为了分析而调用工具
3. 纯聊天、解释、闲聊 → 不要输出 agent JSON
4. 禁止编造工具执行结果；结果由系统自动填入`;
}

/**
 * @param {string} reply
 */
export function parseAgentAction(reply) {
  const raw = String(reply || "").trim();
  const match = raw.match(/```agent\s*([\s\S]*?)```/i);
  if (!match) return { reply: raw, agentAction: null };

  try {
    const parsed = JSON.parse(match[1].trim());
    const toolId = String(parsed.toolId || parsed.tool || "").trim();
    const fields =
      parsed.fields && typeof parsed.fields === "object" ? parsed.fields : {};
    const tool = AGENT_TOOLS.find((t) => t.id === toolId);
    if (!tool) {
      return { reply: raw.replace(match[0], "").trim() || raw, agentAction: null };
    }
    const cleanReply = raw.replace(match[0], "").trim() || String(parsed.summary || "").trim();
    return {
      reply: cleanReply || parsed.summary || `正在为你处理…`,
      agentAction: {
        toolId: tool.id,
        title: tool.title,
        href: tool.href,
        fields: Object.fromEntries(
          Object.entries(fields).map(([k, v]) => [k, String(v ?? "").trim()]),
        ),
        summary: String(parsed.summary || cleanReply || "").trim(),
      },
    };
  } catch {
    return { reply: raw, agentAction: null };
  }
}

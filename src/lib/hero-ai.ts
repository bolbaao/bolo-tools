/** Hero 区 AI 对话：展示用模型标签 fallback（实际以 /api/chat/models aiStack 为准） */
export const HERO_CHAT_MODEL = "DeepSeek";
export const HERO_VISION_MODEL = "火山方舟";

export const HERO_INPUT_PLACEHOLDER = "随便聊聊、发图片或描述任务…";

export type AiStackSlot = {
  role?: string;
  provider: string | null;
  label: string | null;
  model: string | null;
  configured: boolean;
  envKey?: string | null;
};

export type AiStack = {
  /** 文字 DeepSeek + 识图火山方舟 */
  merged?: boolean;
  chat: AiStackSlot;
  vision: AiStackSlot;
};

export function formatAiStackHint(stack: AiStack | null | undefined): string {
  if (stack?.merged) {
    return `文字 ${HERO_CHAT_MODEL} · 识图 ${HERO_VISION_MODEL}`;
  }
  const chat = stack?.chat?.label || HERO_CHAT_MODEL;
  const vision = stack?.vision?.label || HERO_VISION_MODEL;
  return `对话 ${chat} · 识图 ${vision}`;
}

/** 是否启用合并栈（自动路由，无需手选对话模型） */
export function isMergedAiStackActive(stack: AiStack | null | undefined): boolean {
  return Boolean(stack?.merged);
}

export function heroChatLabel(stack: AiStack | null | undefined): string {
  return stack?.chat?.label || HERO_CHAT_MODEL;
}

export function heroVisionLabel(stack: AiStack | null | undefined): string {
  return stack?.vision?.label || HERO_VISION_MODEL;
}

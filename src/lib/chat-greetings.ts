import type { ChatMode } from "@/lib/chat";

const chatGreetings = [
  "嗨～想聊什么都可以，也可以直接告我你想要什么。",
  "你好呀，今天想聊点什么呢？",
  "在呢在呢～有什么想聊的或想做的？",
  "哈喽～随便聊聊，或者直接说你想搞定什么事。",
  "来啦！想聊天、问问题、找工具都行～",
  "你好～今天过得怎么样？",
  "嘿，有什么我可以帮你的？",
  "欢迎回来～想聊点什么？",
  "又见面啦～想聊八卦、问问题、还是找工具？",
  "在的～随便说，我听着呢。",
];

const agentGreetings = [
  "Agent 模式已开启～告诉我你想做什么，我会帮你找工具并自动操作。",
  "Agent 就绪～描述一下任务，我来帮你找工具、填内容。",
  "切到 Agent 了～说目标就行，工具我来安排。",
  "Agent 模式开着呢～想自动化做什么？",
  "准备好了～告诉我想完成的任务，我帮你操作。",
  "Agent 在线～说说看，想让我帮你搞定什么？",
];

const allGreetings = new Set([...chatGreetings, ...agentGreetings]);

export function pickRandomGreeting(mode: ChatMode): string {
  const pool = mode === "agent" ? agentGreetings : chatGreetings;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function isGreetingMessage(text: string): boolean {
  return allGreetings.has(text);
}

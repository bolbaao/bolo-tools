export type AgentActionType = "navigate" | "scroll" | "filter_tools" | "prefill";

export type AgentAction = {
  type: AgentActionType;
  params: Record<string, unknown>;
};

export type AgentResponse = {
  ok: boolean;
  reply: string;
  intent?: "chat" | "operate";
  plan?: string[];
  actions?: AgentAction[];
};

export type AgentPageContext = {
  path?: string;
  toolId?: string;
};

export type ActionResult = {
  type: AgentActionType;
  ok: boolean;
  message: string;
};

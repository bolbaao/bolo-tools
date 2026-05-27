export type AgentActionType = "navigate" | "scroll" | "filter_tools" | "prefill";

export type AgentPermissionType =
  | "geolocation"
  | "clipboard-read"
  | "notifications"
  | "photos-picker";

export type ClientPhotoItem = {
  name: string;
  size: number;
  lastModified: number;
  mimeType: string;
  width?: number;
  height?: number;
  /** 压缩后的预览，仅发往本站 API 做识别 */
  previewDataUrl?: string;
};

export type AgentPermissionRequest = {
  type: AgentPermissionType;
  reason?: string;
};

export type ClientPermissions = {
  geolocation?: {
    status: "granted" | "denied" | "unsupported";
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    error?: string;
  };
  clipboard?: {
    status: "granted" | "denied" | "unsupported";
    text?: string;
    error?: string;
  };
  notifications?: {
    status: "granted" | "denied" | "unsupported";
    error?: string;
  };
  photos?: {
    status: "granted" | "denied" | "unsupported";
    items?: ClientPhotoItem[];
    error?: string;
  };
};

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
  permissionRequests?: AgentPermissionRequest[];
};

/** 无需授权即可上报的环境信息 */
export type ClientInfo = {
  timezone?: string;
  locale?: string;
};

export type AgentPageContext = {
  path?: string;
  toolId?: string;
  clientInfo?: ClientInfo;
  clientPermissions?: ClientPermissions;
  /** 仍可申请的权限（发给服务端供模型参考） */
  grantablePermissions?: AgentPermissionType[];
  /** 本轮对话附带的图片（用于识别） */
  chatImages?: ClientPhotoItem[];
};

export type ActionResult = {
  type: AgentActionType;
  ok: boolean;
  message: string;
};

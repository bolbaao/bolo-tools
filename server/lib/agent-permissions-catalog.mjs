/** 对话中 AI 可自主申请的全部浏览器权限（与前端 agent-permissions.ts 保持一致） */
export const AGENT_PERMISSION_CATALOG = [
  {
    type: "geolocation",
    title: "定位",
    when: "当地/附近天气、位置相关、时区无法推断的「这边」",
  },
  {
    type: "clipboard-read",
    title: "剪贴板",
    when: "用户提到刚复制/剪切的内容但未粘贴到对话框",
  },
  {
    type: "notifications",
    title: "通知",
    when: "需要在任务完成后用系统通知提醒用户",
  },
  {
    type: "photos-picker",
    title: "相册选图",
    when: "需要查看、描述用户相册/照片中的实际画面",
  },
];

export const AGENT_PERMISSION_TYPES = AGENT_PERMISSION_CATALOG.map((p) => p.type);

export function buildPermissionsCatalogPrompt() {
  const lines = AGENT_PERMISSION_CATALOG.map(
    (p) => `- ${p.type}（${p.title}）：${p.when}`,
  );
  return lines.join("\n");
}

export function listMissingPermissionTypes(clientPermissions) {
  const perms = clientPermissions && typeof clientPermissions === "object" ? clientPermissions : {};
  const missing = [];

  for (const { type } of AGENT_PERMISSION_CATALOG) {
    if (type === "geolocation") {
      if (perms.geolocation?.status !== "granted") missing.push(type);
    } else if (type === "clipboard-read") {
      if (perms.clipboard?.status !== "granted") missing.push(type);
    } else if (type === "notifications") {
      if (perms.notifications?.status !== "granted") missing.push(type);
    } else if (type === "photos-picker") {
      const photos = perms.photos;
      if (photos?.status !== "granted" || !(photos.items?.length > 0)) missing.push(type);
    }
  }

  return missing;
}

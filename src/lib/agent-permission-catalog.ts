import type { AgentPermissionType, ClientPermissions } from "@/lib/agent-types";

/** 与 server/lib/agent-permissions-catalog.mjs 保持一致 */
export const ALL_AGENT_PERMISSION_TYPES: AgentPermissionType[] = [
  "geolocation",
  "clipboard-read",
  "notifications",
  "photos-picker",
];

export function listMissingPermissionTypes(perms: ClientPermissions): AgentPermissionType[] {
  const missing: AgentPermissionType[] = [];

  if (perms.geolocation?.status !== "granted") missing.push("geolocation");
  if (perms.clipboard?.status !== "granted") missing.push("clipboard-read");
  if (perms.notifications?.status !== "granted") missing.push("notifications");
  const photos = perms.photos;
  if (photos?.status !== "granted" || !(photos.items?.length ?? 0)) {
    missing.push("photos-picker");
  }

  return missing;
}

import { apiGet } from "@/lib/api";

type StylePreset = { id: string; label: string; hint: string };

export async function storyboardCapabilities() {
  const data = await apiGet<{
    ok: boolean;
    ready: boolean;
    aiConfigured: boolean;
    imageConfigured: boolean;
    styles: StylePreset[];
  }>("/api/storyboard/capabilities");
  return data;
}

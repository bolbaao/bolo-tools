/**
 * 从大模型回复中提取 JSON（支持 ```json 围栏或裸对象）
 * @param {string} text
 * @returns {unknown}
 */
export function parseJsonBlock(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1].trim() : raw;
  try {
    return JSON.parse(body);
  } catch {
    const m = body.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("invalid json");
  }
}

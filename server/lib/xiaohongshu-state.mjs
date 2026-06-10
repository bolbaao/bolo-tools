export function parseInitialState(html) {
  const match = String(html || "").match(
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/,
  );
  if (!match) throw new Error("missing xhs initial state");
  return JSON.parse(match[1].replace(/undefined/g, "null"));
}

export function countTextStats(text: string) {
  const trimmed = text.trim();
  const lines = trimmed ? trimmed.split(/\n/) : [];
  const chars = text.length;
  const charsNoSpace = text.replace(/\s/g, "").length;
  const words = trimmed
    ? (trimmed.match(/[\u4e00-\u9fff]|[a-zA-Z0-9]+/g) || []).length
    : 0;
  return {
    lines: lines.length,
    chars,
    charsNoSpace,
    words,
    paragraphs: trimmed ? trimmed.split(/\n\s*\n/).filter(Boolean).length : 0,
  };
}

export function dedupeLines(text: string, keepOrder = true): string {
  const lines = text.split(/\n/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.trim();
    if (!keepOrder && seen.has(key)) continue;
    if (keepOrder && seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out.join("\n");
}

export function formatJson(text: string, minify = false): { ok: true; result: string } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(text);
    return {
      ok: true,
      result: minify ? JSON.stringify(parsed) : JSON.stringify(parsed, null, 2),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "JSON 解析失败" };
  }
}

/** 轻量 Markdown → HTML（仅常用语法） */
export function markdownToHtml(md: string): string {
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const blocks = escaped.split(/\n\n+/);
  return blocks
    .map((block) => {
      const line = block.trim();
      if (!line) return "";
      const table = markdownTableToHtml(line);
      if (table) return table;
      if (line.startsWith("```")) {
        const inner = line.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
        return `<pre class="md-code"><code>${inner}</code></pre>`;
      }
      if (/^#{1,3}\s/.test(line)) {
        const level = line.match(/^(#+)/)?.[1].length || 1;
        const text = line.replace(/^#+\s*/, "");
        const tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
        return `<${tag} class="md-h">${inline(text)}</${tag}>`;
      }
      if (/^[-*]\s/.test(line)) {
        const items = line
          .split("\n")
          .map((l) => `<li>${inline(l.replace(/^[-*]\s*/, ""))}</li>`)
          .join("");
        return `<ul class="md-ul">${items}</ul>`;
      }
      return `<p class="md-p">${inline(line.replace(/\n/g, "<br/>"))}</p>`;
    })
    .filter(Boolean)
    .join("");
}

function markdownTableToHtml(block: string): string | null {
  const lines = block.split("\n").filter((l) => l.trim());
  if (lines.length < 2 || !lines.every((l) => l.includes("|"))) return null;
  const rows = lines
    .filter((l) => !/^\|[\s\-:|]+\|$/.test(l.trim()))
    .map((line) => line.split("|").slice(1, -1).map((c) => c.trim()));
  if (rows.length === 0) return null;
  const [head, ...body] = rows;
  const ths = head.map((c) => `<th class="md-th">${inline(c)}</th>`).join("");
  const trs = body
    .map((row) => `<tr>${row.map((c) => `<td class="md-td">${inline(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<div class="md-table-wrap overflow-x-auto mb-4"><table class="md-table w-full text-xs border-collapse"><thead><tr class="border-b border-white/10">${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
}

function sanitizeLinkHref(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed, "https://example.invalid");
    if (parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "mailto:") {
      return parsed.href;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function inline(s: string) {
  return s
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
      const safe = sanitizeLinkHref(href);
      if (!safe) return label;
      return `<a href="${safe}" rel="noopener noreferrer">${label}</a>`;
    })
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code class='md-inline'>$1</code>");
}

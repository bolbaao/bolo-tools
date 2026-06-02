import crypto from "crypto";
import { randomUUID } from "crypto";

const CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LEN = 4;
const TTL_MS = 5 * 60 * 1000;
const store = new Map();

function purgeExpired() {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (now > entry.expiresAt) store.delete(id);
  }
}

function randomInt(max) {
  return crypto.randomInt(0, max);
}

function hashAnswer(text) {
  return crypto.createHash("sha256").update(String(text).trim().toLowerCase()).digest("hex");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function randomCode() {
  let code = "";
  for (let i = 0; i < CODE_LEN; i += 1) {
    code += CHARSET[randomInt(CHARSET.length)];
  }
  return code;
}

function renderSvg(text) {
  const width = 120;
  const height = 40;
  const colors = ["#a5b4fc", "#67e8f9", "#fcd34d", "#fca5a5", "#86efac"];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="100%" height="100%" rx="8" fill="#14141f"/>`;

  for (let i = 0; i < 5; i += 1) {
    svg += `<line x1="${randomInt(width)}" y1="${randomInt(height)}" x2="${randomInt(width)}" y2="${randomInt(height)}" stroke="#3f3f46" stroke-width="1" opacity="0.8"/>`;
  }

  text.split("").forEach((ch, i) => {
    const x = 14 + i * 26;
    const y = 28 + randomInt(7) - 3;
    const rotate = randomInt(31) - 15;
    svg += `<text x="${x}" y="${y}" fill="${colors[i % colors.length]}" font-size="22" font-family="ui-monospace, monospace" font-weight="700" transform="rotate(${rotate} ${x} ${y})">${escapeXml(ch)}</text>`;
  });

  for (let i = 0; i < 18; i += 1) {
    svg += `<circle cx="${randomInt(width)}" cy="${randomInt(height)}" r="1" fill="#52525b" opacity="0.7"/>`;
  }

  svg += "</svg>";
  return svg;
}

export function createCaptcha() {
  purgeExpired();
  const text = randomCode();
  const id = randomUUID();
  store.set(id, {
    hash: hashAnswer(text),
    expiresAt: Date.now() + TTL_MS,
  });
  const svg = renderSvg(text);
  const image = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return { id, image };
}

export function verifyCaptcha(id, answer) {
  purgeExpired();
  const rawId = String(id ?? "").trim();
  const rawAnswer = String(answer ?? "").trim();
  if (!rawId || !rawAnswer) {
    throw Object.assign(new Error("请输入图形验证码"), { status: 400 });
  }

  const entry = store.get(rawId);
  store.delete(rawId);
  if (!entry) {
    throw Object.assign(new Error("图形验证码已失效，请刷新后重试"), { status: 400 });
  }
  if (Date.now() > entry.expiresAt) {
    throw Object.assign(new Error("图形验证码已过期，请刷新后重试"), { status: 400 });
  }

  const actual = hashAnswer(rawAnswer);
  const expected = entry.hash;
  const ok =
    actual.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  if (!ok) {
    throw Object.assign(new Error("图形验证码错误"), { status: 400 });
  }
}

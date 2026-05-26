import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

// 让 Node fetch（含 OpenAI SDK）走 .env / 终端里的 HTTP(S)_PROXY
if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
  setGlobalDispatcher(new EnvHttpProxyAgent());
}

export function env(key, fallback = "") {
  return process.env[key]?.trim() || fallback;
}

export function requireEnv(key) {
  const v = env(key);
  if (!v) throw new Error(`缺少环境变量 ${key}，请在 .env 中配置`);
  return v;
}

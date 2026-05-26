import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

export function env(key, fallback = "") {
  return process.env[key]?.trim() || fallback;
}

export function requireEnv(key) {
  const v = env(key);
  if (!v) throw new Error(`缺少环境变量 ${key}，请在 .env 中配置`);
  return v;
}

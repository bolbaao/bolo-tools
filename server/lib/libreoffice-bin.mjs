import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..", "..");
const PROJECT_SOFFICE = path.join(
  PROJECT_ROOT,
  ".local",
  "LibreOffice.app",
  "Contents",
  "MacOS",
  "soffice",
);
const MAC_SOFFICE = "/Applications/LibreOffice.app/Contents/MacOS/soffice";

function resolveEnvPath(raw) {
  if (!raw) return null;
  const p = raw.trim();
  const resolved = path.isAbsolute(p) ? p : path.join(PROJECT_ROOT, p);
  return fs.existsSync(resolved) ? resolved : null;
}

export function getLibreOfficePath() {
  const fromEnv = resolveEnvPath(process.env.LIBREOFFICE_PATH);
  if (fromEnv) return fromEnv;
  if (fs.existsSync(PROJECT_SOFFICE)) return PROJECT_SOFFICE;
  if (fs.existsSync(MAC_SOFFICE)) return MAC_SOFFICE;

  for (const name of ["soffice", "libreoffice", "lowriter"]) {
    try {
      const out = execSync(`which ${name}`, { encoding: "utf8" }).trim();
      if (out) return out;
    } catch {
      /* try next */
    }
  }
  return null;
}

export function isLibreOfficeAvailable() {
  return Boolean(getLibreOfficePath());
}

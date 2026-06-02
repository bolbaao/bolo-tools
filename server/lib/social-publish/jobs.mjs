import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const JOBS_ROOT = path.join(__dirname, "..", "..", "..", "data", "social-publish", "jobs");

export function ensureJobsRoot() {
  fs.mkdirSync(JOBS_ROOT, { recursive: true });
}

export function createJobId() {
  return `sp_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

export function jobDir(jobId) {
  return path.join(JOBS_ROOT, jobId);
}

export function writeJob(job) {
  ensureJobsRoot();
  const dir = jobDir(job.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "job.json"), JSON.stringify(job, null, 2), "utf8");
  return dir;
}

export function readJob(jobId) {
  const file = path.join(jobDir(jobId), "job.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function updateJob(jobId, patch) {
  const job = readJob(jobId);
  if (!job) return null;
  const next = { ...job, ...patch, updatedAt: new Date().toISOString() };
  writeJob(next);
  return next;
}

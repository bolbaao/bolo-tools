import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { env } from "./env.mjs";
import { sendRegistrationCodeEmail, sendVerificationEmail } from "./email.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_DIR = path.join(__dirname, "..", "..", "data", "users");
const USERS_PATH = path.join(USERS_DIR, "users.json");
const PENDING_CODES_PATH = path.join(USERS_DIR, "pending-email-codes.json");

const COOKIE_NAME = "user_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30;
const USERNAME_RE = /^[\w\u4e00-\u9fff]{3,32}$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 6;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;
const SEND_COOLDOWN_MS = 60 * 1000;

function secret() {
  return env("USER_SESSION_SECRET") || env("ASSETS_SESSION_SECRET") || "pineapple-user-dev";
}

function ensureUsersDir() {
  if (!fs.existsSync(USERS_DIR)) {
    fs.mkdirSync(USERS_DIR, { recursive: true });
  }
}

function loadUsers() {
  ensureUsersDir();
  if (!fs.existsSync(USERS_PATH)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(USERS_PATH, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  ensureUsersDir();
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function loadPendingCodes() {
  ensureUsersDir();
  if (!fs.existsSync(PENDING_CODES_PATH)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(PENDING_CODES_PATH, "utf8"));
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function savePendingCodes(codes) {
  ensureUsersDir();
  fs.writeFileSync(PENDING_CODES_PATH, JSON.stringify(codes, null, 2));
}

function generateVerificationCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function migrateUser(user) {
  if (!user.email) {
    user.emailVerified = user.emailVerified !== false;
  }
  return user;
}

export function isAdminUser(user) {
  return Boolean(user?.isAdmin);
}

export function toPublicUser(user) {
  if (!user) return null;
  const admin = isAdminUser(user);
  return {
    id: user.id,
    username: user.username,
    email: user.email || undefined,
    emailVerified: admin || Boolean(user.emailVerified),
    isAdmin: admin,
  };
}

export function validateUsername(username) {
  const name = String(username ?? "").trim();
  if (!USERNAME_RE.test(name)) {
    return "用户名需 3–32 个字符，仅支持字母、数字、下划线或中文";
  }
  return null;
}

export function validateEmail(email) {
  const e = String(email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return "请输入有效的邮箱地址";
  if (e.length > 254) return "邮箱地址过长";
  return null;
}

export function validatePassword(password) {
  const p = String(password ?? "");
  if (p.length < MIN_PASSWORD_LEN) {
    return `密码至少 ${MIN_PASSWORD_LEN} 个字符`;
  }
  if (p.length > 128) {
    return "密码不能超过 128 个字符";
  }
  return null;
}

function createVerificationFields() {
  const token = randomUUID();
  const code = generateVerificationCode();
  return {
    emailVerificationTokenHash: hashToken(token),
    emailVerificationCodeHash: hashToken(code),
    emailVerificationExpires: new Date(Date.now() + VERIFY_TTL_MS).toISOString(),
    token,
    code,
  };
}

export async function sendRegistrationVerificationCode(email) {
  const emailError = validateEmail(email);
  if (emailError) throw Object.assign(new Error(emailError), { status: 400 });

  const mail = normalizeEmail(email);
  const users = loadUsers().map(migrateUser);
  if (users.some((u) => u.email?.toLowerCase() === mail)) {
    throw Object.assign(new Error("邮箱已被注册"), { status: 409 });
  }

  const pending = loadPendingCodes();
  const existing = pending[mail];
  if (existing?.sentAt && Date.now() - existing.sentAt < SEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((SEND_COOLDOWN_MS - (Date.now() - existing.sentAt)) / 1000);
    throw Object.assign(new Error(`请 ${waitSec} 秒后再试`), { status: 429 });
  }

  const code = generateVerificationCode();
  pending[mail] = {
    codeHash: hashToken(code),
    expires: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    sentAt: Date.now(),
  };
  savePendingCodes(pending);

  const mailResult = await sendRegistrationCodeEmail({ to: mail, code });
  if (mailResult.devMode) {
    const message = mailResult.smtpError
      ? `邮件发送失败，已显示开发验证码（${mailResult.smtpError}）`
      : "未配置邮件服务，验证码见下方或服务器控制台";
    return {
      message,
      devMode: true,
      code: process.env.NODE_ENV !== "production" ? mailResult.code : undefined,
    };
  }
  return { message: "验证码已发送，请查收邮箱", devMode: false };
}

function consumeRegistrationVerificationCode(email, code) {
  const mail = normalizeEmail(email);
  const rawCode = String(code ?? "").trim();
  if (!/^\d{6}$/.test(rawCode)) {
    throw Object.assign(new Error("请输入 6 位邮箱验证码"), { status: 400 });
  }

  const pending = loadPendingCodes();
  const entry = pending[mail];
  if (!entry) {
    throw Object.assign(new Error("请先获取邮箱验证码"), { status: 400 });
  }

  const exp = Date.parse(entry.expires || "");
  if (!Number.isFinite(exp) || Date.now() > exp) {
    delete pending[mail];
    savePendingCodes(pending);
    throw Object.assign(new Error("验证码已过期，请重新获取"), { status: 400 });
  }

  const expected = entry.codeHash;
  const actual = hashToken(rawCode);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) {
    throw Object.assign(new Error("邮箱验证码错误"), { status: 400 });
  }

  delete pending[mail];
  savePendingCodes(pending);
}

export async function registerUser(username, email, password, confirmPassword, verificationCode) {
  const nameError = validateUsername(username);
  if (nameError) throw Object.assign(new Error(nameError), { status: 400 });

  const emailError = validateEmail(email);
  if (emailError) throw Object.assign(new Error(emailError), { status: 400 });

  const passError = validatePassword(password);
  if (passError) throw Object.assign(new Error(passError), { status: 400 });

  if (password !== confirmPassword) {
    throw Object.assign(new Error("两次输入的密码不一致"), { status: 400 });
  }

  consumeRegistrationVerificationCode(email, verificationCode);

  const name = String(username).trim();
  const mail = normalizeEmail(email);
  const users = loadUsers().map(migrateUser);

  if (users.some((u) => u.username.toLowerCase() === name.toLowerCase())) {
    throw Object.assign(new Error("用户名已被占用"), { status: 409 });
  }
  if (users.some((u) => u.email?.toLowerCase() === mail)) {
    throw Object.assign(new Error("邮箱已被注册"), { status: 409 });
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const user = {
    id: randomUUID(),
    username: name,
    email: mail,
    emailVerified: true,
    salt,
    passwordHash: hashPassword(password, salt),
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  saveUsers(users);
  ensureUserMemoryDir(user.id);

  return toPublicUser(user);
}

export function authenticateUser(username, password) {
  const name = String(username ?? "").trim();
  const pass = String(password ?? "");
  if (!name || !pass) {
    throw Object.assign(new Error("请输入用户名和密码"), { status: 400 });
  }

  const users = loadUsers().map(migrateUser);
  const user = users.find((u) => u.username.toLowerCase() === name.toLowerCase());
  if (!user) {
    throw Object.assign(new Error("用户名或密码错误"), { status: 401 });
  }

  const hash = hashPassword(pass, user.salt);
  const ok =
    hash.length === user.passwordHash.length &&
    crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(user.passwordHash));
  if (!ok) {
    throw Object.assign(new Error("用户名或密码错误"), { status: 401 });
  }

  return toPublicUser(user);
}

export function verifyEmailToken(token) {
  const raw = String(token ?? "").trim();
  if (!raw) throw Object.assign(new Error("验证链接无效"), { status: 400 });

  const users = loadUsers().map(migrateUser);
  const hash = hashToken(raw);
  const idx = users.findIndex((u) => u.emailVerificationTokenHash === hash);
  if (idx < 0) throw Object.assign(new Error("验证链接无效或已使用"), { status: 400 });

  const user = users[idx];
  const exp = Date.parse(user.emailVerificationExpires || "");
  if (!Number.isFinite(exp) || Date.now() > exp) {
    throw Object.assign(new Error("验证链接已过期，请重新发送验证邮件"), { status: 400 });
  }

  users[idx] = {
    ...user,
    emailVerified: true,
    emailVerificationTokenHash: undefined,
    emailVerificationCodeHash: undefined,
    emailVerificationExpires: undefined,
  };
  saveUsers(users);
  return toPublicUser(users[idx]);
}

export function verifyEmailCodeForUser(userId, code) {
  const rawCode = String(code ?? "").trim();
  if (!/^\d{6}$/.test(rawCode)) {
    throw Object.assign(new Error("请输入 6 位邮箱验证码"), { status: 400 });
  }

  const users = loadUsers().map(migrateUser);
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) throw Object.assign(new Error("用户不存在"), { status: 404 });

  const user = users[idx];
  if (user.emailVerified) {
    throw Object.assign(new Error("邮箱已验证"), { status: 400 });
  }

  const exp = Date.parse(user.emailVerificationExpires || "");
  if (!Number.isFinite(exp) || Date.now() > exp) {
    throw Object.assign(new Error("验证码已过期，请重新发送验证邮件"), { status: 400 });
  }

  const expected = user.emailVerificationCodeHash;
  if (!expected) {
    throw Object.assign(new Error("请重新发送验证邮件后再试"), { status: 400 });
  }

  const actual = hashToken(rawCode);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) {
    throw Object.assign(new Error("邮箱验证码错误"), { status: 400 });
  }

  users[idx] = {
    ...user,
    emailVerified: true,
    emailVerificationTokenHash: undefined,
    emailVerificationCodeHash: undefined,
    emailVerificationExpires: undefined,
  };
  saveUsers(users);
  return toPublicUser(users[idx]);
}

export async function resendVerificationEmail(userId) {
  const users = loadUsers().map(migrateUser);
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) throw Object.assign(new Error("用户不存在"), { status: 404 });

  const user = users[idx];
  if (user.emailVerified) {
    throw Object.assign(new Error("邮箱已验证"), { status: 400 });
  }
  if (!user.email) {
    throw Object.assign(new Error("该账号无需邮箱验证"), { status: 400 });
  }

  const { token, code, ...verifyFields } = createVerificationFields();
  users[idx] = { ...user, ...verifyFields };
  saveUsers(users);

  const mailResult = await sendVerificationEmail({ to: user.email, username: user.username, token, code });
  const publicUser = toPublicUser(users[idx]);
  if (mailResult.devMode) {
    return {
      user: publicUser,
      devMode: true,
      code: process.env.NODE_ENV !== "production" ? mailResult.code : undefined,
      verifyUrl: process.env.NODE_ENV !== "production" ? mailResult.verifyUrl : undefined,
    };
  }
  return { user: publicUser, devMode: false };
}

export function getUserById(userId) {
  if (!userId) return null;
  const user = loadUsers().map(migrateUser).find((u) => u.id === userId) ?? null;
  return user;
}

export function ensureUserMemoryDir(userId) {
  const dir = path.join(USERS_DIR, userId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function createUserSessionToken(userId) {
  const exp = Date.now() + MAX_AGE_SEC * 1000;
  const payload = `${userId}.${exp}`;
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyUserSessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [userId, expStr, sig] = parts;
  const payload = `${userId}.${expStr}`;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;

  const user = getUserById(userId);
  if (!user) return null;

  return toPublicUser(user);
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) out[k] = decodeURIComponent(v.join("="));
  }
  return out;
}

export function getUserSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] || "";
}

export function setUserSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE_SEC}${secure}`,
  );
}

export function clearUserSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
  );
}

export function getAuthUserFromRequest(req) {
  const token = getUserSessionFromRequest(req);
  return verifyUserSessionToken(token);
}

export function requireUserAuth(req, res, next) {
  const user = getAuthUserFromRequest(req);
  if (!user) {
    res.status(401).json({ ok: false, error: "请先登录" });
    return;
  }
  req.user = user;
  next();
}

export function requireVerifiedEmail(req, res, next) {
  if (!req.user?.emailVerified && !req.user?.isAdmin) {
    res.status(403).json({ ok: false, error: "请先验证邮箱后再使用此功能" });
    return;
  }
  next();
}

export function requireAdminAuth(req, res, next) {
  const user = getAuthUserFromRequest(req);
  if (!user?.isAdmin) {
    res.status(403).json({ ok: false, error: "需要管理员权限" });
    return;
  }
  req.user = user;
  next();
}

export function listAllUsers() {
  return loadUsers().map(migrateUser);
}

export function bootstrapAdminUser(username, password) {
  const nameError = validateUsername(username);
  if (nameError) throw Object.assign(new Error(nameError), { status: 400 });

  const passError = validatePassword(password);
  if (passError) throw Object.assign(new Error(passError), { status: 400 });

  const name = String(username).trim();
  const users = loadUsers().map(migrateUser);
  const idx = users.findIndex((u) => u.username.toLowerCase() === name.toLowerCase());

  if (idx >= 0) {
    const existing = users[idx];
    if (!existing.isAdmin) {
      users[idx] = { ...existing, isAdmin: true, emailVerified: true };
      saveUsers(users);
    }
    return toPublicUser(users[idx]);
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const user = {
    id: randomUUID(),
    username: name,
    email: undefined,
    emailVerified: true,
    isAdmin: true,
    salt,
    passwordHash: hashPassword(password, salt),
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  saveUsers(users);
  ensureUserMemoryDir(user.id);
  return toPublicUser(user);
}

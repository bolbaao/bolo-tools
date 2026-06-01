import nodemailer from "nodemailer";
import { env } from "./env.mjs";

function smtpConfigured() {
  return Boolean(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASS"));
}

function formatSmtpError(err) {
  const msg = String(err?.message || err || "");
  if (msg.includes("535")) {
    return (
      "QQ 邮箱 SMTP 登录失败（535）。请确认：① 已在 mail.qq.com → 设置 → 账号与安全 中开启 SMTP 服务；" +
      "② SMTP_PASS 填的是授权码（不是 QQ 登录密码）；③ 若多次失败请等 15 分钟或重新生成授权码。" +
      " 详情：https://help.mail.qq.com/detail/108/1023"
    );
  }
  if (msg.includes("EAUTH") || msg.includes("Invalid login")) {
    return "邮件服务器认证失败，请检查 SMTP 账号与授权码是否正确。";
  }
  return msg || "邮件发送失败";
}

function createTransport() {
  const port = Number(env("SMTP_PORT", "465")) || 465;
  const secure = env("SMTP_SECURE", port === 465 ? "true" : "false") !== "false";
  return nodemailer.createTransport({
    host: env("SMTP_HOST"),
    port,
    secure,
    auth: {
      user: env("SMTP_USER"),
      pass: env("SMTP_PASS"),
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    tls: { minVersion: "TLSv1.2" },
  });
}

async function sendViaSmtp(sendFn, devFallback) {
  if (!smtpConfigured()) {
    console.log("\n📧 [开发模式] 未配置 SMTP");
    if (devFallback.code) console.log(`   验证码: ${devFallback.code}`);
    if (devFallback.verifyUrl) console.log(`   链接: ${devFallback.verifyUrl}`);
    console.log("");
    return { devMode: true, ...devFallback };
  }

  try {
    await sendFn();
    return { devMode: false };
  } catch (err) {
    const hint = formatSmtpError(err);
    if (process.env.NODE_ENV !== "production") {
      console.error("\n📧 [SMTP 失败]", hint);
      if (devFallback.code) console.log(`   开发回退验证码: ${devFallback.code}`);
      if (devFallback.verifyUrl) console.log(`   开发回退链接: ${devFallback.verifyUrl}\n`);
      return { devMode: true, smtpError: hint, ...devFallback };
    }
    throw Object.assign(new Error(hint), { status: 502, cause: err });
  }
}

export function getAppBaseUrl() {
  return (env("APP_BASE_URL") || "http://127.0.0.1:3000").replace(/\/$/, "");
}

export async function sendVerificationEmail({ to, username, token, code }) {
  const verifyUrl = `${getAppBaseUrl()}/tools/verify-email?token=${encodeURIComponent(token)}`;
  const from = env("SMTP_FROM") || env("SMTP_USER") || "noreply@pineapple.local";
  const subject = "春雨集 · 验证你的邮箱";
  const codeLine = code ? `\n验证码：${code}（10 分钟内有效，也可在注册页填写）\n` : "";
  const text = `你好 ${username}，\n\n请点击以下链接验证邮箱（24 小时内有效）：\n${verifyUrl}${codeLine}\n如非本人操作，请忽略此邮件。`;
  const html = `
    <div style="font-family:sans-serif;line-height:1.6;color:#222">
      <p>你好 <strong>${username}</strong>，</p>
      <p>欢迎注册春雨集。请点击下方按钮验证邮箱（24 小时内有效）：</p>
      <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 18px;background:#10b981;color:#fff;text-decoration:none;border-radius:999px">验证邮箱</a></p>
      ${code ? `<p style="margin:16px 0;font-size:18px;letter-spacing:2px"><strong>验证码：${code}</strong><br><span style="font-size:13px;color:#666">10 分钟内有效，也可在注册页填写</span></p>` : ""}
      <p style="color:#666;font-size:13px">或复制链接到浏览器：<br>${verifyUrl}</p>
    </div>
  `;

  if (!smtpConfigured()) {
    console.log("\n📧 [开发模式] 未配置 SMTP，验证信息：");
    console.log(`   链接: ${verifyUrl}`);
    if (code) console.log(`   验证码: ${code}\n`);
    else console.log("");
    return { devMode: true, verifyUrl, code };
  }

  const transport = createTransport();
  return sendViaSmtp(
    () => transport.sendMail({ from, to, subject, text, html }),
    { verifyUrl, code },
  );
}

export async function sendRegistrationCodeEmail({ to, code }) {
  const from = env("SMTP_FROM") || env("SMTP_USER") || "noreply@pineapple.local";
  const subject = "春雨集 · 邮箱验证码";
  const text = `你的注册验证码是：${code}\n\n10 分钟内有效，请勿泄露给他人。`;
  const html = `
    <div style="font-family:sans-serif;line-height:1.6;color:#222">
      <p>你好，</p>
      <p>你正在注册春雨集，验证码为：</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;color:#10b981">${code}</p>
      <p style="color:#666;font-size:13px">10 分钟内有效，请勿泄露给他人。</p>
    </div>
  `;

  if (!smtpConfigured()) {
    console.log("\n📧 [开发模式] 未配置 SMTP，注册验证码：");
    console.log(`   ${code}\n`);
    return { devMode: true, code };
  }

  const transport = createTransport();
  return sendViaSmtp(
    () => transport.sendMail({ from, to, subject, text, html }),
    { code },
  );
}

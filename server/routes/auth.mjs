import { Router } from "express";
import { createCaptcha, verifyCaptcha } from "../lib/captcha.mjs";
import { HttpError, sendError } from "../lib/http-error.mjs";
import {
  authenticateUser,
  clearUserSessionCookie,
  createUserSessionToken,
  getAuthUserFromRequest,
  registerUser,
  resendVerificationEmail,
  sendRegistrationVerificationCode,
  setUserSessionCookie,
  verifyEmailCodeForUser,
  verifyEmailToken,
} from "../lib/user-auth.mjs";

const router = Router();

router.get("/captcha", (_req, res) => {
  try {
    const captcha = createCaptcha();
    res.json({ ok: true, captchaId: captcha.id, image: captcha.image });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

router.post("/send-code", async (req, res) => {
  try {
    const { email } = req.body ?? {};
    const result = await sendRegistrationVerificationCode(email);
    res.json({ ok: true, ...result });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

router.post("/register", async (req, res) => {
  try {
    const { username, password, confirmPassword, captchaId, captchaCode } = req.body ?? {};
    verifyCaptcha(captchaId, captchaCode);
    const user = await registerUser(username, password, confirmPassword);
    const token = createUserSessionToken(user.id);
    setUserSessionCookie(res, token);
    res.json({ ok: true, user, message: "注册成功" });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

router.post("/login", (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    const user = authenticateUser(username, password);
    const token = createUserSessionToken(user.id);
    setUserSessionCookie(res, token);
    res.json({ ok: true, user });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

router.post("/logout", (_req, res) => {
  clearUserSessionCookie(res);
  res.json({ ok: true });
});

router.get("/session", (req, res) => {
  const user = getAuthUserFromRequest(req);
  res.json({ ok: true, authenticated: Boolean(user), user: user ?? undefined });
});

router.get("/verify-email", (req, res) => {
  try {
    const user = verifyEmailToken(req.query.token);
    res.json({ ok: true, user, message: "邮箱验证成功" });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

router.post("/verify-code", (req, res) => {
  try {
    const authUser = getAuthUserFromRequest(req);
    if (!authUser) throw new HttpError(401, "请先登录");
    const { code } = req.body ?? {};
    const user = verifyEmailCodeForUser(authUser.id, code);
    res.json({ ok: true, user, message: "邮箱验证成功" });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

router.post("/resend-verification", async (req, res) => {
  try {
    const authUser = getAuthUserFromRequest(req);
    if (!authUser) throw new HttpError(401, "请先登录");
    const result = await resendVerificationEmail(authUser.id);
    const message = result.devMode
      ? "未配置邮件服务，验证信息已输出至服务器控制台"
      : "验证邮件已重新发送（含验证码）";
    res.json({ ok: true, ...result, message });
  } catch (err) {
    sendError(res, err.status ? err : new HttpError(500, err.message));
  }
});

export default router;

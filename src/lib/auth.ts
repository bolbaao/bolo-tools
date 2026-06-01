import { apiGet, apiPost } from "@/lib/api";

export type AuthUser = {
  id: string;
  username: string;
  email?: string;
  emailVerified: boolean;
  isAdmin?: boolean;
};

const cred = { credentials: "include" as const };

export async function checkAuthSession() {
  const data = await apiGet<{ ok: boolean; authenticated: boolean; user?: AuthUser }>(
    "/api/auth/session",
    cred,
  );
  return data.authenticated ? data.user ?? null : null;
}

export async function loginUser(username: string, password: string) {
  const data = await apiPost<{ ok: boolean; user: AuthUser }>(
    "/api/auth/login",
    { username, password },
    cred,
  );
  return data.user;
}

export async function sendRegistrationCode(email: string) {
  const data = await apiPost<{
    ok: boolean;
    message?: string;
    devMode?: boolean;
    code?: string;
  }>("/api/auth/send-code", { email }, cred);
  return data;
}

export async function registerUser(
  username: string,
  email: string,
  password: string,
  confirmPassword: string,
  verificationCode: string,
) {
  const data = await apiPost<{ ok: boolean; user: AuthUser; message?: string }>(
    "/api/auth/register",
    { username, email, password, confirmPassword, verificationCode },
    cred,
  );
  return data;
}

export async function logoutUser() {
  await apiPost("/api/auth/logout", {}, cred);
}

export async function verifyEmailToken(token: string) {
  const data = await apiGet<{ ok: boolean; user: AuthUser; message?: string }>(
    `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
    cred,
  );
  return data;
}

export async function verifyEmailCode(code: string) {
  const data = await apiPost<{ ok: boolean; user: AuthUser; message?: string }>(
    "/api/auth/verify-code",
    { code },
    cred,
  );
  return data;
}

export async function resendVerificationEmail() {
  const data = await apiPost<{
    ok: boolean;
    user: AuthUser;
    message?: string;
    devMode?: boolean;
    code?: string;
    verifyUrl?: string;
  }>("/api/auth/resend-verification", {}, cred);
  return data;
}

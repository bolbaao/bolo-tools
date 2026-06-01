"use client";

import {
  checkAuthSession,
  loginUser,
  logoutUser,
  registerUser,
  resendVerificationEmail,
  sendRegistrationCode,
  type AuthUser,
} from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string,
    confirmPassword: string,
    verificationCode: string,
  ) => Promise<string | undefined>;
  sendRegisterCode: (email: string) => Promise<{ message: string; devMode?: boolean; code?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  resendVerification: () => Promise<{
    message?: string;
    devMode?: boolean;
    code?: string;
    verifyUrl?: string;
  }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const sessionUser = await checkAuthSession();
      setUser(sessionUser);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const next = await loginUser(username, password);
    setUser(next);
  }, []);

  const sendRegisterCode = useCallback(async (email: string) => {
    const data = await sendRegistrationCode(email);
    return {
      message: data.message || "验证码已发送",
      devMode: data.devMode,
      code: data.code,
    };
  }, []);

  const register = useCallback(
    async (
      username: string,
      email: string,
      password: string,
      confirmPassword: string,
      verificationCode: string,
    ) => {
      const data = await registerUser(
        username,
        email,
        password,
        confirmPassword,
        verificationCode,
      );
      setUser(data.user);
      return data.message;
    },
    [],
  );

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  const resendVerification = useCallback(async () => {
    try {
      const data = await resendVerificationEmail();
      setUser(data.user);
      return {
        message: data.message,
        devMode: data.devMode,
        code: data.code,
        verifyUrl: data.verifyUrl,
      };
    } catch (e) {
      throw e instanceof ApiError ? e : new ApiError("发送失败");
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      sendRegisterCode,
      logout,
      refresh,
      resendVerification,
    }),
    [user, loading, login, register, sendRegisterCode, logout, refresh, resendVerification],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

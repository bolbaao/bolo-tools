import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import EmailVerifyBanner from "@/components/EmailVerifyBanner";
import AdminDeveloperBanner from "@/components/AdminDeveloperBanner";
import { AuthProvider } from "@/contexts/AuthContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "春雨集",
  description:
    "把日常变得更有想象力。音乐转换、视频提取、AI 创作与热点工具 — 简洁专业的 AI 工具箱。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen flex-col antialiased">
        <div className="fixed inset-0 bg-aurora pointer-events-none" />
        <div className="fixed inset-0 bg-grid pointer-events-none" />
        <div className="glow-orb glow-orb-a top-[-15%] left-[20%] h-[32rem] w-[32rem] bg-blue-600/25" />
        <div className="glow-orb glow-orb-b bottom-[-10%] right-[5%] h-96 w-96 bg-violet-600/20" />
        <div className="glow-orb glow-orb-a top-[50%] left-[-10%] h-72 w-72 bg-indigo-500/15" />
        <div className="relative flex min-h-screen flex-col">
          <AuthProvider>
            <Header />
            <EmailVerifyBanner />
            <AdminDeveloperBanner />
            <main className="flex-1">{children}</main>
            <Footer />
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}

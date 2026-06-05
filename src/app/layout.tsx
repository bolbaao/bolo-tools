import type { Metadata, Viewport } from "next";
import AppShell from "@/components/AppShell";
import PageTransition from "@/components/PageTransition";
import EmailVerifyBanner from "@/components/EmailVerifyBanner";
import AdminDeveloperBanner from "@/components/AdminDeveloperBanner";
import { AuthProvider } from "@/contexts/AuthContext";
import { PUBLIC_SITE_TAGLINE } from "@/lib/site-content";
import "./globals.css";

export const metadata: Metadata = {
  title: "春雨集",
  description: `${PUBLIC_SITE_TAGLINE} — 音乐转换、视频提取、AI 创作与热点工具，简洁好用的创作者工具箱。`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="app-viewport flex h-dvh flex-col overflow-hidden antialiased">
        <div className="fixed inset-0 bg-aurora pointer-events-none" />
        <div className="fixed inset-0 bg-grid pointer-events-none" />
        <div className="glow-orb glow-orb-a top-[-15%] left-[20%] h-[32rem] w-[32rem] bg-accent/20" />
        <div className="glow-orb glow-orb-b bottom-[-10%] right-[5%] h-96 w-96 bg-accent-deep/15" />
        <div className="glow-orb glow-orb-a top-[50%] left-[-10%] h-72 w-72 bg-accent-deep/10" />
        <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <AuthProvider>
            <AppShell>
              <EmailVerifyBanner />
              <AdminDeveloperBanner />
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <PageTransition>{children}</PageTransition>
              </div>
            </AppShell>
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}

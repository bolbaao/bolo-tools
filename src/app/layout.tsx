import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "菠萝工具箱 | 个人创作者一站式工具",
  description: "影视资源搜索、制作爬虫、图片处理、AI 聊天、热点中心、音视频工具等 — 简洁高效的创作工具集合。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen flex-col antialiased">
        <div className="fixed inset-0 bg-grid pointer-events-none opacity-40" />
        <div className="glow-orb top-0 left-1/4 h-96 w-96 bg-violet-600/15" />
        <div className="glow-orb bottom-0 right-1/4 h-80 w-80 bg-fuchsia-600/10" />
        <div className="relative flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}

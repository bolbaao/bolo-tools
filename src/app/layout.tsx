import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "菠萝工具箱 | 个人创作者一站式工具",
  description:
    "影视资源搜索、制作爬虫、图片处理、AI 聊天、热点中心、音视频工具等 — 简洁高效的创作工具集合。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={inter.variable}>
      <body className="flex min-h-screen flex-col antialiased">
        <div className="fixed inset-0 bg-aurora pointer-events-none" />
        <div className="fixed inset-0 bg-grid pointer-events-none" />
        <div className="glow-orb glow-orb-a top-[-15%] left-[20%] h-[32rem] w-[32rem] bg-blue-600/25" />
        <div className="glow-orb glow-orb-b bottom-[-10%] right-[5%] h-96 w-96 bg-violet-600/20" />
        <div className="glow-orb glow-orb-a top-[50%] left-[-10%] h-72 w-72 bg-indigo-500/15" />
        <div className="relative flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}

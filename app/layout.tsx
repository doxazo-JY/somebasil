import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import Sidebar from "@/components/ui/Sidebar";
import FloatingAssistant from "@/components/ui/FloatingAssistant";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "썸바실 관리",
  description: "카페 썸바실 재무 관리 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geist.variable} h-full antialiased`}>
      <body className="h-full flex flex-col md:flex-row bg-gray-50">
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
        {/* 스크롤바 자리를 항상 비워 둠 — 내용 길이에 따라 스크롤바가 생겼다 사라지며 화면 폭이 흔들리지 않게 */}
        <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable] pb-16 md:pb-0">{children}</main>
        {/* 오른쪽 아래 비서 AI 버튼 (출퇴근 화면 제외) */}
        <Suspense fallback={null}>
          <FloatingAssistant />
        </Suspense>
      </body>
    </html>
  );
}

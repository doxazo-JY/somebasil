import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/ui/Sidebar";

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
        <Sidebar />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { DemoBanner } from "@/components/DemoBanner";
import { ThemeScript } from "@/components/ThemeScript";
import { ShortcutsModal } from "@/components/ShortcutsModal";

export const metadata: Metadata = {
  title: "PolyMath Tutor — 융합형 AI 학습·실습 플랫폼",
  description:
    "개념 문해력부터 실전 코딩 디버깅, 팀 협업과 실시간 퀴즈까지 아우르는 올인원 온라인 학습 페이스메이커.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <ThemeScript />
      </head>
      <body className="font-sans antialiased">
        <DemoBanner />
        <Navbar />
        <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
          {children}
        </main>
        <ShortcutsModal />
      </body>
    </html>
  );
}

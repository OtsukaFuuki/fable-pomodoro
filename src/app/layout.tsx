import type { Metadata } from "next";
import { Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";

// 数字・見出しは Light(300) を大きく・字間広めに使うのがデザインの規範（spec §2.1）。
// next/font はビルド時にフォントを自己ホストするので、外部通信ゼロの要件（Phase 4）も満たせる
const zenKaku = Zen_Kaku_Gothic_New({
  weight: ["300", "400"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "夜凪",
  description: "環境音ミキサー付きポモドーロタイマー",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className={`${zenKaku.className} bg-abyss text-frost antialiased`}>
        {children}
      </body>
    </html>
  );
}

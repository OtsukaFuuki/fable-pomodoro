import type { Metadata, Viewport } from "next";
import { Zen_Kaku_Gothic_New } from "next/font/google";
import { SwRegister } from "@/components/SwRegister";
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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "夜凪",
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icon-192.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0E14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className={`${zenKaku.className} bg-abyss text-frost antialiased`}>
        <SwRegister />
        {children}
      </body>
    </html>
  );
}

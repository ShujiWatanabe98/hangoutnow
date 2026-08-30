import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BasePathFetch } from "@/components/base-path-fetch";
import { withBasePath } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "RoboCare One | ロボケアセンター統合基幹システム",
  description: "顧客・予約・HAL・安全・施術をつなぐロボケアセンター統合基幹システム",
  applicationName: "RoboCare One",
  manifest: withBasePath("/manifest.webmanifest"),
  robots: { index: false, follow: false, nocache: true },
  appleWebApp: { capable: true, title: "RoboCare One", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#087f71",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <head><BasePathFetch /></head>
      <body>{children}</body>
    </html>
  );
}

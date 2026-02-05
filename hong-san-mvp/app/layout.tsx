import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "홍산마늘 1농가 1가족",
  description: "홍산마늘 1농가 1가족 웹앱 MVP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
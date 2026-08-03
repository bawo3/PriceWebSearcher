import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "WebSearcher — 통합 비교 검색",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

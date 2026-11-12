import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "규ck — 롤 내전 팀 밸런서", description: "친구들과 더 재밌는 내전을 위한 핑크 픽셀 팀 밸런서", icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body>{children}</body></html>; }

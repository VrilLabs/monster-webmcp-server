import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MonsterWebMCP & Figma MCP Access — WebMCP Tools",
  description:
    "Universally compatible WebMCP tools for the agentic web. MonsterWebMCP is a production-ready WebMCP runtime. Figma MCP Access wraps the Figma REST API for MCP clients.",
  keywords: [
    "WebMCP",
    "MCP",
    "Model Context Protocol",
    "Figma",
    "AI agents",
    "browser tools",
    "MonsterWebMCP",
  ],
  authors: [{ name: "WebMCP Tools" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "MonsterWebMCP & Figma MCP Access",
    description: "Universally compatible WebMCP tools for the agentic web",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

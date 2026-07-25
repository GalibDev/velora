import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3001";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    metadataBase: new URL(origin),
    title: "Velora — Save what you love",
    description: "নিজের বা অনুমতিপ্রাপ্ত YouTube ভিডিও সহজে সেভ করুন।",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "Velora — Save what you love",
      description: "নিজের বা অনুমতিপ্রাপ্ত YouTube ভিডিও সহজে সেভ করুন।",
      images: [{ url: `${origin}/og.png`, width: 1536, height: 909, alt: "Velora video saver" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Velora — Save what you love",
      description: "নিজের বা অনুমতিপ্রাপ্ত YouTube ভিডিও সহজে সেভ করুন।",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bn">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}

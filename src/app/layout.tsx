import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://examspace.xyz"),
  title: {
    default: "Examspace — Crowdsourced exam question bank",
    template: "%s · Examspace",
  },
  description:
    "Study smarter with thousands of past exam questions by school, department, and course. Upload, contribute, and earn — built for Nigerian university students.",
  applicationName: "Examspace",
  keywords: [
    "Examspace",
    "past questions",
    "Nigerian university",
    "exam practice",
    "question bank",
  ],
  openGraph: {
    title: "Examspace — Crowdsourced exam question bank",
    description:
      "Access thousands of past questions, upload your papers, and earn from contributions.",
    url: "https://examspace.xyz",
    siteName: "Examspace",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Examspace",
    description: "Crowdsourced exam question bank for Nigerian students.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}

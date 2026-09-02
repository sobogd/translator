import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

// Global CSS must live on the ROOT layout: it used to be imported only by the
// (en)/ and ru/ nested layouts, which left every route outside those groups
// (/pricing, the [seg] locale homes and all pair pages) rendering unstyled.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1612" },
  ],
  // iOS Safari auto-zooms on focus into any input under 16px — the
  // composer textarea is smaller than that, so pin the viewport instead.
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "IQ Translate — Instant Voice Translation App",
    template: "%s | IQ Translate",
  },
  description:
    "Speak naturally and get an instant translation, spoken or written, in 186 languages. Sign in with Google, no downloads, no passwords.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "IQ Translate",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

// No <html>/<body> here — each locale's own layout (app/(en)/layout.tsx,
// app/ru/layout.tsx) owns the document shell, same split as iq-rest's
// apps/landing/app/layout.tsx.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}

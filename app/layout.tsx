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
  // No maximumScale/userScalable here on purpose: blocking pinch-zoom is an
  // accessibility failure (Lighthouse a11y). The iOS focus-zoom it used to
  // work around is already handled the correct way — every input/textarea in
  // the widget is `text-base` (16px), which iOS Safari never auto-zooms.
};

// No `title.template` — every page's own title (locale homes, pair pages,
// /pricing, legal) already carries the brand, so a template appended a second
// "| IQ Translate" to all 211 of them.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "IQ Translate — Instant Voice Translation App",
  description:
    "Speak naturally and get an instant translation, spoken or written, in 186 languages. Sign in with Google, no downloads, no passwords.",
  // Site-wide social preview. Pages may override the copy, but never need to
  // repeat the image (public/og.png, 1200x630 — see scripts/gen-og-image.py).
  openGraph: {
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "IQ Translate" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "IQ Translate",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
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

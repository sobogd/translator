import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";

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

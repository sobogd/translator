import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://translate.iq-factura.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "IQ Translate — Instant Voice Translation App",
    template: "%s | IQ Translate",
  },
  description:
    "Speak naturally and get an instant translation, spoken or written, in 186 languages. Sign in with Google, no downloads, no passwords.",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "IQ Translate",
    title: "IQ Translate — Instant Voice Translation App",
    description:
      "Speak naturally and get an instant translation, spoken or written, in 186 languages. No downloads, no passwords.",
  },
  twitter: {
    card: "summary",
    title: "IQ Translate — Instant Voice Translation App",
    description:
      "Speak naturally and get an instant translation, spoken or written, in 186 languages.",
  },
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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1612" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

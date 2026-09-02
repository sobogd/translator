import type { Viewport } from "next";
import "../globals.css";

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

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

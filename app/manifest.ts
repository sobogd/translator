import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // `id` pins the app's identity to what it was before start_url moved, so
    // existing installs update in place instead of becoming a second app.
    id: "/",
    name: "IQ Translate",
    short_name: "Translate",
    description: "Voice and text translator between any languages",
    // Installed copies open the workspace, not the marketing page. proxy.ts
    // sends /app on to the visitor's own locale (/es/app, /ru/app, …).
    start_url: "/app",
    // The whole site stays inside the installed app — a pair page opened from
    // a link should not bounce the user out into the browser.
    scope: "/",
    display: "standalone",
    background_color: "#faf8f5",
    theme_color: "#d65200",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

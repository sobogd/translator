import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: BRAND,
    short_name: "Translate",
    description: "Voice and text translator between any languages",
    // The product (the translator widget) is embedded at the top of the home
    // window on every page — there is no separate /app route anymore, so an
    // installed copy simply opens the home page (mirrors iq-mermaid).
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf8f5",
    theme_color: "#d9534f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

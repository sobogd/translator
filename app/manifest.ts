import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IQ Translate",
    short_name: "Translate",
    description: "Голосовой и текстовый переводчик между любыми языками",
    start_url: "/",
    display: "standalone",
    background_color: "#faf8f5",
    theme_color: "#d65200",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

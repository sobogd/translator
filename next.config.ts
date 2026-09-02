import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow LAN access in dev (phone/other device) — Next 16 blocks
  // /_next/ dev resources from non-localhost origins by default.
  allowedDevOrigins: ["192.168.1.169"],
  // 301s for the pre-pair-pages feature routes (removed 2026-09-02).
  // Permanent redirects are forever — add, don't delete.
  async redirects() {
    return [
      { source: "/text-translator", destination: "/", permanent: true },
      { source: "/instant-voice-translator", destination: "/", permanent: true },
      { source: "/ru/perevod-teksta-onlayn", destination: "/ru", permanent: true },
      { source: "/ru/perevodchik-rechi-v-tekst", destination: "/ru", permanent: true },
    ];
  },
};

export default nextConfig;

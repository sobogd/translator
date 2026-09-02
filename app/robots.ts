import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// AI crawlers are listed explicitly rather than left to the wildcard. The
// wildcard already allows them, but an explicit group is what the operators
// document, and it makes the decision visible instead of accidental:
// training crawlers (GPTBot, ClaudeBot, Google-Extended, meta-external) are
// allowed alongside the answer-time ones (OAI-SearchBot, Claude-SearchBot,
// PerplexityBot) — being cited is worth more here than withholding copy that
// is public marketing text anyway.
const AI_AGENTS = [
  // Training / dataset crawlers.
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "meta-externalagent",
  "Bytespider",
  "CCBot",
  // Answer-time retrieval — these are the ones that produce citations.
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /api/ is the app's own JSON surface, nothing indexable. The two
        // query patterns are tracking noise: no page varies on them, and the
        // canonical tag already points at the clean URL, but crawling them
        // wastes budget on a 259-page site with no authority to spare.
        disallow: ["/api/", "/*?*utm_", "/*?*from="],
      },
      { userAgent: AI_AGENTS, allow: "/", disallow: ["/api/"] },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

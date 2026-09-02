import { prisma } from "./prisma";
import { getServerSessionEmail, computeFingerprint } from "./auth";
import type { Topic, TopicDetail } from "./types";

export type InitialTopics = {
  topics: Topic[];
  topic: TopicDetail | null;
};

// SSR twin of GET /api/topics + GET /api/topics/:id — the translator widget
// renders with its topic list and the last-opened thread already in the HTML
// (no bootstrap fetch, no loader). Identity comes from the session cookie or,
// for anonymous visitors, the same request-derived fingerprint resolveIdentity
// uses (see computeFingerprint in lib/auth.ts); the iqt_last_topic cookie
// (written client-side on topic switch) picks which thread to hydrate,
// falling back to the most recently used.
export async function getServerTopics(): Promise<InitialTopics | null> {
  const email = await getServerSessionEmail();
  let ownerKey: string;
  if (email) {
    ownerKey = email;
  } else {
    const { headers } = await import("next/headers");
    ownerKey = `fp:${computeFingerprint(await headers())}`;
  }

  const rows = await prisma.topic.findMany({
    where: { ownerKey },
    orderBy: { lastUsedAt: "desc" },
    include: { _count: { select: { translations: true } } },
  });
  const topics: Topic[] = rows.map((t) => ({
    id: t.id,
    title: t.title,
    sourceLang: t.sourceLang,
    targetLang: t.targetLang,
    lastUsedAt: t.lastUsedAt.toISOString(),
    createdAt: t.createdAt.toISOString(),
    translationCount: t._count.translations,
  }));

  let topic: TopicDetail | null = null;
  if (rows.length > 0) {
    const { cookies } = await import("next/headers");
    const lastId = (await cookies()).get("iqt_last_topic")?.value;
    const pickId = topics.find((t) => t.id === lastId)?.id ?? topics[0].id;
    const detail = await prisma.topic.findUnique({
      where: { id: pickId },
      include: { translations: { orderBy: { createdAt: "desc" }, take: 100 } },
    });
    if (detail && detail.ownerKey === ownerKey) {
      topic = {
        id: detail.id,
        title: detail.title,
        sourceLang: detail.sourceLang,
        targetLang: detail.targetLang,
        lastUsedAt: detail.lastUsedAt.toISOString(),
        createdAt: detail.createdAt.toISOString(),
        translations: detail.translations.map((r) => ({
          id: r.id,
          sourceLang: r.sourceLang,
          transcript: r.transcript,
          translation: r.translation,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    }
  }
  return { topics, topic };
}

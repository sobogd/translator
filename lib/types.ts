export type Lang = "ru" | "es";

export type TranslateResult = {
  source_lang: Lang;
  transcript: string;
  translation: string;
  id?: string;
  audioUrl?: string | null;
};

export type HistoryRow = {
  id: string;
  mode: "audio" | "text";
  sourceLang: Lang;
  transcript: string;
  translation: string;
  audioUrl: string | null;
  createdAt: string;
};

export type Thread = {
  id: string;
  title: string;
  context: string;
  createdAt: string;
};

export type ThreadWithCount = Thread & { _count: { translations: number } };

export type ThreadDetail = Thread & { translations: HistoryRow[] };

export const langLabel = (l?: string) =>
  l === "ru" ? "🇷🇺 Русский" : l === "es" ? "🇪🇸 Español" : "";
export const targetLabel = (l?: string) =>
  l === "ru" ? "🇪🇸 Español" : l === "es" ? "🇷🇺 Русский" : "";

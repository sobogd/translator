export type Lang = string; // ISO 639-1 code

export interface Topic {
  id: string;
  title: string | null;
  sourceLang: string | null;
  targetLang: string;
  lastUsedAt: string;
  createdAt: string;
  translationCount?: number;
}

export interface HistoryRow {
  id: string;
  sourceLang: string;
  transcript: string;
  translation: string;
  createdAt: string;
}

export interface TopicDetail extends Topic {
  translations: HistoryRow[];
}

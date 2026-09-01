export type Lang = string; // ISO 639-1 code

export interface Chat {
  id: string;
  langA: string;
  langB: string;
  lastUsedAt: string;
  createdAt: string;
  translationCount?: number;
}

export interface HistoryRow {
  id: string;
  mode: string;
  sourceLang: string;
  transcript: string;
  translation: string;
  audioUrl: string | null;
  createdAt: string;
}

export interface ChatDetail extends Chat {
  translations: HistoryRow[];
}

export interface TranslationResult {
  translation: string;
  contextNote?: string;
  relatedTopics?: string[];
  topic?: string;
  tags?: string[];
}

export interface TranslationEntry {
  id: string;
  originalText: string;
  result: TranslationResult;
  timestamp: number;
  isFavorite?: boolean;
}

export interface AppSettings {
  apiKey: string;
  popupDuration: number;
  theme: "system" | "light" | "dark";
  historyLimit: number;
  enableTTS: boolean;
  enableSound: boolean;
  hasCompletedOnboarding: boolean;
  vaultPath: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  popupDuration: 10,
  theme: "system",
  historyLimit: 100,
  enableTTS: true,
  enableSound: true,
  hasCompletedOnboarding: false,
  vaultPath: "",
};

export interface UserStats {
  totalTranslations: number;
  todayTranslations: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  favoriteCount: number;
}

export const DEFAULT_STATS: UserStats = {
  totalTranslations: 0,
  todayTranslations: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: "",
  favoriteCount: 0,
};

export function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

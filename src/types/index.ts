export interface TranslationResult {
  translation: string;
  explanation?: string;
  original_context?: string;
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
  hotkey: string;
  popupDuration: number;
  theme: "system" | "light" | "dark";
  startupOnBoot: boolean;
  historyLimit: number;
  // Audio settings
  enableTTS: boolean;
  enableSound: boolean;
  // UX settings
  hasCompletedOnboarding: boolean;
  showFloatingIndicator: boolean;
  autoTranslateClipboard: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  hotkey: "Ctrl+Shift+C",
  popupDuration: 10,
  theme: "system",
  startupOnBoot: false,
  historyLimit: 100,
  // Audio defaults
  enableTTS: true,
  enableSound: true,
  // UX defaults
  hasCompletedOnboarding: false,
  showFloatingIndicator: true,
  autoTranslateClipboard: false,
};

// User statistics for motivation
export interface UserStats {
  totalTranslations: number;
  todayTranslations: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // YYYY-MM-DD format
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

// Helper to get today's date string
export function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

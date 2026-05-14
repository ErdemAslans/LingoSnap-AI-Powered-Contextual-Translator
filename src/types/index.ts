export interface TranslationResult {
  translation: string;
  contextNote?: string;
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

import type { CefrLevel, ExerciseType } from "./srs";

export type ExerciseMix = "balanced" | "production_heavy" | "recognition_heavy";

export interface AppSettings {
  apiKey: string;
  popupDuration: number;
  theme: "system" | "light" | "dark";
  historyLimit: number;
  enableTTS: boolean;
  enableSound: boolean;
  hasCompletedOnboarding: boolean;
  vaultPath: string;
  // User-controlled master switch for the global mouse hook.
  // false = quiet mode, no auto-translation. true = active.
  autoTranslateEnabled: boolean;
  // SRS / tutor settings
  cefrLevel: CefrLevel;
  dailyNewWordGoal: number;
  exerciseMix: ExerciseMix;
  reviewBatchSize: number; // max cards per review session
  disabledExerciseTypes: ExerciseType[];
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
  autoTranslateEnabled: false,
  cefrLevel: "B1",
  dailyNewWordGoal: 10,
  exerciseMix: "balanced",
  reviewBatchSize: 20,
  disabledExerciseTypes: [],
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

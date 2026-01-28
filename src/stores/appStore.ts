import { create } from "zustand";
import type { AppSettings, TranslationEntry, TranslationResult, UserStats } from "../types";
import { DEFAULT_SETTINGS, DEFAULT_STATS, getTodayString } from "../types";

interface AppState {
  // Settings
  settings: AppSettings;
  setSettings: (settings: Partial<AppSettings>) => void;
  loadSettings: (settings: AppSettings) => void;

  // Translation
  isTranslating: boolean;
  currentTranslation: TranslationResult | null;
  originalText: string;
  error: string | null;
  isPinned: boolean;
  setTranslating: (v: boolean) => void;
  setTranslation: (original: string, result: TranslationResult) => void;
  setError: (error: string | null) => void;
  setPinned: (v: boolean) => void;
  clearTranslation: () => void;

  // History
  history: TranslationEntry[];
  setHistory: (entries: TranslationEntry[]) => void;
  addHistoryEntry: (entry: TranslationEntry) => void;
  removeHistoryEntry: (id: string) => void;
  clearHistory: () => void;
  toggleFavorite: (id: string) => void;

  // Stats
  stats: UserStats;
  setStats: (stats: UserStats) => void;
  loadStats: (stats: UserStats) => void;
  incrementTranslation: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Settings
  settings: DEFAULT_SETTINGS,
  setSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),
  loadSettings: (settings) => set({ settings }),

  // Translation
  isTranslating: false,
  currentTranslation: null,
  originalText: "",
  error: null,
  isPinned: false,
  setTranslating: (isTranslating) => set({ isTranslating, error: null }),
  setTranslation: (originalText, result) =>
    set({ currentTranslation: result, originalText, isTranslating: false }),
  setError: (error) => set({ error, isTranslating: false }),
  setPinned: (isPinned) => set({ isPinned }),
  clearTranslation: () =>
    set({ currentTranslation: null, originalText: "", error: null, isPinned: false }),

  // History
  history: [],
  setHistory: (history) => set({ history }),
  addHistoryEntry: (entry) =>
    set((state) => ({ history: [entry, ...state.history] })),
  removeHistoryEntry: (id) =>
    set((state) => ({ history: state.history.filter((e) => e.id !== id) })),
  clearHistory: () => set({ history: [] }),
  toggleFavorite: (id) =>
    set((state) => ({
      history: state.history.map((e) =>
        e.id === id ? { ...e, isFavorite: !e.isFavorite } : e
      ),
    })),

  // Stats
  stats: DEFAULT_STATS,
  setStats: (stats) => set({ stats }),
  loadStats: (stats) => set({ stats }),
  incrementTranslation: () => {
    const today = getTodayString();
    set((state) => {
      const { stats } = state;
      const isNewDay = stats.lastActiveDate !== today;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      const isConsecutiveDay = stats.lastActiveDate === yesterdayStr;

      let newStreak = stats.currentStreak;
      if (isNewDay) {
        if (isConsecutiveDay) {
          newStreak = stats.currentStreak + 1;
        } else if (stats.lastActiveDate !== today) {
          // Reset streak if more than 1 day gap
          newStreak = stats.lastActiveDate ? 1 : 1;
        }
      }

      return {
        stats: {
          ...stats,
          totalTranslations: stats.totalTranslations + 1,
          todayTranslations: isNewDay ? 1 : stats.todayTranslations + 1,
          currentStreak: newStreak,
          longestStreak: Math.max(stats.longestStreak, newStreak),
          lastActiveDate: today,
        },
      };
    });
  },
}));

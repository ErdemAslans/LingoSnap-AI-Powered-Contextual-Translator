import { create } from "zustand";
import type { AppSettings, TranslationEntry, TranslationResult, UserStats } from "../types";
import { DEFAULT_SETTINGS, DEFAULT_STATS, getTodayString } from "../types";
import type { GeneratedExercise, WordCard } from "../types/srs";

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

  // SRS — Word/phrase cards
  cards: WordCard[];
  setCards: (cards: WordCard[]) => void;
  upsertCardLocal: (card: WordCard) => void;
  removeCardLocal: (id: string) => void;

  // SRS — Active review session
  reviewQueue: string[]; // card ids
  reviewIndex: number;
  currentExercise: GeneratedExercise | null;
  reviewActive: boolean;
  reviewStartedAt: number;
  startReviewSession: (cardIds: string[]) => void;
  setCurrentExercise: (e: GeneratedExercise | null) => void;
  advanceReview: () => void;
  endReviewSession: () => void;
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
        // First-ever translation or consecutive day → extend streak.
        // Otherwise (gap of 2+ days) → restart streak at 1.
        newStreak = !stats.lastActiveDate || isConsecutiveDay
          ? stats.currentStreak + 1
          : 1;
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

  // SRS Cards
  cards: [],
  setCards: (cards) => set({ cards }),
  upsertCardLocal: (card) =>
    set((state) => {
      const idx = state.cards.findIndex((c) => c.id === card.id);
      if (idx >= 0) {
        const next = state.cards.slice();
        next[idx] = card;
        return { cards: next };
      }
      return { cards: [card, ...state.cards] };
    }),
  removeCardLocal: (id) =>
    set((state) => ({ cards: state.cards.filter((c) => c.id !== id) })),

  // Review session
  reviewQueue: [],
  reviewIndex: 0,
  currentExercise: null,
  reviewActive: false,
  reviewStartedAt: 0,
  startReviewSession: (cardIds) =>
    set({
      reviewQueue: cardIds,
      reviewIndex: 0,
      currentExercise: null,
      reviewActive: cardIds.length > 0,
      reviewStartedAt: Date.now(),
    }),
  setCurrentExercise: (e) => set({ currentExercise: e }),
  advanceReview: () =>
    set((state) => ({
      reviewIndex: state.reviewIndex + 1,
      currentExercise: null,
    })),
  endReviewSession: () =>
    set({
      reviewQueue: [],
      reviewIndex: 0,
      currentExercise: null,
      reviewActive: false,
    }),
}));

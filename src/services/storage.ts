import { Store } from "@tauri-apps/plugin-store";
import type { AppSettings, TranslationEntry, UserStats } from "../types";
import { DEFAULT_SETTINGS, DEFAULT_STATS } from "../types";

let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load("settings.json");
  }
  return store;
}

export async function loadSettings(): Promise<AppSettings> {
  const s = await getStore();
  const saved = await s.get<AppSettings>("settings");
  return saved ? { ...DEFAULT_SETTINGS, ...saved } : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const s = await getStore();
  await s.set("settings", settings);
  await s.save();
}

export async function loadHistory(): Promise<TranslationEntry[]> {
  const s = await getStore();
  return (await s.get<TranslationEntry[]>("history")) ?? [];
}

export async function saveHistory(history: TranslationEntry[]): Promise<void> {
  const s = await getStore();
  await s.set("history", history);
  await s.save();
}

export async function loadStats(): Promise<UserStats> {
  const s = await getStore();
  const saved = await s.get<UserStats>("stats");
  return saved ? { ...DEFAULT_STATS, ...saved } : DEFAULT_STATS;
}

export async function saveStats(stats: UserStats): Promise<void> {
  const s = await getStore();
  await s.set("stats", stats);
  await s.save();
}

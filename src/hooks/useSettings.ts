import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../stores/appStore";
import { loadSettings, saveSettings, loadStats, saveStats } from "../services/storage";
import type { AppSettings, UserStats } from "../types";

export function useSettings() {
  const settings = useAppStore((s) => s.settings);
  const stats = useAppStore((s) => s.stats);
  const setSettings = useAppStore((s) => s.setSettings);
  const loadSettingsToStore = useAppStore((s) => s.loadSettings);
  const loadStatsToStore = useAppStore((s) => s.loadStats);

  useEffect(() => {
    // Load settings and stats on mount
    loadSettings().then((loaded) => {
      loadSettingsToStore(loaded);
      // Sync auto-translate on select with backend
      invoke("set_auto_translate_on_select", { enabled: loaded.autoTranslateOnSelect });
    });
    loadStats().then(loadStatsToStore);
  }, [loadSettingsToStore, loadStatsToStore]);

  const updateSettings = async (partial: Partial<AppSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(partial);
    await saveSettings(updated);

    // Sync auto-translate on select with backend if changed
    if (partial.autoTranslateOnSelect !== undefined) {
      await invoke("set_auto_translate_on_select", { enabled: partial.autoTranslateOnSelect });
    }
  };

  const updateStats = async (partial: Partial<UserStats>) => {
    const updated = { ...stats, ...partial };
    useAppStore.getState().setStats(updated);
    await saveStats(updated);
  };

  return { settings, stats, updateSettings, updateStats };
}

import { useEffect, useState } from "react";
import { useAppStore } from "../stores/appStore";
import { loadHistory, saveHistory } from "../services/storage";

export function useHistory() {
  const history = useAppStore((s) => s.history);
  const setHistory = useAppStore((s) => s.setHistory);
  const removeHistoryEntry = useAppStore((s) => s.removeHistoryEntry);
  const clearHistory = useAppStore((s) => s.clearHistory);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadHistory().then(setHistory);
  }, [setHistory]);

  const filtered = search
    ? history.filter(
        (e) =>
          e.originalText.toLowerCase().includes(search.toLowerCase()) ||
          e.result.translation.toLowerCase().includes(search.toLowerCase())
      )
    : history;

  const deleteEntry = async (id: string) => {
    removeHistoryEntry(id);
    const updated = history.filter((e) => e.id !== id);
    await saveHistory(updated);
  };

  const clearAll = async () => {
    clearHistory();
    await saveHistory([]);
  };

  const toggleEntryFavorite = async (id: string) => {
    toggleFavorite(id);
    // Save updated history after toggling
    const updated = useAppStore.getState().history;
    await saveHistory(updated);
  };

  return {
    history: filtered,
    allHistory: history,
    search,
    setSearch,
    deleteEntry,
    clearAll,
    toggleFavorite: toggleEntryFavorite,
  };
}

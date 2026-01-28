import { useCallback, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../stores/appStore";
import { translateText } from "../services/gemini";
import { generateId } from "../utils/helpers";
import { saveHistory, saveStats } from "../services/storage";

export function useTranslation() {
  const {
    isTranslating,
    currentTranslation,
    originalText,
    error,
    settings,
    setTranslating,
    setTranslation,
    setError,
    addHistoryEntry,
    incrementTranslation,
    history,
  } = useAppStore();

  const doTranslate = useCallback(async () => {
    setTranslating(true);
    await invoke("show_translation_popup");

    try {
      const text: string = await invoke("get_clipboard_text");
      console.log("[LingoSnap] Clipboard text length:", text?.length);

      if (!text || !text.trim()) {
        setError("No text found in clipboard.");
        return;
      }

      // Check if API key is set
      if (!settings.apiKey || settings.apiKey.trim() === "") {
        setError("API key is required. Please set your Groq API key in settings.");
        return;
      }

      const result = await translateText(text.trim(), settings.apiKey);
      setTranslation(text.trim(), result);

      // Add to history
      const entry = {
        id: generateId(),
        originalText: text.trim(),
        result,
        timestamp: Date.now(),
        isFavorite: false,
      };
      addHistoryEntry(entry);

      // Increment stats
      incrementTranslation();

      // Persist history (trim to limit)
      const limit = settings.historyLimit;
      const trimmed = [entry, ...history].slice(0, limit);
      await saveHistory(trimmed);

      // Persist stats
      const currentStats = useAppStore.getState().stats;
      await saveStats(currentStats);

    } catch (e) {
      console.error("[LingoSnap] Translation error:", e);
      setError(e instanceof Error ? e.message : "Translation failed");
    }
  }, [settings, setTranslating, setTranslation, setError, addHistoryEntry, incrementTranslation, history]);

  useEffect(() => {
    const unlisten = listen("translate-hotkey", () => {
      doTranslate();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [doTranslate]);

  return { isTranslating, currentTranslation, originalText, error, doTranslate };
}

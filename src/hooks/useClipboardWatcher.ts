import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../stores/appStore";
import { translateText } from "../services/gemini";
import { generateId } from "../utils/helpers";
import { saveHistory, saveStats } from "../services/storage";

export function useClipboardWatcher() {
  const settings = useAppStore((s) => s.settings);
  const {
    setTranslating,
    setTranslation,
    setError,
    addHistoryEntry,
    incrementTranslation,
    history,
    isTranslating,
  } = useAppStore();

  const lastClipboardText = useRef<string>("");
  const isWatching = useRef(false);

  useEffect(() => {
    if (!settings.autoTranslateClipboard || !settings.apiKey) {
      isWatching.current = false;
      return;
    }

    isWatching.current = true;
    let intervalId: ReturnType<typeof setInterval>;

    const checkClipboard = async () => {
      if (!isWatching.current || isTranslating) return;

      try {
        const text: string = await invoke("get_clipboard_text");

        // Skip if same as last text or empty
        if (!text || !text.trim() || text === lastClipboardText.current) {
          return;
        }

        // Skip if text is too short (less than 2 chars) or too long (more than 5000 chars)
        const trimmedText = text.trim();
        if (trimmedText.length < 2 || trimmedText.length > 5000) {
          lastClipboardText.current = text;
          return;
        }

        // Skip if text looks like code or numbers only
        if (/^[\d\s\.\,\-\+\*\/\=\(\)\[\]\{\}]+$/.test(trimmedText)) {
          lastClipboardText.current = text;
          return;
        }

        // Skip if it looks like a URL or file path
        if (/^(https?:\/\/|www\.|[A-Z]:\\|\/)/i.test(trimmedText)) {
          lastClipboardText.current = text;
          return;
        }

        lastClipboardText.current = text;

        // Translate
        setTranslating(true);
        await invoke("show_translation_popup");

        try {
          const result = await translateText(trimmedText, settings.apiKey);
          setTranslation(trimmedText, result);

          // Add to history
          const entry = {
            id: generateId(),
            originalText: trimmedText,
            result,
            timestamp: Date.now(),
            isFavorite: false,
          };
          addHistoryEntry(entry);
          incrementTranslation();

          // Persist
          const limit = settings.historyLimit;
          const trimmed = [entry, ...history].slice(0, limit);
          await saveHistory(trimmed);

          const currentStats = useAppStore.getState().stats;
          await saveStats(currentStats);
        } catch (e) {
          console.error("[ClipboardWatcher] Translation error:", e);
          setError(e instanceof Error ? e.message : "Translation failed");
        }
      } catch (e) {
        // Clipboard read error - ignore silently
      }
    };

    // Check clipboard every 1.5 seconds
    intervalId = setInterval(checkClipboard, 1500);

    return () => {
      isWatching.current = false;
      clearInterval(intervalId);
    };
  }, [
    settings.autoTranslateClipboard,
    settings.apiKey,
    settings.historyLimit,
    isTranslating,
    setTranslating,
    setTranslation,
    setError,
    addHistoryEntry,
    incrementTranslation,
    history,
  ]);
}

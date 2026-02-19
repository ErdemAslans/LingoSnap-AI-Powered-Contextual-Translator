import { useCallback, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../stores/appStore";
import { translateText, type TranslationContext } from "../services/gemini";
import { generateId } from "../utils/helpers";
import { saveHistory, saveStats } from "../services/storage";
import { saveToVault, getRecentTranslations } from "../services/vault";

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

  const lastTranslatedText = useRef<string>("");

  const buildContext = useCallback(async (): Promise<TranslationContext | undefined> => {
    if (!settings.vaultPath) return undefined;

    try {
      const recent = await getRecentTranslations(settings.vaultPath, 5);
      if (recent.length === 0) return undefined;

      return {
        recentTranslations: recent.map((e) => ({
          original: e.original,
          translation: e.translation,
          topic: e.topic,
        })),
        currentTopic: recent[0]?.topic,
      };
    } catch {
      return undefined;
    }
  }, [settings.vaultPath]);

  const doTranslate = useCallback(async () => {
    await invoke("set_translating_state", { translating: true });
    setTranslating(true);
    await invoke("show_translation_popup");

    try {
      const text: string = await invoke("get_clipboard_text");

      if (!text || !text.trim()) {
        setError("No text found in clipboard.");
        return;
      }

      const trimmed = text.trim();

      if (trimmed === lastTranslatedText.current) {
        const existing = useAppStore.getState().history.find(
          (e) => e.originalText === trimmed
        );
        if (existing) {
          setTranslation(trimmed, existing.result);
          return;
        }
      }

      if (!settings.apiKey || settings.apiKey.trim() === "") {
        setError("API key is required. Please set your Groq API key in settings.");
        return;
      }

      // Build RAG context from vault
      const context = await buildContext();

      const result = await translateText(trimmed, settings.apiKey, context);
      setTranslation(trimmed, result);
      lastTranslatedText.current = trimmed;

      const entryId = generateId();
      const entry = {
        id: entryId,
        originalText: trimmed,
        result,
        timestamp: Date.now(),
        isFavorite: false,
      };
      addHistoryEntry(entry);
      incrementTranslation();

      const limit = settings.historyLimit;
      const trimmedHistory = [entry, ...history].slice(0, limit);
      await saveHistory(trimmedHistory);

      const currentStats = useAppStore.getState().stats;
      await saveStats(currentStats);

      // Save to vault (fire and forget)
      if (settings.vaultPath) {
        saveToVault(settings.vaultPath, entryId, trimmed, result).catch((e) =>
          console.error("[Vault] Save error:", e)
        );
      }
    } catch (e) {
      console.error("[LingoSnap] Translation error:", e);
      setError(e instanceof Error ? e.message : "Translation failed");
    } finally {
      await invoke("set_translating_state", { translating: false });
    }
  }, [settings, setTranslating, setTranslation, setError, addHistoryEntry, incrementTranslation, history, buildContext]);

  useEffect(() => {
    const unlisten = listen("translate-hotkey", () => {
      doTranslate();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [doTranslate]);

  useEffect(() => {
    const unlisten = listen("auto-select-translate", async () => {
      if (useAppStore.getState().isTranslating) {
        return;
      }
      await invoke("trigger_translate");
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return { isTranslating, currentTranslation, originalText, error, doTranslate };
}

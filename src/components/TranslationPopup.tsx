import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  Copy,
  Pin,
  PinOff,
  X,
  RefreshCw,
  Volume2,
  VolumeX,
  Star,
  Check,
  Loader2,
} from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { useTranslation } from "../hooks/useTranslation";
import { speakEnglish, speakTurkish, stop, playSuccessSound } from "../services/tts";
import { saveHistory } from "../services/storage";

export default function TranslationPopup() {
  const { isTranslating, currentTranslation, originalText, error, doTranslate } =
    useTranslation();
  const isPinned = useAppStore((s) => s.isPinned);
  const setPinned = useAppStore((s) => s.setPinned);
  const clearTranslation = useAppStore((s) => s.clearTranslation);
  const settings = useAppStore((s) => s.settings);
  const history = useAppStore((s) => s.history);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);

  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [speakingOriginal, setSpeakingOriginal] = useState(false);
  const [speakingTranslation, setSpeakingTranslation] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get current entry from history to check favorite status
  const currentEntry = history.find((e) => e.originalText === originalText);
  const isFavorite = currentEntry?.isFavorite ?? false;

  // Show popup when content is ready
  useEffect(() => {
    if (isTranslating || currentTranslation || error) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [isTranslating, currentTranslation, error]);

  // Success animation when translation completes
  useEffect(() => {
    if (currentTranslation && !isTranslating) {
      setShowSuccess(true);
      if (settings.enableSound) {
        playSuccessSound();
      }
      const timer = setTimeout(() => setShowSuccess(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [currentTranslation, isTranslating, settings.enableSound]);

  // Auto-dismiss
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isPinned && (currentTranslation || error)) {
      timerRef.current = setTimeout(() => {
        handleClose();
      }, settings.popupDuration * 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentTranslation, error, isPinned, settings.popupDuration]);

  const handleClose = async () => {
    stop(); // Stop any TTS
    clearTranslation();
    await invoke("hide_translation_popup");
  };

  const handleCopy = async () => {
    if (currentTranslation) {
      await writeText(currentTranslation.translation);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleSpeakOriginal = () => {
    if (speakingOriginal) {
      stop();
      setSpeakingOriginal(false);
    } else {
      stop();
      setSpeakingTranslation(false);
      speakEnglish(originalText);
      setSpeakingOriginal(true);
      // Auto-reset after estimated duration
      setTimeout(() => setSpeakingOriginal(false), Math.max(2000, originalText.length * 80));
    }
  };

  const handleSpeakTranslation = () => {
    if (speakingTranslation) {
      stop();
      setSpeakingTranslation(false);
    } else {
      stop();
      setSpeakingOriginal(false);
      speakTurkish(currentTranslation?.translation || "");
      setSpeakingTranslation(true);
      setTimeout(
        () => setSpeakingTranslation(false),
        Math.max(2000, (currentTranslation?.translation?.length || 0) * 80)
      );
    }
  };

  const handleToggleFavorite = async () => {
    if (currentEntry) {
      toggleFavorite(currentEntry.id);
      // Persist the change
      const updated = useAppStore.getState().history;
      await saveHistory(updated);
    }
  };

  // User-friendly error messages in Turkish
  const getErrorMessage = (err: string): { title: string; subtitle: string } => {
    if (err.includes("API key")) {
      return {
        title: "API Anahtarı Gerekli",
        subtitle: "Ayarlardan Groq API anahtarınızı girin",
      };
    }
    if (err.includes("No text") || err.includes("clipboard")) {
      return {
        title: "Metin Bulunamadı",
        subtitle: "Önce bir metin seçip kopyalayın",
      };
    }
    if (err.includes("network") || err.includes("fetch") || err.includes("Failed")) {
      return {
        title: "Bağlantı Hatası",
        subtitle: "İnternet bağlantınızı kontrol edin",
      };
    }
    if (err.includes("rate") || err.includes("limit")) {
      return {
        title: "Çok Hızlı",
        subtitle: "Biraz bekleyip tekrar deneyin",
      };
    }
    return {
      title: "Bir Hata Oluştu",
      subtitle: err.length > 50 ? err.slice(0, 50) + "..." : err,
    };
  };

  if (!visible) return null;

  return (
    <div className="flex min-h-full items-center justify-center p-3">
      <div className="w-full max-w-md">
        {/* Main Popup Container */}
        <div
          className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br from-zinc-900 to-black shadow-2xl transition-all duration-300 ${
            showSuccess
              ? "border-green-500/50 shadow-green-500/20"
              : error
              ? "border-red-500/30 shadow-red-500/10"
              : "border-zinc-700/50 shadow-black/50"
          }`}
        >
          {/* Success flash effect */}
          {showSuccess && (
            <div className="absolute inset-0 bg-green-500/10 animate-pulse pointer-events-none" />
          )}

          {/* Header - Draggable */}
          <div
            data-tauri-drag-region
            className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 cursor-move select-none"
          >
            <div className="flex items-center gap-2 pointer-events-none">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white">
                <span className="text-sm font-bold text-black">L</span>
              </div>
              <span className="text-sm font-medium text-zinc-300">LingoSnap</span>
              <span className="text-xs text-zinc-600 ml-1">• Sürükle</span>
            </div>
            <div className="flex items-center gap-1 pointer-events-auto">
              <button
                onClick={() => setPinned(!isPinned)}
                className={`rounded-lg p-2 transition-colors ${
                  isPinned
                    ? "bg-blue-500/20 text-blue-400"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                }`}
                title={isPinned ? "Sabitlemeyi Kaldır" : "Sabitle"}
              >
                {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
              </button>
              <button
                onClick={handleClose}
                className="rounded-lg p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Kapat"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="p-4">
            {/* Loading State */}
            {isTranslating && (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
                <p className="text-sm text-zinc-400">Çeviriliyor...</p>
              </div>
            )}

            {/* Error State */}
            {error && !isTranslating && (
              <div className="py-4">
                <div className="flex flex-col items-center text-center">
                  <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
                    <X className="h-6 w-6 text-red-500" />
                  </div>
                  <p className="text-base font-medium text-white mb-1">
                    {getErrorMessage(error).title}
                  </p>
                  <p className="text-sm text-zinc-500 mb-4">
                    {getErrorMessage(error).subtitle}
                  </p>
                  <button
                    onClick={doTranslate}
                    className="flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
                  >
                    <RefreshCw size={14} />
                    Tekrar Dene
                  </button>
                </div>
              </div>
            )}

            {/* Translation Result */}
            {currentTranslation && !isTranslating && (
              <div className="space-y-4">
                {/* Original Text */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                      İngilizce
                    </span>
                    {settings.enableTTS && (
                      <button
                        onClick={handleSpeakOriginal}
                        className={`rounded-lg p-1.5 transition-colors ${
                          speakingOriginal
                            ? "bg-blue-500/20 text-blue-400"
                            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                        }`}
                        title="Dinle"
                      >
                        {speakingOriginal ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed bg-zinc-800/50 rounded-lg px-3 py-2 whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {originalText}
                  </p>
                </div>

                {/* Arrow Divider */}
                <div className="flex justify-center">
                  <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center">
                    <svg
                      className="h-3 w-3 text-zinc-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                  </div>
                </div>

                {/* Translation */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                      Türkçe
                    </span>
                    {settings.enableTTS && (
                      <button
                        onClick={handleSpeakTranslation}
                        className={`rounded-lg p-1.5 transition-colors ${
                          speakingTranslation
                            ? "bg-blue-500/20 text-blue-400"
                            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                        }`}
                        title="Dinle"
                      >
                        {speakingTranslation ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      </button>
                    )}
                  </div>
                  <p className="text-base font-medium text-white leading-relaxed bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg px-3 py-3 border border-zinc-700/50 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {currentTranslation.translation}
                  </p>
                </div>

                {/* Context Note */}
                {currentTranslation.contextNote && (
                  <div className="rounded-lg bg-zinc-800/30 border border-zinc-700/30 px-3 py-2">
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {currentTranslation.contextNote}
                    </p>
                    {currentTranslation.topic && (
                      <span className="mt-1 inline-block px-2 py-0.5 rounded bg-zinc-700/50 text-xs text-zinc-300">
                        {currentTranslation.topic}
                      </span>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={handleToggleFavorite}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isFavorite
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                    }`}
                    title={isFavorite ? "Favorilerden Çıkar" : "Favorilere Ekle"}
                  >
                    <Star size={14} fill={isFavorite ? "currentColor" : "none"} />
                    <span className="text-xs">{isFavorite ? "Favorilerde" : "Favorile"}</span>
                  </button>

                  <button
                    onClick={handleCopy}
                    className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                      copied
                        ? "bg-green-500/20 text-green-400"
                        : "bg-white text-black hover:bg-zinc-200"
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check size={14} />
                        Kopyalandı!
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        Kopyala
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer - Progress indicator for auto-close */}
          {!isPinned && currentTranslation && !isTranslating && (
            <div className="h-1 bg-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all ease-linear"
                style={{
                  animation: `shrink ${settings.popupDuration}s linear forwards`,
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Inline styles for animation */}
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

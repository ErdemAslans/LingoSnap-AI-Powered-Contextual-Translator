import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Loader2 } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { useClipboardWatcher } from "../hooks/useClipboardWatcher";
import { useSettings } from "../hooks/useSettings";

export default function FloatingIndicator() {
  // Load settings and watch clipboard for auto-translate
  useSettings();
  useClipboardWatcher();

  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isTranslating = useAppStore((s) => s.isTranslating);
  const settings = useAppStore((s) => s.settings);

  // Make window draggable
  useEffect(() => {
    const handleMouseDown = async (e: MouseEvent) => {
      if (e.button === 0) {
        // Left click
        setIsDragging(true);
        try {
          await getCurrentWindow().startDragging();
        } catch (err) {
          console.error("Drag error:", err);
        }
        setIsDragging(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  const handleClick = async () => {
    if (!isDragging) {
      // Trigger translation
      await invoke("trigger_translate");
    }
  };

  const handleRightClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    // Show settings window
    await invoke("show_window", { label: "main" });
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center">
      <button
        onClick={handleClick}
        onContextMenu={handleRightClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          relative flex h-12 w-12 items-center justify-center rounded-full
          bg-gradient-to-br from-zinc-800 to-zinc-900
          border-2 transition-all duration-200 cursor-pointer
          shadow-lg shadow-black/50
          ${isHovered ? "border-white scale-110" : "border-zinc-600"}
          ${isTranslating ? "border-blue-500 animate-pulse" : ""}
          ${settings.autoTranslateClipboard ? "ring-2 ring-cyan-500/30" : ""}
        `}
        title="Tıkla: Çevir | Sağ tık: Ayarlar"
      >
        {isTranslating ? (
          <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
        ) : (
          <span className="text-lg font-bold text-white select-none">L</span>
        )}

        {/* Auto-translate indicator dot */}
        {settings.autoTranslateClipboard && !isTranslating && (
          <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-cyan-500 border-2 border-zinc-900" />
        )}

        {/* Hover tooltip */}
        {isHovered && !isTranslating && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 text-white text-xs rounded whitespace-nowrap border border-zinc-700">
            {settings.autoTranslateClipboard ? "Otomatik açık" : "Ctrl+Shift+C"}
          </div>
        )}

        {/* Active indicator ring */}
        <div
          className={`
            absolute inset-0 rounded-full border-2
            ${isTranslating ? "border-blue-500 animate-ping" : "border-transparent"}
          `}
        />
      </button>
    </div>
  );
}

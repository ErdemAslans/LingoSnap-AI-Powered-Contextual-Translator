import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import TranslationPopup from "./components/TranslationPopup";
import SettingsWindow from "./components/SettingsWindow";
import HistoryWindow from "./components/HistoryWindow";
import FloatingIndicator from "./components/FloatingIndicator";
import { useSettings } from "./hooks/useSettings";

type WindowType = "popup" | "main" | "history" | "indicator";

function useTheme() {
  const { settings } = useSettings();

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "dark") {
      root.classList.add("dark");
    } else if (settings.theme === "light") {
      root.classList.remove("dark");
    } else {
      // System
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const update = () => {
        if (mq.matches) root.classList.add("dark");
        else root.classList.remove("dark");
      };
      update();
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
  }, [settings.theme]);
}

export default function App() {
  const [windowType, setWindowType] = useState<WindowType>("main");
  useTheme();

  useEffect(() => {
    const label = getCurrentWindow().label as WindowType;
    setWindowType(label);
  }, []);

  switch (windowType) {
    case "popup":
      return <TranslationPopup />;
    case "history":
      return <HistoryWindow />;
    case "indicator":
      return <FloatingIndicator />;
    default:
      return <SettingsWindow />;
  }
}

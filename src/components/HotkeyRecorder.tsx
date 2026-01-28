import { useState } from "react";
import { Keyboard } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function HotkeyRecorder({ value, onChange }: Props) {
  const [recording, setRecording] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();

    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push("CmdOrCtrl");
    if (e.shiftKey) parts.push("Shift");
    if (e.altKey) parts.push("Alt");

    const key = e.key;
    if (!["Control", "Shift", "Alt", "Meta"].includes(key)) {
      parts.push(key.length === 1 ? key.toUpperCase() : key);
      onChange(parts.join("+"));
      setRecording(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Hotkey
      </label>
      <div
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
          recording
            ? "border-primary ring-2 ring-primary/20"
            : "border-gray-300 dark:border-gray-600"
        } bg-white dark:bg-gray-800 dark:text-white`}
      >
        <Keyboard size={16} className="text-gray-400" />
        {recording ? (
          <span className="text-primary animate-pulse">Press your hotkey…</span>
        ) : (
          <span>{value}</span>
        )}
      </div>
    </div>
  );
}

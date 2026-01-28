import { useState, useEffect } from "react";
import { testApiKey } from "../services/gemini";
import { Key, Check, AlertCircle, ExternalLink } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function ApiKeyInput({ value, onChange }: Props) {
  const [status, setStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (value.length > 10) {
      setStatus("testing");
      testApiKey(value).then((result) => {
        if (result === "ok") {
          setStatus("ok");
          setErrorMsg("");
        } else {
          setStatus("error");
          setErrorMsg(result);
        }
      });
    } else {
      setStatus("idle");
    }
  }, [value]);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-300">
        Groq API Key
      </label>

      {/* API Key Input */}
      <div className="relative">
        <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="gsk_xxxxxxxxxxxxxxxxxxxx"
          className="w-full rounded-xl border border-slate-600 bg-slate-900/50 py-3 pl-10 pr-10 text-sm text-white placeholder:text-slate-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
        {status === "ok" && (
          <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" size={18} />
        )}
        {status === "error" && (
          <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" size={18} />
        )}
      </div>

      {/* Status Messages */}
      {status === "testing" && value.length > 10 && (
        <p className="text-xs text-slate-500">Testing API key...</p>
      )}
      {status === "ok" && (
        <p className="text-xs text-green-500">✓ API key valid!</p>
      )}
      {status === "error" && errorMsg && (
        <p className="text-xs text-red-500">{errorMsg}</p>
      )}

      {/* Get API Key Link */}
      {status !== "ok" && (
        <a
          href="https://console.groq.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors"
        >
          Get free API key here <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}

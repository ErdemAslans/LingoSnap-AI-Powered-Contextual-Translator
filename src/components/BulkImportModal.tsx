// BulkImportModal — paste a long text (paragraph, exam passage, word list)
// → AI extracts study-worthy items → user toggles which ones to keep
// → each accepted item runs through lookupWord and is added as a WordCard.

import { useState } from "react";
import {
  Loader2,
  Plus,
  X,
  Check,
  AlertCircle,
  ListPlus,
  ArrowRight,
} from "lucide-react";
import { extractVocabularyFromText, lookupWord } from "../services/tutor";
import { useAppStore } from "../stores/appStore";
import { useSRS } from "../hooks/useSRS";
import type { LexicalKind } from "../types/srs";

interface Props {
  onClose: () => void;
}

interface Candidate {
  text: string;
  kind: LexicalKind;
  rationale: string;
  selected: boolean;
  status: "idle" | "adding" | "added" | "skipped" | "error";
  errorMsg?: string;
}

type Phase = "input" | "extracting" | "review" | "adding" | "done" | "error";

export default function BulkImportModal({ onClose }: Props) {
  const settings = useAppStore((s) => s.settings);
  const cards = useAppStore((s) => s.cards);
  const { addCardFromLookup } = useSRS();

  const [phase, setPhase] = useState<Phase>("input");
  const [rawText, setRawText] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const handleExtract = async () => {
    if (!settings.apiKey) {
      setError("Önce Ayarlar'dan API anahtarını gir.");
      setPhase("error");
      return;
    }
    if (rawText.trim().length < 5) {
      setError("Daha uzun bir metin yapıştır.");
      setPhase("error");
      return;
    }
    setPhase("extracting");
    setError(null);
    try {
      const items = await extractVocabularyFromText(
        settings.apiKey,
        rawText,
        settings.cefrLevel,
        30
      );
      // Skip items already in deck.
      const existing = new Set(
        cards.flatMap((c) => [c.text.toLowerCase(), (c.lemma ?? "").toLowerCase()])
      );
      const fresh: Candidate[] = items
        .filter((i) => !existing.has(i.text.toLowerCase()))
        .map((i) => ({
          text: i.text,
          kind: i.kind,
          rationale: i.rationale,
          selected: true,
          status: "idle",
        }));
      if (fresh.length === 0) {
        setError("Bu metinden yeni bir şey çıkmadı — ya hepsi deck'te ya da boş.");
        setPhase("error");
        return;
      }
      setCandidates(fresh);
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Çıkarma başarısız");
      setPhase("error");
    }
  };

  const handleAddSelected = async () => {
    const selected = candidates.filter((c) => c.selected);
    if (selected.length === 0) return;
    setPhase("adding");
    setProgress({ done: 0, total: selected.length });
    let done = 0;

    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      if (!cand.selected) continue;
      setCandidates((cs) =>
        cs.map((c, idx) => (idx === i ? { ...c, status: "adding" } : c))
      );
      try {
        const lookup = await lookupWord(
          settings.apiKey,
          cand.text,
          undefined,
          settings.cefrLevel
        );
        await addCardFromLookup(lookup, cand.text, undefined);
        setCandidates((cs) =>
          cs.map((c, idx) => (idx === i ? { ...c, status: "added" } : c))
        );
      } catch (e) {
        setCandidates((cs) =>
          cs.map((c, idx) =>
            idx === i
              ? { ...c, status: "error", errorMsg: e instanceof Error ? e.message : "?" }
              : c
          )
        );
      }
      done += 1;
      setProgress({ done, total: selected.length });
    }

    setPhase("done");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-zinc-700/50 bg-gradient-to-br from-zinc-900 to-black p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <ListPlus size={18} className="text-blue-400" />
            <h3 className="text-lg font-bold text-white">Toplu Kart Ekle</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:text-white hover:bg-zinc-800"
          >
            <X size={16} />
          </button>
        </div>

        {phase === "input" && (
          <div className="space-y-3 flex-1 min-h-0 flex flex-col">
            <p className="text-xs text-zinc-400">
              Bir paragraf, sınav metni veya kelime listesi yapıştır. AI çalışılmaya değer
              olanları seçer, sen onaylarsın, hepsi tek seferde eklenir.
            </p>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="örnek: 1997'de internet ticareti başladığında... (paragraf)
veya
indispensable
sustainable
exacerbate
... (her satırda bir kelime)"
              rows={10}
              className="flex-1 min-h-0 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-white focus:outline-none resize-none font-mono"
            />
            <button
              onClick={handleExtract}
              disabled={!rawText.trim()}
              className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                Kelimeleri Çıkar <ArrowRight size={14} />
              </span>
            </button>
          </div>
        )}

        {phase === "extracting" && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="ml-3 text-sm text-zinc-400">AI çalışılması gerekenleri seçiyor...</span>
          </div>
        )}

        {phase === "review" && (
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            <div className="text-xs text-zinc-400">
              {candidates.filter((c) => c.selected).length} / {candidates.length} kart eklenecek. İstemediklerini kaldır.
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
              {candidates.map((c, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                    c.selected
                      ? "border-zinc-600 bg-zinc-900/60"
                      : "border-zinc-800 bg-zinc-900/30 opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={c.selected}
                    onChange={(e) =>
                      setCandidates((cs) =>
                        cs.map((x, idx) =>
                          idx === i ? { ...x, selected: e.target.checked } : x
                        )
                      )
                    }
                    className="mt-0.5 accent-white"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-white">{c.text}</span>
                      <span className="text-[10px] uppercase text-zinc-500">{c.kind}</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">{c.rationale}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPhase("input")}
                className="flex-1 rounded-lg border border-zinc-800 px-4 py-2.5 text-sm text-zinc-400 hover:bg-zinc-900"
              >
                Geri
              </button>
              <button
                onClick={handleAddSelected}
                disabled={candidates.filter((c) => c.selected).length === 0}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
              >
                <Plus size={14} /> Seçilenleri Ekle
              </button>
            </div>
          </div>
        )}

        {(phase === "adding" || phase === "done") && (
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            <div className="text-sm text-zinc-300">
              {phase === "adding"
                ? `Ekleniyor: ${progress.done} / ${progress.total}`
                : `Bitti — ${candidates.filter((c) => c.status === "added").length} kart eklendi.`}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
              {candidates
                .filter((c) => c.selected)
                .map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-xs"
                  >
                    <span className="text-zinc-200">{c.text}</span>
                    <span>
                      {c.status === "added" && <Check size={14} className="text-green-400" />}
                      {c.status === "adding" && <Loader2 size={14} className="animate-spin text-blue-400" />}
                      {c.status === "error" && (
                        <span className="text-red-400" title={c.errorMsg}>
                          ✗
                        </span>
                      )}
                      {c.status === "idle" && <span className="text-zinc-600">—</span>}
                    </span>
                  </div>
                ))}
            </div>
            {phase === "done" && (
              <button
                onClick={onClose}
                className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200"
              >
                Kapat
              </button>
            )}
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-3 text-sm text-red-300">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => {
                setError(null);
                setPhase("input");
              }}
              className="w-full rounded-lg border border-zinc-800 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-900"
            >
              Tekrar dene
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

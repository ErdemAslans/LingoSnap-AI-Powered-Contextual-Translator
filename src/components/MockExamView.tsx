// MockExamView — timed YÖKDİL-style exam simulation.
//
// 1. Pick N cards from the deck (default 40; configurable up to 80).
// 2. For each, generate a yokdil_mcq exercise.
// 3. Show ONE question at a time with a single global timer (default 90s/question).
// 4. User can navigate; can mark for review; can skip.
// 5. At the end, show breakdown: total %, per-format accuracy, time per question,
//    list of wrong answers with explanations.
//
// We deliberately do NOT log these reviews into FSRS (it's "exam mode", not study).
// User can later choose "add wrongs to deck" → no-op for cards already in deck, but
// surfaces them in the Error Journal.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Flag,
  CheckCircle2,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { useSRS } from "../hooks/useSRS";
import { generateExercise } from "../services/exercises";
import type { GeneratedExercise, WordCard } from "../types/srs";

interface Props {
  onClose: () => void;
  questionCount?: number;
  secondsPerQuestion?: number;
}

type Phase = "config" | "loading" | "running" | "result" | "error";

interface ExamItem {
  card: WordCard;
  exercise?: GeneratedExercise;
  chosen?: string;
  marked: boolean;
  timeSpentMs?: number;
}

const LETTERS = ["A", "B", "C", "D", "E"];

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

export default function MockExamView({ onClose }: Props) {
  const settings = useAppStore((s) => s.settings);
  const { cards } = useSRS();

  const [phase, setPhase] = useState<Phase>("config");
  const [items, setItems] = useState<ExamItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [count, setCount] = useState(20);
  const [perQuestionSec, setPerQuestionSec] = useState(60);
  const totalSeconds = count * perQuestionSec;
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const itemStartedAt = useRef<number>(Date.now());

  // Timer
  useEffect(() => {
    if (phase !== "running") return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          finalize();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  const finalize = () => {
    // record time on current item if not already
    setItems((cur) => {
      const next = cur.slice();
      if (next[idx] && next[idx].timeSpentMs === undefined) {
        next[idx] = { ...next[idx], timeSpentMs: Date.now() - itemStartedAt.current };
      }
      return next;
    });
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("result");
  };

  const startExam = async () => {
    if (cards.length < count) {
      setError(`Deck'inde sadece ${cards.length} kart var; sınav için ${count} kart lazım.`);
      setPhase("error");
      return;
    }
    if (!settings.apiKey) {
      setError("Önce Ayarlar'dan API anahtarını gir.");
      setPhase("error");
      return;
    }
    setPhase("loading");
    setError(null);

    // Pick N random cards (without replacement).
    const shuffled = [...cards].sort(() => Math.random() - 0.5).slice(0, count);
    const initial: ExamItem[] = shuffled.map((c) => ({ card: c, marked: false }));
    setItems(initial);

    // Generate exercises sequentially. We could parallelize but Groq rate limits
    // are unkind to that — serial keeps things predictable.
    try {
      for (let i = 0; i < initial.length; i++) {
        const ex = await generateExercise(
          settings.apiKey,
          initial[i].card,
          "yokdil_mcq",
          settings.cefrLevel
        );
        setItems((cur) => {
          const next = cur.slice();
          next[i] = { ...next[i], exercise: ex };
          return next;
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Egzersizler üretilemedi");
      setPhase("error");
      return;
    }

    setIdx(0);
    setSecondsLeft(totalSeconds);
    itemStartedAt.current = Date.now();
    setPhase("running");
  };

  const goto = (newIdx: number) => {
    if (newIdx < 0 || newIdx >= items.length) return;
    setItems((cur) => {
      const next = cur.slice();
      if (next[idx]) {
        next[idx] = {
          ...next[idx],
          timeSpentMs: (next[idx].timeSpentMs ?? 0) + (Date.now() - itemStartedAt.current),
        };
      }
      return next;
    });
    itemStartedAt.current = Date.now();
    setIdx(newIdx);
  };

  const choose = (opt: string) => {
    setItems((cur) => {
      const next = cur.slice();
      next[idx] = { ...next[idx], chosen: opt };
      return next;
    });
  };

  const toggleMark = () => {
    setItems((cur) => {
      const next = cur.slice();
      next[idx] = { ...next[idx], marked: !next[idx].marked };
      return next;
    });
  };

  const stats = useMemo(() => {
    let correct = 0;
    let answered = 0;
    let marked = 0;
    let totalTime = 0;
    for (const it of items) {
      if (it.chosen) {
        answered += 1;
        if (
          it.chosen.trim().toLowerCase() === (it.exercise?.expectedAnswer ?? "").trim().toLowerCase()
        ) {
          correct += 1;
        }
      }
      if (it.marked) marked += 1;
      totalTime += it.timeSpentMs ?? 0;
    }
    return {
      correct,
      wrong: answered - correct,
      blank: items.length - answered,
      total: items.length,
      marked,
      // ÖSYM-style 4-yanlış-1-doğru götürür → net
      net: correct - (answered - correct) / 4,
      avgTimePerQuestion: items.length === 0 ? 0 : Math.round(totalTime / items.length / 1000),
    };
  }, [items]);

  // ---------- Render ----------

  if (phase === "config") {
    return (
      <Wrapper onClose={onClose} title="Sınav Modu">
        <div className="space-y-5">
          <p className="text-sm text-zinc-400 leading-relaxed">
            YÖKDİL/YDS benzeri zamanlı simülasyon. Sorular deck'indeki kartlardan üretilir
            (yokdil_mcq formatı). FSRS güncellemesi yapılmaz — yalnız sınav pratiği.
          </p>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Soru sayısı: {count}
            </label>
            <input
              type="range"
              min="5"
              max={Math.min(80, cards.length)}
              step="5"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value))}
              className="w-full accent-white"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Mevcut deck: {cards.length} kart. Maks {Math.min(80, cards.length)}.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Soru başına süre: {perQuestionSec} saniye
            </label>
            <input
              type="range"
              min="30"
              max="180"
              step="15"
              value={perQuestionSec}
              onChange={(e) => setPerQuestionSec(parseInt(e.target.value))}
              className="w-full accent-white"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Toplam: {Math.round(totalSeconds / 60)} dk {totalSeconds % 60 ? `${totalSeconds % 60}sn` : ""}.
            </p>
          </div>

          <button
            onClick={startExam}
            disabled={cards.length < 5}
            className="w-full rounded-xl bg-white px-6 py-4 text-base font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
          >
            {cards.length < 5 ? "En az 5 kart gerekli" : "Sınavı Başlat"}
          </button>
        </div>
      </Wrapper>
    );
  }

  if (phase === "loading") {
    const ready = items.filter((i) => i.exercise).length;
    return (
      <Wrapper onClose={onClose} title="Sorular hazırlanıyor">
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <span className="text-sm text-zinc-300">
            {ready} / {items.length} hazır
          </span>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${(ready / Math.max(1, items.length)) * 100}%` }}
            />
          </div>
        </div>
      </Wrapper>
    );
  }

  if (phase === "running") {
    const it = items[idx];
    const ex = it?.exercise;
    return (
      <Wrapper onClose={onClose} title={`Soru ${idx + 1} / ${items.length}`}>
        {/* Top bar: timer + mark + finish */}
        <div className="flex items-center justify-between mb-3 text-sm">
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Clock size={14} />
            <span className={secondsLeft < 60 ? "text-red-400 font-bold" : ""}>
              {pad2(Math.floor(secondsLeft / 60))}:{pad2(secondsLeft % 60)}
            </span>
          </div>
          <button
            onClick={toggleMark}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              it?.marked
                ? "bg-yellow-500/20 text-yellow-300"
                : "text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            <Flag size={12} />
            {it?.marked ? "İşaretli" : "İşaretle"}
          </button>
          <button
            onClick={finalize}
            className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
          >
            Sınavı Bitir
          </button>
        </div>

        {/* Question */}
        {ex ? (
          <div className="space-y-3">
            {ex.contextSentence && (
              <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[15px] text-zinc-100 leading-relaxed">
                {ex.contextSentence}
              </p>
            )}
            <div className="space-y-1.5">
              {(ex.options ?? []).map((opt, i) => {
                const selected = it.chosen === opt;
                return (
                  <button
                    key={i}
                    onClick={() => choose(opt)}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                      selected
                        ? "border-blue-500 bg-blue-500/10 text-white"
                        : "border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    <span className="font-bold text-zinc-400 mr-2">{LETTERS[i]})</span>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Bu soru hâlâ yükleniyor.</p>
        )}

        {/* Nav */}
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => goto(idx - 1)}
            disabled={idx === 0}
            className="flex items-center gap-1 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900 disabled:opacity-40"
          >
            <ChevronLeft size={14} /> Önceki
          </button>
          <span className="text-xs text-zinc-500">
            {items.filter((i) => i.chosen).length} / {items.length} işaretli
          </span>
          {idx < items.length - 1 ? (
            <button
              onClick={() => goto(idx + 1)}
              className="flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-zinc-200"
            >
              Sonraki <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={finalize}
              className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              Bitir <CheckCircle2 size={14} />
            </button>
          )}
        </div>

        {/* Question grid */}
        <div className="mt-4 grid grid-cols-10 gap-1">
          {items.map((it2, i) => (
            <button
              key={i}
              onClick={() => goto(i)}
              className={`aspect-square rounded text-[10px] font-bold ${
                i === idx
                  ? "ring-2 ring-white bg-zinc-700 text-white"
                  : it2.chosen
                  ? "bg-blue-500/30 text-blue-200"
                  : it2.marked
                  ? "bg-yellow-500/30 text-yellow-200"
                  : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </Wrapper>
    );
  }

  if (phase === "result") {
    return (
      <Wrapper onClose={onClose} title="Sınav Sonucu">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-green-500/40 bg-green-500/5 p-3">
              <div className="text-3xl font-bold text-green-400">{stats.correct}</div>
              <div className="text-xs text-zinc-400">Doğru</div>
            </div>
            <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-3">
              <div className="text-3xl font-bold text-red-400">{stats.wrong}</div>
              <div className="text-xs text-zinc-400">Yanlış</div>
            </div>
            <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-3">
              <div className="text-3xl font-bold text-zinc-300">{stats.blank}</div>
              <div className="text-xs text-zinc-400">Boş</div>
            </div>
            <div className="rounded-xl border border-blue-500/40 bg-blue-500/5 p-3">
              <div className="text-3xl font-bold text-blue-400">{stats.net.toFixed(2)}</div>
              <div className="text-xs text-zinc-400">Net (4Y=1D)</div>
            </div>
          </div>

          <div className="rounded-lg bg-zinc-900/40 border border-zinc-800 px-3 py-2 text-xs text-zinc-400">
            Soru başına ortalama: <span className="text-white">{stats.avgTimePerQuestion}s</span>
            {" · "}İşaretli: <span className="text-white">{stats.marked}</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Yanlış cevaplar</div>
            {items.map((it, i) => {
              const exp = (it.exercise?.expectedAnswer ?? "").trim();
              const ans = (it.chosen ?? "").trim();
              const isWrong = ans && ans.toLowerCase() !== exp.toLowerCase();
              const isBlank = !ans;
              if (!isWrong && !isBlank) return null;
              return (
                <div
                  key={i}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2"
                >
                  <div className="text-xs text-zinc-500">Soru {i + 1} · {it.card.text}</div>
                  {it.exercise?.contextSentence && (
                    <p className="mt-1 text-xs text-zinc-300 italic">
                      {it.exercise.contextSentence}
                    </p>
                  )}
                  <div className="mt-1 text-xs">
                    <span className="text-zinc-500">Senin: </span>
                    <span className={isBlank ? "text-zinc-500" : "text-red-300"}>
                      {isBlank ? "(boş)" : ans}
                    </span>
                    <span className="mx-2 text-zinc-700">·</span>
                    <span className="text-zinc-500">Doğru: </span>
                    <span className="text-green-300">{exp}</span>
                  </div>
                  {it.exercise?.yokdilKeyInsight && (
                    <p className="mt-1 text-xs text-zinc-400">{it.exercise.yokdilKeyInsight}</p>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={onClose}
            className="w-full rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-zinc-200"
          >
            Kapat
          </button>
        </div>
      </Wrapper>
    );
  }

  if (phase === "error") {
    return (
      <Wrapper onClose={onClose} title="Hata">
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-3 text-sm text-red-300">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setPhase("config")}
            className="w-full rounded-lg border border-zinc-800 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            Geri
          </button>
        </div>
      </Wrapper>
    );
  }

  return null;
}

function Wrapper({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-zinc-700/50 bg-gradient-to-br from-zinc-900 to-black p-5 shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:text-white hover:bg-zinc-800"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    </div>
  );
}

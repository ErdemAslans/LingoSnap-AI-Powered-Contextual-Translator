// ReviewTab — the third tab in SettingsWindow. Orchestrates the daily review session:
//   1. Show "X cards due" summary + Start button.
//   2. For each due card: generate exercise → render ReviewCard → on rate, advance.
//   3. When queue is exhausted, show summary.

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Sparkles, Flame, CheckCircle2, AlertTriangle, Loader2, RotateCw, Plus } from "lucide-react";
import { useSRS } from "../hooks/useSRS";
import { useAppStore } from "../stores/appStore";
import { saveCards } from "../services/storage";
import { applyRating } from "../services/fsrs";
import { upsertCard as vaultUpsert, appendDailyReview } from "../services/srs-vault";
import { evaluateAnswer } from "../services/tutor";
import ReviewCard from "./ReviewCard";
import AddCardModal from "./AddCardModal";
import type { GeneratedExercise, ReviewLogEntry, WordCard } from "../types/srs";

type SessionPhase = "idle" | "loading" | "active" | "summary" | "error";

interface SessionResult {
  reviewed: number;
  correct: number;
  partial: number;
  incorrect: number;
}

export default function ReviewTab() {
  const settings = useAppStore((s) => s.settings);
  const cards = useAppStore((s) => s.cards);
  const upsertCardLocal = useAppStore((s) => s.upsertCardLocal);

  const { getDueQueue, buildExerciseFor, stats } = useSRS();

  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [showAddCard, setShowAddCard] = useState(false);
  const [queue, setQueue] = useState<WordCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [currentCard, setCurrentCard] = useState<WordCard | null>(null);
  const [currentExercise, setCurrentExercise] = useState<GeneratedExercise | null>(null);
  const [pendingEvalFor, setPendingEvalFor] = useState<{
    card: WordCard;
    exercise: GeneratedExercise;
    userAnswer: string;
    timeSpentMs: number;
    suggestedRating?: 1 | 2 | 3 | 4;
    feedback?: string;
    modelAnswer?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SessionResult>({ reviewed: 0, correct: 0, partial: 0, incorrect: 0 });

  const srsStats = useMemo(() => stats(), [stats]);

  // Fetch next card's exercise.
  const loadNextExercise = async (cardList: WordCard[], index: number) => {
    if (index >= cardList.length) {
      setPhase("summary");
      return;
    }
    const card = cardList[index];
    setCurrentCard(card);
    setCurrentExercise(null);
    setPhase("loading");
    try {
      const ex = await buildExerciseFor(card);
      setCurrentExercise(ex);
      setPhase("active");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Egzersiz üretilemedi");
      setPhase("error");
    }
  };

  const startSession = async () => {
    if (!settings.apiKey) {
      setError("Önce Ayarlar sekmesinden API anahtarını gir.");
      setPhase("error");
      return;
    }
    const due = getDueQueue();
    if (due.length === 0) {
      setPhase("summary");
      setResult({ reviewed: 0, correct: 0, partial: 0, incorrect: 0 });
      return;
    }
    setQueue(due);
    setIdx(0);
    setResult({ reviewed: 0, correct: 0, partial: 0, incorrect: 0 });
    setError(null);
    await loadNextExercise(due, 0);
  };

  // Called by ReviewCard when user clicks "Check answer".
  // We do LLM eval here, return rating to UI for display.
  const onCheckAnswer = async (args: { userAnswer: string; timeSpentMs: number }) => {
    if (!currentCard || !currentExercise) throw new Error("No active card");

    const evalResult = await evaluateAnswer(settings.apiKey, {
      exerciseType: currentExercise.exerciseType,
      prompt: currentExercise.prompt,
      expectedAnswer: currentExercise.expectedAnswer,
      userAnswer: args.userAnswer,
      targetText: currentCard.text,
      targetMeaning: currentCard.meanings[0]?.translation,
      contextSentence: currentExercise.contextSentence,
      cefrLevel: settings.cefrLevel,
    });

    setPendingEvalFor({
      card: currentCard,
      exercise: currentExercise,
      userAnswer: args.userAnswer,
      timeSpentMs: args.timeSpentMs,
      suggestedRating: evalResult.rating,
      feedback: evalResult.feedback,
      modelAnswer: evalResult.modelAnswer,
    });

    return {
      rating: evalResult.rating,
      feedback: evalResult.feedback,
      modelAnswer: evalResult.modelAnswer,
    };
  };

  // Called by ReviewCard when user commits a final rating.
  const onRated = async (finalRating: 1 | 2 | 3 | 4) => {
    if (!pendingEvalFor) return;
    const p = pendingEvalFor;
    const stateBefore = { ...p.card.fsrs };
    const newFsrs = applyRating(p.card.fsrs, finalRating);

    const review: ReviewLogEntry = {
      timestamp: Date.now(),
      rating: finalRating,
      exerciseType: p.exercise.exerciseType,
      prompt: p.exercise.prompt,
      expectedAnswer: p.exercise.expectedAnswer,
      userAnswer: p.userAnswer,
      // If the user overrode toward "Again/Hard", treat eval differently.
      evaluation:
        finalRating >= 3
          ? "correct"
          : finalRating === 2
          ? "partial"
          : "incorrect",
      feedback: p.feedback,
      timeSpentMs: p.timeSpentMs,
      stateBefore,
    };

    const updated: WordCard = {
      ...p.card,
      fsrs: newFsrs,
      reviews: [...p.card.reviews, review],
      recentExerciseTypes: [...p.card.recentExerciseTypes.slice(-4), p.exercise.exerciseType],
      updatedAt: Date.now(),
    };

    upsertCardLocal(updated);
    const next = cards.map((c) => (c.id === updated.id ? updated : c));
    await saveCards(next);
    if (settings.vaultPath) {
      await vaultUpsert(settings.vaultPath, updated, next);
      await appendDailyReview(settings.vaultPath, updated, updated.reviews.length - 1);
    }

    setResult((r) => ({
      reviewed: r.reviewed + 1,
      correct: r.correct + (finalRating >= 3 ? 1 : 0),
      partial: r.partial + (finalRating === 2 ? 1 : 0),
      incorrect: r.incorrect + (finalRating === 1 ? 1 : 0),
    }));

    setPendingEvalFor(null);

    const nextIdx = idx + 1;
    setIdx(nextIdx);
    await loadNextExercise(queue, nextIdx);
  };

  // Restart silently when the user comes back to tab after a previous session.
  useEffect(() => {
    if (phase === "summary" && result.reviewed > 0) {
      // keep summary visible until user clicks "Yeni oturum"
    }
  }, [phase, result.reviewed]);

  // ---------- Render ----------

  if (phase === "idle" || phase === "summary") {
    const due = srsStats.dueToday;
    return (
      <div className="max-w-lg">
        <div className="mb-6 flex items-center gap-2">
          <BookOpen size={20} className="text-blue-400" />
          <h2 className="text-xl font-semibold">Tekrar</h2>
        </div>

        {phase === "summary" && result.reviewed > 0 && (
          <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={18} className="text-green-400" />
              <span className="font-medium text-white">Oturum tamamlandı</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div>
                <div className="text-lg font-bold text-green-400">{result.correct}</div>
                <div className="text-zinc-500">İyi/Kolay</div>
              </div>
              <div>
                <div className="text-lg font-bold text-orange-400">{result.partial}</div>
                <div className="text-zinc-500">Zor</div>
              </div>
              <div>
                <div className="text-lg font-bold text-red-400">{result.incorrect}</div>
                <div className="text-zinc-500">Tekrar</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="text-2xl font-bold text-white">{srsStats.dueToday}</div>
            <div className="text-xs text-zinc-500">Bugün vadesinde</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="text-2xl font-bold text-white">{srsStats.totalCards}</div>
            <div className="text-xs text-zinc-500">Toplam kart</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="text-2xl font-bold text-white">{srsStats.masteredCount}</div>
            <div className="text-xs text-zinc-500">Mastered (≥30g stabilite)</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="text-2xl font-bold text-white">
              {Math.round(srsStats.retentionRate * 100)}%
            </div>
            <div className="text-xs text-zinc-500">30g retention</div>
          </div>
        </div>

        {/* 7-day forecast */}
        <div className="mb-6">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
            Önümüzdeki 7 gün
          </p>
          <div className="flex items-end gap-1.5 h-20">
            {srsStats.dueNext7Days.map((n, i) => {
              const max = Math.max(...srsStats.dueNext7Days, 1);
              const pct = (n / max) * 100;
              const day = new Date();
              day.setDate(day.getDate() + i);
              return (
                <div key={i} className="flex flex-col items-center flex-1">
                  <div
                    className="w-full rounded-t bg-blue-500/40"
                    style={{ height: `${pct}%`, minHeight: n > 0 ? "4px" : "0" }}
                    title={`${n} kart`}
                  />
                  <span className="text-[10px] text-zinc-500 mt-1">
                    {i === 0 ? "bugün" : day.getDate()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {srsStats.topLapses.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <AlertTriangle size={12} /> En zorlandıkların
            </p>
            <div className="space-y-1">
              {srsStats.topLapses.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between rounded-lg bg-zinc-900/50 px-3 py-2 text-sm"
                >
                  <span className="text-zinc-300">{l.text}</span>
                  <span className="text-xs text-zinc-500">{l.lapses}× lapse</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={startSession}
          disabled={due === 0 && srsStats.totalCards === 0}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 text-base font-semibold text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {srsStats.totalCards === 0 ? (
            <>
              <Plus size={18} /> Aşağıdan kelime ekleyerek başla
            </>
          ) : due > 0 ? (
            <>
              <Sparkles size={18} /> {due} Kartı Tekrarla
            </>
          ) : (
            <>
              <Flame size={18} /> Bugün boşsun — erken çalış
            </>
          )}
        </button>

        <button
          onClick={() => setShowAddCard(true)}
          className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/50 px-6 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-900 hover:border-zinc-600 transition-colors"
        >
          <Plus size={16} /> Yeni Kart Ekle (manuel)
        </button>

        {phase === "summary" && result.reviewed > 0 && (
          <button
            onClick={() => setPhase("idle")}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-zinc-800 px-6 py-3 text-sm text-zinc-400 hover:bg-zinc-900"
          >
            <RotateCw size={14} /> Yeni oturum
          </button>
        )}

        {showAddCard && <AddCardModal onClose={() => setShowAddCard(false)} />}
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Egzersiz hazırlanıyor...</span>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="max-w-lg space-y-3">
        <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
        <button
          onClick={() => {
            setError(null);
            setPhase("idle");
          }}
          className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
        >
          Geri dön
        </button>
      </div>
    );
  }

  // phase === "active"
  if (!currentCard || !currentExercise) return null;

  return (
    <div className="max-w-lg">
      <div className="mb-3 flex items-center justify-between text-xs text-zinc-500">
        <span>
          Kart {idx + 1} / {queue.length}
        </span>
        <span>
          ✓ {result.correct} · ~ {result.partial} · ✗ {result.incorrect}
        </span>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
        <ReviewCard
          key={currentCard.id + idx}
          card={currentCard}
          exercise={currentExercise}
          onSubmit={onCheckAnswer}
          onRated={onRated}
        />
      </div>
    </div>
  );
}

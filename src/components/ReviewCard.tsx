// ReviewCard — renders a single SRS review step.
//
// Phases:
//   1. "answering"  — user reads the exercise, types answer, clicks Submit (or skips).
//   2. "evaluating" — LLM evaluates; spinner.
//   3. "feedback"   — shows evaluation + model answer + 4 rating buttons (Again/Hard/Good/Easy).
//                     User can OVERRIDE the LLM's suggested rating.
//   4. "done"       — onComplete fires; parent advances to next card.

import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, Loader2, Check, X, ChevronRight, Star, AlertCircle } from "lucide-react";
import { previewIntervals } from "../services/fsrs";
import { speakEnglish } from "../services/tts";
import type { GeneratedExercise, WordCard } from "../types/srs";

type Phase = "answering" | "evaluating" | "feedback" | "done";

interface Props {
  card: WordCard;
  exercise: GeneratedExercise;
  onSubmit: (args: {
    userAnswer: string;
    timeSpentMs: number;
  }) => Promise<{ rating: 1 | 2 | 3 | 4; feedback: string; modelAnswer?: string }>;
  onRated: (finalRating: 1 | 2 | 3 | 4) => void;
}

const RATING_LABELS = {
  1: { label: "Tekrar", color: "bg-red-500/20 text-red-400 hover:bg-red-500/30" },
  2: { label: "Zor", color: "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30" },
  3: { label: "İyi", color: "bg-green-500/20 text-green-400 hover:bg-green-500/30" },
  4: { label: "Kolay", color: "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30" },
} as const;

function formatInterval(days: number): string {
  if (days < 1) return "<1g";
  if (days < 30) return `${days}g`;
  if (days < 365) return `${Math.round(days / 30)}ay`;
  return `${(days / 365).toFixed(1)}y`;
}

export default function ReviewCard({ card, exercise, onSubmit, onRated }: Props) {
  const [phase, setPhase] = useState<Phase>("answering");
  const [userAnswer, setUserAnswer] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [suggestedRating, setSuggestedRating] = useState<1 | 2 | 3 | 4 | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [modelAnswer, setModelAnswer] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef<number>(Date.now());
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  const intervals = useMemo(() => previewIntervals(card.fsrs), [card.fsrs]);

  // Auto-play TTS for listen_and_type
  useEffect(() => {
    if (exercise.exerciseType === "listen_and_type" && exercise.ttsText) {
      const t = setTimeout(() => speakEnglish(exercise.ttsText!), 300);
      return () => clearTimeout(t);
    }
  }, [exercise]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (phase !== "answering") return;
    setPhase("evaluating");
    setError(null);
    try {
      const result = await onSubmit({
        userAnswer,
        timeSpentMs: Date.now() - startedAt.current,
      });
      setSuggestedRating(result.rating);
      setFeedback(result.feedback);
      setModelAnswer(result.modelAnswer);
      setPhase("feedback");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Değerlendirme başarısız");
      setPhase("answering");
    }
  };

  const handleRate = (rating: 1 | 2 | 3 | 4) => {
    setPhase("done");
    onRated(rating);
  };

  const handleSkip = async () => {
    if (phase !== "answering") return;
    setUserAnswer("");
    await handleSubmit();
  };

  // ---------- Render per exercise type ----------

  const renderExerciseBody = () => {
    const e = exercise;
    switch (e.exerciseType) {
      case "polysemy_choice":
        return (
          <div className="space-y-2">
            {e.contextSentence && (
              <p className="rounded-lg bg-zinc-800/50 px-3 py-2 text-sm text-zinc-300 italic">
                "{e.contextSentence}"
              </p>
            )}
            <div className="space-y-1.5">
              {(e.options ?? []).map((opt, i) => {
                const selected = userAnswer === opt;
                return (
                  <button
                    key={i}
                    onClick={() => setUserAnswer(opt)}
                    disabled={phase !== "answering"}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                      selected
                        ? "border-blue-500 bg-blue-500/10 text-white"
                        : "border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    <span className="text-zinc-500 mr-2">{i + 1}.</span>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case "cloze_sentence":
      case "context_inference":
        return (
          <div className="space-y-2">
            {e.contextSentence && (
              <p className="rounded-lg bg-zinc-800/50 px-3 py-2 text-base text-white leading-relaxed">
                {e.contextSentence}
              </p>
            )}
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={userAnswer}
              onChange={(ev) => setUserAnswer(ev.target.value)}
              onKeyDown={(ev) => ev.key === "Enter" && handleSubmit()}
              placeholder={
                e.exerciseType === "cloze_sentence" ? "Boşluğa gelen kelimeyi yaz" : "Anlamı Türkçe yaz"
              }
              disabled={phase !== "answering"}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-base text-white placeholder:text-zinc-600 focus:border-white focus:outline-none disabled:opacity-50"
            />
          </div>
        );

      case "use_in_sentence":
        return (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={userAnswer}
            onChange={(ev) => setUserAnswer(ev.target.value)}
            placeholder={`Use "${card.text}" in your own English sentence...`}
            disabled={phase !== "answering"}
            rows={3}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-base text-white placeholder:text-zinc-600 focus:border-white focus:outline-none disabled:opacity-50 resize-none"
          />
        );

      case "listen_and_type":
        return (
          <div className="space-y-3">
            <button
              onClick={() => exercise.ttsText && speakEnglish(exercise.ttsText)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 py-6 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              <Volume2 size={20} />
              Tekrar dinle
            </button>
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={userAnswer}
              onChange={(ev) => setUserAnswer(ev.target.value)}
              placeholder="Duyduğun cümleyi yaz..."
              disabled={phase !== "answering"}
              rows={2}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-base text-white placeholder:text-zinc-600 focus:border-white focus:outline-none disabled:opacity-50 resize-none"
            />
          </div>
        );

      default:
        // recall_en_to_tr, production_tr_to_en, synonym_or_antonym → single-line text input
        return (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={userAnswer}
            onChange={(ev) => setUserAnswer(ev.target.value)}
            onKeyDown={(ev) => ev.key === "Enter" && handleSubmit()}
            placeholder="Cevabını yaz"
            disabled={phase !== "answering"}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-base text-white placeholder:text-zinc-600 focus:border-white focus:outline-none disabled:opacity-50"
          />
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header: target word + meta */}
      <div className="flex items-start justify-between border-b border-zinc-800 pb-3">
        <div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-white">{card.text}</h3>
            {card.ipa && <span className="text-sm text-zinc-500">{card.ipa}</span>}
            <button
              onClick={() => speakEnglish(card.text)}
              className="ml-1 rounded p-1 text-zinc-500 hover:text-zinc-300"
              title="Telaffuz"
            >
              <Volume2 size={14} />
            </button>
          </div>
          {card.partOfSpeech && (
            <span className="text-xs uppercase tracking-wide text-zinc-500">{card.partOfSpeech}</span>
          )}
        </div>
        <div className="text-right text-xs text-zinc-500">
          <div>{exercise.exerciseType}</div>
          <div>seviye {exercise.cefrTargetLevel} · rep {card.fsrs.reps}</div>
        </div>
      </div>

      {/* Prompt */}
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-300">{exercise.prompt}</p>
      </div>

      {/* Exercise body */}
      {renderExerciseBody()}

      {/* Hint */}
      {exercise.hint && (
        <div>
          {!showHint ? (
            <button
              onClick={() => setShowHint(true)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              İpucu göster
            </button>
          ) : (
            <p className="rounded-lg bg-blue-500/5 border border-blue-500/20 px-3 py-2 text-xs text-blue-300">
              💡 {exercise.hint}
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Action row — phase dependent */}
      {phase === "answering" && (
        <div className="flex gap-2">
          <button
            onClick={handleSkip}
            className="flex-1 rounded-lg border border-zinc-800 px-4 py-3 text-sm text-zinc-400 hover:bg-zinc-900"
          >
            Bilmiyorum
          </button>
          <button
            onClick={handleSubmit}
            disabled={!userAnswer.trim()}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Kontrol Et <ChevronRight size={16} />
          </button>
        </div>
      )}

      {phase === "evaluating" && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <span className="ml-2 text-sm text-zinc-400">Değerlendiriliyor...</span>
        </div>
      )}

      {phase === "feedback" && (
        <div className="space-y-3">
          {/* Feedback */}
          <div
            className={`rounded-lg border px-3 py-3 ${
              suggestedRating && suggestedRating >= 3
                ? "border-green-500/30 bg-green-500/5"
                : "border-orange-500/30 bg-orange-500/5"
            }`}
          >
            <div className="flex items-start gap-2">
              {suggestedRating && suggestedRating >= 3 ? (
                <Check size={16} className="mt-0.5 shrink-0 text-green-400" />
              ) : (
                <X size={16} className="mt-0.5 shrink-0 text-orange-400" />
              )}
              <p className="text-sm text-zinc-200">{feedback}</p>
            </div>
            {modelAnswer && modelAnswer !== userAnswer && (
              <div className="mt-2 ml-6 text-xs text-zinc-400">
                <span className="text-zinc-500">Beklenen: </span>
                <span className="text-white">{modelAnswer}</span>
              </div>
            )}
          </div>

          {/* Rating row */}
          <div className="space-y-1">
            <p className="text-xs text-zinc-500">
              Kendini değerlendir (AI önerisi vurgulu)
            </p>
            <div className="grid grid-cols-4 gap-2">
              {([1, 2, 3, 4] as const).map((r) => {
                const isSuggested = r === suggestedRating;
                const conf = RATING_LABELS[r];
                const interval = intervals[r];
                return (
                  <button
                    key={r}
                    onClick={() => handleRate(r)}
                    className={`flex flex-col items-center gap-1 rounded-lg px-2 py-3 transition-all ${
                      conf.color
                    } ${isSuggested ? "ring-2 ring-current ring-offset-2 ring-offset-black" : ""}`}
                  >
                    <span className="text-sm font-semibold">{conf.label}</span>
                    <span className="text-[10px] opacity-70">
                      {formatInterval(interval.intervalDays)}
                    </span>
                    {isSuggested && <Star size={10} className="opacity-70" fill="currentColor" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

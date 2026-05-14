// ReadingPassageView — renders a reading_passage_mcq exercise.
// User reads the passage and answers 3 chained MCQs; a single "correct count"
// is reported back to the parent ReviewCard which decides the FSRS rating.

import { useState } from "react";
import { Check, X, ChevronRight, BookOpen } from "lucide-react";
import type { GeneratedExercise, PassageQuestion } from "../types/srs";

interface Props {
  exercise: GeneratedExercise;
  disabled?: boolean;
  // Called once the learner submits all three answers. The parent uses
  // correctCount to map → rating (e.g., 3/3 = Good, 2/3 = Hard, ≤1 = Again).
  onComplete: (args: {
    correctCount: number;
    total: number;
    chosen: string[];
    expected: string[];
  }) => void;
}

const LETTERS = ["A", "B", "C", "D", "E"];

export default function ReadingPassageView({ exercise, disabled, onComplete }: Props) {
  const questions: PassageQuestion[] = exercise.passageQuestions ?? [];
  const [chosen, setChosen] = useState<string[]>(Array(questions.length).fill(""));
  const [submitted, setSubmitted] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  const allAnswered = chosen.every((c) => c !== "");

  const handleSubmit = () => {
    if (!allAnswered) return;
    const correctCount = chosen.reduce(
      (n, c, i) =>
        c.trim().toLowerCase() === (questions[i]?.expectedAnswer ?? "").trim().toLowerCase()
          ? n + 1
          : n,
      0
    );
    setSubmitted(true);
    onComplete({
      correctCount,
      total: questions.length,
      chosen,
      expected: questions.map((q) => q.expectedAnswer),
    });
  };

  if (questions.length === 0 || !exercise.passage) {
    return (
      <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300">
        Bu pasaj egzersizi geçersiz veri ile geldi.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Passage */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-wider text-zinc-500">
          <BookOpen size={12} /> Parça
        </div>
        <p className="text-[15px] text-zinc-100 leading-relaxed whitespace-pre-wrap">
          {exercise.passage}
        </p>
        {exercise.passageTranslation && (
          <div className="mt-2">
            <button
              onClick={() => setShowTranslation((v) => !v)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {showTranslation ? "Türkçeyi gizle" : "Türkçesini göster"}
            </button>
            {showTranslation && (
              <p className="mt-2 text-sm text-zinc-300 italic leading-relaxed">
                {exercise.passageTranslation}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Questions */}
      {questions.map((q, qIdx) => {
        const expected = q.expectedAnswer;
        return (
          <div key={qIdx} className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-zinc-400">Soru {qIdx + 1}</span>
              <p className="text-sm text-zinc-200">{q.prompt}</p>
            </div>
            <div className="space-y-1.5">
              {q.options.map((opt, i) => {
                const selected = chosen[qIdx] === opt;
                const isCorrect = submitted && opt === expected;
                const isWrong = submitted && selected && opt !== expected;
                return (
                  <button
                    key={i}
                    onClick={() =>
                      !submitted &&
                      setChosen((c) => {
                        const next = c.slice();
                        next[qIdx] = opt;
                        return next;
                      })
                    }
                    disabled={submitted || disabled}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                      isCorrect
                        ? "border-green-500 bg-green-500/10 text-white"
                        : isWrong
                        ? "border-red-500/60 bg-red-500/10 text-white"
                        : selected
                        ? "border-blue-500 bg-blue-500/10 text-white"
                        : "border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    <span className="font-bold text-zinc-400 mr-2">{LETTERS[i]})</span>
                    {opt}
                    {isCorrect && <Check size={12} className="inline ml-2 text-green-400" />}
                    {isWrong && <X size={12} className="inline ml-2 text-red-400" />}
                  </button>
                );
              })}
            </div>
            {submitted && (
              <p className="text-xs text-zinc-400 italic px-1">
                {q.whyCorrect}
              </p>
            )}
          </div>
        );
      })}

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || disabled}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cevapları Gönder <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

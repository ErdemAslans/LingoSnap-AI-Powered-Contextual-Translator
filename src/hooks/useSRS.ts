// useSRS — orchestrates SRS lifecycle: add card, build due queue, generate exercise,
// evaluate answer, apply FSRS rating, persist everything.

import { useCallback, useEffect } from "react";
import { useAppStore } from "../stores/appStore";
import { loadCards, saveCards } from "../services/storage";
import { newCardState, applyRating, isDue, daysUntilDue } from "../services/fsrs";
import { generateExercise, pickExerciseType } from "../services/exercises";
import { evaluateAnswer, lookupWord } from "../services/tutor";
import {
  appendDailyReview,
  loadWordsIndex,
  upsertCard as vaultUpsert,
  deleteCard as vaultDelete,
} from "../services/srs-vault";
import { generateId } from "../utils/helpers";
import type {
  ExerciseType,
  GeneratedExercise,
  ReviewLogEntry,
  SrsStats,
  WordCard,
  WordLookup,
} from "../types/srs";

export function useSRS() {
  const cards = useAppStore((s) => s.cards);
  const setCards = useAppStore((s) => s.setCards);
  const upsertCardLocal = useAppStore((s) => s.upsertCardLocal);
  const removeCardLocal = useAppStore((s) => s.removeCardLocal);
  const settings = useAppStore((s) => s.settings);

  // Bootstrap once.
  useEffect(() => {
    (async () => {
      const fromStore = await loadCards();
      if (fromStore.length > 0) {
        setCards(fromStore);
        return;
      }
      // Migration path: if Tauri store is empty but vault has data, hydrate from vault.
      if (settings.vaultPath) {
        const fromVault = await loadWordsIndex(settings.vaultPath);
        if (fromVault.length > 0) {
          setCards(fromVault);
          await saveCards(fromVault);
        }
      }
    })();
  }, [setCards, settings.vaultPath]);

  // ---------- Card creation ----------

  const addCardFromLookup = useCallback(
    async (lookup: WordLookup, contextSentence: string, translationEntryId?: string): Promise<WordCard> => {
      const existing = cards.find(
        (c) => c.lemma?.toLowerCase() === lookup.lemma.toLowerCase()
      );
      if (existing) return existing;

      const now = Date.now();
      const card: WordCard = {
        id: generateId(),
        text: lookup.text,
        kind: lookup.kind,
        lemma: lookup.lemma,
        partOfSpeech: lookup.partOfSpeech,
        ipa: lookup.ipa,
        meanings: lookup.meanings,
        firstSeenContext: {
          sentence: contextSentence,
          timestamp: now,
          sourceTranslationEntryId: translationEntryId,
        },
        fsrs: newCardState(new Date(now)),
        reviews: [],
        tags: [],
        commonMistakes: [],
        knownSynonyms: lookup.synonyms,
        knownAntonyms: lookup.antonyms,
        recentExerciseTypes: [],
        createdAt: now,
        updatedAt: now,
      };

      upsertCardLocal(card);
      const next = [card, ...cards.filter((c) => c.id !== card.id)];
      await saveCards(next);
      if (settings.vaultPath) {
        await vaultUpsert(settings.vaultPath, card, next);
      }
      return card;
    },
    [cards, upsertCardLocal, settings.vaultPath]
  );

  const lookupAndAdd = useCallback(
    async (text: string, contextSentence: string, translationEntryId?: string): Promise<WordCard> => {
      const lookup = await lookupWord(settings.apiKey, text, contextSentence, settings.cefrLevel);
      return addCardFromLookup(lookup, contextSentence, translationEntryId);
    },
    [settings.apiKey, settings.cefrLevel, addCardFromLookup]
  );

  const removeCard = useCallback(
    async (id: string) => {
      removeCardLocal(id);
      const next = cards.filter((c) => c.id !== id);
      await saveCards(next);
      if (settings.vaultPath) {
        await vaultDelete(settings.vaultPath, id, next);
      }
    },
    [cards, removeCardLocal, settings.vaultPath]
  );

  // ---------- Review queue ----------

  const getDueQueue = useCallback((): WordCard[] => {
    const now = new Date();
    return cards
      .filter((c) => isDue(c.fsrs, now))
      .sort((a, b) => new Date(a.fsrs.due).getTime() - new Date(b.fsrs.due).getTime())
      .slice(0, settings.reviewBatchSize);
  }, [cards, settings.reviewBatchSize]);

  // ---------- Exercise per card ----------

  const buildExerciseFor = useCallback(
    async (card: WordCard): Promise<GeneratedExercise> => {
      const type: ExerciseType = pickExerciseType(
        card,
        settings.exerciseMix,
        settings.disabledExerciseTypes,
        settings.enableTTS
      );
      return generateExercise(settings.apiKey, card, type, settings.cefrLevel);
    },
    [settings.apiKey, settings.cefrLevel, settings.exerciseMix, settings.disabledExerciseTypes, settings.enableTTS]
  );

  // ---------- Submit answer (review one card) ----------

  const submitAnswer = useCallback(
    async (args: {
      card: WordCard;
      exercise: GeneratedExercise;
      userAnswer: string;
      timeSpentMs: number;
    }): Promise<{ updatedCard: WordCard; reviewIndex: number; feedback: string; modelAnswer?: string }> => {
      const { card, exercise, userAnswer, timeSpentMs } = args;

      // Evaluate via LLM (semantic match).
      const evalResult = await evaluateAnswer(settings.apiKey, {
        exerciseType: exercise.exerciseType,
        prompt: exercise.prompt,
        expectedAnswer: exercise.expectedAnswer,
        userAnswer,
        targetText: card.text,
        targetMeaning: card.meanings[0]?.translation,
        contextSentence: exercise.contextSentence,
        cefrLevel: settings.cefrLevel,
      });

      const stateBefore = { ...card.fsrs };
      const newFsrs = applyRating(card.fsrs, evalResult.rating);

      const review: ReviewLogEntry = {
        timestamp: Date.now(),
        rating: evalResult.rating,
        exerciseType: exercise.exerciseType,
        prompt: exercise.prompt,
        expectedAnswer: exercise.expectedAnswer,
        userAnswer,
        evaluation: evalResult.evaluation,
        feedback: evalResult.feedback,
        timeSpentMs,
        stateBefore,
      };

      const updated: WordCard = {
        ...card,
        fsrs: newFsrs,
        reviews: [...card.reviews, review],
        recentExerciseTypes: [...card.recentExerciseTypes.slice(-4), exercise.exerciseType],
        updatedAt: Date.now(),
      };

      upsertCardLocal(updated);
      const nextAll = cards.map((c) => (c.id === updated.id ? updated : c));
      await saveCards(nextAll);
      if (settings.vaultPath) {
        await vaultUpsert(settings.vaultPath, updated, nextAll);
        await appendDailyReview(settings.vaultPath, updated, updated.reviews.length - 1);
      }

      return {
        updatedCard: updated,
        reviewIndex: updated.reviews.length - 1,
        feedback: evalResult.feedback,
        modelAnswer: evalResult.modelAnswer,
      };
    },
    [settings.apiKey, settings.cefrLevel, settings.vaultPath, cards, upsertCardLocal]
  );

  // ---------- Stats ----------

  const stats = useCallback((): SrsStats => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const byState = { 0: 0, 1: 0, 2: 0, 3: 0 };
    let dueToday = 0;
    const dueNext7 = [0, 0, 0, 0, 0, 0, 0];
    let mastered = 0;
    let correctReviews = 0;
    let totalRecentReviews = 0;
    const reviewsLast7 = [0, 0, 0, 0, 0, 0, 0];
    const thirtyDaysAgo = now.getTime() - 30 * 86_400_000;
    const lapseTop: Array<{ id: string; text: string; lapses: number }> = [];

    for (const c of cards) {
      byState[c.fsrs.state] += 1;
      if (c.fsrs.stability >= 30) mastered += 1;
      if (isDue(c.fsrs, now)) dueToday += 1;
      const days = daysUntilDue(c.fsrs, now);
      if (days >= 0 && days < 7) dueNext7[days] += 1;
      if (c.fsrs.lapses > 0) {
        lapseTop.push({ id: c.id, text: c.text, lapses: c.fsrs.lapses });
      }
      for (const r of c.reviews) {
        if (r.timestamp >= thirtyDaysAgo) {
          totalRecentReviews += 1;
          if (r.evaluation === "correct") correctReviews += 1;
        }
        const daysAgo = Math.floor((today.getTime() - r.timestamp) / 86_400_000);
        if (daysAgo >= 0 && daysAgo < 7) {
          reviewsLast7[6 - daysAgo] += 1;
        }
      }
    }

    lapseTop.sort((a, b) => b.lapses - a.lapses);

    return {
      totalCards: cards.length,
      newCards: byState[0],
      learningCards: byState[1],
      reviewCards: byState[2],
      relearningCards: byState[3],
      dueToday,
      dueNext7Days: dueNext7,
      masteredCount: mastered,
      retentionRate: totalRecentReviews === 0 ? 0 : correctReviews / totalRecentReviews,
      reviewsLast7Days: reviewsLast7,
      topLapses: lapseTop.slice(0, 5),
    };
  }, [cards]);

  // Convenience: count of cards that became eligible today as "new".
  const newAddedToday = useCallback((): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return cards.filter((c) => c.createdAt >= today.getTime()).length;
  }, [cards]);

  return {
    cards,
    lookupAndAdd,
    addCardFromLookup,
    removeCard,
    getDueQueue,
    buildExerciseFor,
    submitAnswer,
    stats,
    newAddedToday,
  };
}

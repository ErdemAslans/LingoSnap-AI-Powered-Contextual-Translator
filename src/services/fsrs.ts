// FSRS-5 scheduler wrapper around ts-fsrs.
// Maps Anki-style ratings (Again/Hard/Good/Easy) -> next due date + updated card state.

import { createEmptyCard, fsrs, generatorParameters, Rating, type Card } from "ts-fsrs";
import type { FsrsState } from "../types/srs";

// Single shared scheduler; default params are FSRS-5 defaults.
const params = generatorParameters({ enable_fuzz: true });
const scheduler = fsrs(params);

function toFsrsCard(state: FsrsState): Card {
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsed_days,
    scheduled_days: state.scheduled_days,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    last_review: state.last_review ? new Date(state.last_review) : undefined,
  } as Card;
}

function fromFsrsCard(card: Card): FsrsState {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as 0 | 1 | 2 | 3,
    last_review: card.last_review?.toISOString(),
  };
}

export function newCardState(now: Date = new Date()): FsrsState {
  const card = createEmptyCard(now);
  return fromFsrsCard(card);
}

const RATING_MAP = {
  1: Rating.Again,
  2: Rating.Hard,
  3: Rating.Good,
  4: Rating.Easy,
} as const;

export function applyRating(
  state: FsrsState,
  rating: 1 | 2 | 3 | 4,
  now: Date = new Date()
): FsrsState {
  const card = toFsrsCard(state);
  const result = scheduler.next(card, now, RATING_MAP[rating]);
  return fromFsrsCard(result.card);
}

// Preview all four rating outcomes — used in the review UI to show
// "Again 1d / Hard 3d / Good 7d / Easy 14d" labels.
export function previewIntervals(
  state: FsrsState,
  now: Date = new Date()
): Record<1 | 2 | 3 | 4, { due: string; intervalDays: number }> {
  const card = toFsrsCard(state);
  const previews = scheduler.repeat(card, now);
  const pick = (r: 1 | 2 | 3 | 4) => {
    const item = previews[RATING_MAP[r]];
    const due = item.card.due;
    const intervalDays = Math.max(
      0,
      Math.round((due.getTime() - now.getTime()) / 86_400_000)
    );
    return { due: due.toISOString(), intervalDays };
  };
  return { 1: pick(1), 2: pick(2), 3: pick(3), 4: pick(4) };
}

export function isDue(state: FsrsState, now: Date = new Date()): boolean {
  return new Date(state.due).getTime() <= now.getTime();
}

export function daysUntilDue(state: FsrsState, now: Date = new Date()): number {
  return Math.ceil((new Date(state.due).getTime() - now.getTime()) / 86_400_000);
}

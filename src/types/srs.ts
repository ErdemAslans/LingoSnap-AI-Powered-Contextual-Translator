// SRS (Spaced Repetition System) types for vocabulary/phrase learning.
// FSRS-5 algorithm via ts-fsrs.

export type LexicalKind = "word" | "phrase";

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export const CEFR_LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export type ExerciseType =
  | "recall_en_to_tr" // see EN word, write/choose TR meaning
  | "production_tr_to_en" // see TR meaning, produce EN word
  | "cloze_sentence" // sentence with blank, fill the target
  | "polysemy_choice" // choose which meaning fits in the given sentence
  | "use_in_sentence" // write a new EN sentence using the word
  | "listen_and_type" // TTS audio, type what was heard
  | "synonym_or_antonym" // produce a synonym or antonym
  | "context_inference"; // infer meaning from a never-seen sentence

export const EXERCISE_TYPES: ExerciseType[] = [
  "recall_en_to_tr",
  "production_tr_to_en",
  "cloze_sentence",
  "polysemy_choice",
  "use_in_sentence",
  "listen_and_type",
  "synonym_or_antonym",
  "context_inference",
];

export interface WordMeaning {
  sense: string; // English gloss (e.g., "to operate a vehicle")
  translation: string; // Turkish (e.g., "sürmek")
  example?: string; // EN example sentence demonstrating this sense
}

// FSRS card state — mirrors ts-fsrs Card shape; persisted as plain JSON.
export interface FsrsState {
  due: string; // ISO timestamp
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: 0 | 1 | 2 | 3; // 0=New, 1=Learning, 2=Review, 3=Relearning
  last_review?: string; // ISO timestamp
}

export interface ReviewLogEntry {
  timestamp: number; // ms epoch
  rating: 1 | 2 | 3 | 4; // 1=Again, 2=Hard, 3=Good, 4=Easy
  exerciseType: ExerciseType;
  prompt: string; // the exercise question shown to the user
  expectedAnswer?: string;
  userAnswer: string;
  evaluation: "correct" | "partial" | "incorrect";
  feedback?: string;
  timeSpentMs: number;
  // FSRS state at time of review (pre-rating)
  stateBefore: FsrsState;
}

export interface WordCard {
  id: string;
  // Core lexical data
  text: string; // canonical form as shown (lowercased, trimmed)
  kind: LexicalKind; // "word" | "phrase"
  lemma?: string; // base form (run/ran/running -> run); same as text for phrases
  partOfSpeech?: string; // e.g., "noun", "verb", "idiom"
  ipa?: string; // /rʌn/
  meanings: WordMeaning[]; // can have multiple (polysemy)

  // Context of first encounter
  firstSeenContext: {
    sentence: string;
    timestamp: number;
    sourceTranslationEntryId?: string;
  };

  // SRS scheduling
  fsrs: FsrsState;

  // Learning history
  reviews: ReviewLogEntry[];

  // Pedagogy metadata
  tags: string[];
  commonMistakes: string[]; // recurring user error patterns (free-text)
  knownSynonyms: string[];
  knownAntonyms: string[];
  // What exercise types this card has already been seen with, for interleaving.
  recentExerciseTypes: ExerciseType[];

  createdAt: number;
  updatedAt: number;
}

// What the AI generates for a single review session of one card.
export interface GeneratedExercise {
  exerciseType: ExerciseType;
  prompt: string; // the question/instruction shown to user
  // Optional fields depending on type:
  contextSentence?: string; // for cloze, context_inference
  blank?: string; // the masked token in cloze
  options?: string[]; // for polysemy_choice / synonym MC
  expectedAnswer?: string; // free-text expected (may be flexible)
  hint?: string; // hint laddered (used after first wrong attempt)
  ttsText?: string; // text to speak for listen_and_type
  cefrTargetLevel: CefrLevel;
}

export interface EvaluationResult {
  evaluation: "correct" | "partial" | "incorrect";
  rating: 1 | 2 | 3 | 4; // suggested FSRS rating
  feedback: string; // short pedagogical feedback (no sycophancy)
  modelAnswer?: string; // shown only after rating is committed
}

// Lookup card returned when user clicks a word in the popup.
export interface WordLookup {
  text: string;
  kind: LexicalKind;
  lemma: string;
  partOfSpeech?: string;
  ipa?: string;
  meanings: WordMeaning[];
  synonyms: string[];
  antonyms: string[];
  inContextMeaningIndex?: number; // which of the meanings best fits the given sentence
}

// Aggregate SRS stats for dashboard.
export interface SrsStats {
  totalCards: number;
  newCards: number; // state 0
  learningCards: number; // state 1
  reviewCards: number; // state 2
  relearningCards: number; // state 3
  dueToday: number;
  dueNext7Days: number[]; // 7 numbers, one per day
  masteredCount: number; // stability > 30 days proxy
  retentionRate: number; // 0-1, correct / total reviews last 30 days
  reviewsLast7Days: number[];
  topLapses: Array<{ id: string; text: string; lapses: number }>;
}

// Tutor-layer Groq calls: word lookup and answer evaluation.
// Exercise generation lives in services/exercises.ts.

import { chatJson } from "./groq";
import type {
  CefrLevel,
  EvaluationResult,
  ExerciseType,
  LexicalKind,
  WordLookup,
} from "../types/srs";

// ---------- Word lookup ----------

const LOOKUP_SYSTEM = `You are an English-Turkish lexicographer with deep pedagogical expertise.
You produce JSON dictionary entries for English words and multi-word phrases (idioms, collocations, phrasal verbs).
Be precise, distinguish polysemy explicitly, and pick the most-frequent senses first.
Never produce sycophancy ("great", "excellent"). Output ONLY valid JSON.`;

interface LookupResponse {
  text: string;
  kind: LexicalKind;
  lemma: string;
  partOfSpeech?: string;
  ipa?: string;
  meanings: Array<{
    sense: string;
    translation: string;
    example?: string;
  }>;
  synonyms?: string[];
  antonyms?: string[];
  inContextMeaningIndex?: number;
}

export async function lookupWord(
  apiKey: string,
  text: string,
  contextSentence: string | undefined,
  cefrLevel: CefrLevel
): Promise<WordLookup> {
  const isPhrase = text.trim().split(/\s+/).length > 1;

  const userPrompt = `Lemmatize, classify, and define the following English ${
    isPhrase ? "phrase/idiom/collocation" : "word"
  } for a Turkish learner at CEFR ${cefrLevel}.

Target: "${text}"
${contextSentence ? `Context (where the learner saw it):\n"""${contextSentence}"""\n` : ""}

Return JSON with this exact shape:
{
  "text": "${text}",
  "kind": "${isPhrase ? "phrase" : "word"}",
  "lemma": "base/dictionary form (singular noun, infinitive verb without 'to', phrase canonical form)",
  "partOfSpeech": "noun | verb | adjective | adverb | idiom | phrasal verb | collocation | ...",
  "ipa": "IPA pronunciation, e.g. /rʌn/",
  "meanings": [
    {
      "sense": "concise English gloss",
      "translation": "Turkish translation",
      "example": "short EN example sentence demonstrating THIS sense"
    }
  ],
  "synonyms": ["..."],
  "antonyms": ["..."],
  "inContextMeaningIndex": 0
}

Rules:
- Order meanings by frequency: most common first.
- Include 2-5 meanings if polysemous; 1 if monosemous.
- "inContextMeaningIndex" is the 0-based index of the meaning that best fits the context sentence (0 if no context).
- Synonyms/antonyms: 2-5 each, omit array entirely if none.
- All examples MUST contain the lemma in a natural form.
- No markdown, no extra fields, JSON only.`;

  const parsed = await chatJson<LookupResponse>(apiKey, LOOKUP_SYSTEM, userPrompt, {
    temperature: 0.2,
    maxTokens: 1200,
  });

  return {
    text: parsed.text,
    kind: parsed.kind,
    lemma: parsed.lemma,
    partOfSpeech: parsed.partOfSpeech,
    ipa: parsed.ipa,
    meanings: (parsed.meanings ?? []).map((m) => ({
      sense: m.sense,
      translation: m.translation,
      example: m.example,
    })),
    synonyms: parsed.synonyms ?? [],
    antonyms: parsed.antonyms ?? [],
    inContextMeaningIndex: parsed.inContextMeaningIndex,
  };
}

// ---------- Answer evaluation ----------

const EVAL_SYSTEM = `You are a strict but fair language tutor evaluating a learner's answer.
Use the "warm demander" style: never sycophantic ("great!", "excellent!"), but never dismissive.
Address recurring mistakes precisely. Use prompts (hints) over recasts when wrong.
Output ONLY valid JSON.`;

interface EvalResponse {
  evaluation: "correct" | "partial" | "incorrect";
  rating: 1 | 2 | 3 | 4;
  feedback: string;
  modelAnswer?: string;
}

export async function evaluateAnswer(
  apiKey: string,
  args: {
    exerciseType: ExerciseType;
    prompt: string;
    expectedAnswer?: string;
    userAnswer: string;
    targetText: string;
    targetMeaning?: string;
    contextSentence?: string;
    cefrLevel: CefrLevel;
  }
): Promise<EvaluationResult> {
  const userPrompt = `Evaluate the learner's answer for this vocabulary review.

Target: "${args.targetText}"${args.targetMeaning ? ` (meaning: ${args.targetMeaning})` : ""}
Exercise type: ${args.exerciseType}
Prompt shown to learner:
"""${args.prompt}"""
${args.expectedAnswer ? `Expected answer: "${args.expectedAnswer}"` : "Expected: flexible (any semantically equivalent answer)"}
${args.contextSentence ? `Context sentence: "${args.contextSentence}"` : ""}
Learner CEFR level: ${args.cefrLevel}

Learner's answer:
"""${args.userAnswer || "(blank)"}"""

Return JSON:
{
  "evaluation": "correct" | "partial" | "incorrect",
  "rating": 1 | 2 | 3 | 4,
  "feedback": "1-2 sentence pedagogical feedback. NO sycophancy. Be specific.",
  "modelAnswer": "the ideal answer (shown to learner after rating)"
}

Rating semantics (Anki-style):
- 1 (Again): wrong or blank — schedule soon.
- 2 (Hard): partially right or required visible struggle.
- 3 (Good): correct with reasonable effort.
- 4 (Easy): immediately and confidently correct.

Rules:
- For "use_in_sentence" and free production: accept any answer that correctly uses the target with proper grammar; pick rating based on fluency.
- For "recall_en_to_tr" / "production_tr_to_en": semantic equivalence counts as correct even if wording differs.
- For "cloze_sentence" / "polysemy_choice": exact match or clear synonym = correct.
- Feedback in Turkish.
- "feedback" must never start with "Great", "Excellent", "Harika", "Mükemmel" or similar empty praise.
- JSON only.`;

  const parsed = await chatJson<EvalResponse>(apiKey, EVAL_SYSTEM, userPrompt, {
    temperature: 0.2,
    maxTokens: 500,
  });

  // Defensive: clamp rating, sanitize feedback.
  const rating = ([1, 2, 3, 4].includes(parsed.rating) ? parsed.rating : 3) as 1 | 2 | 3 | 4;
  const feedback = stripSycophancy(parsed.feedback || "");

  return {
    evaluation: parsed.evaluation,
    rating,
    feedback,
    modelAnswer: parsed.modelAnswer,
  };
}

const SYCOPHANCY_PATTERNS = [
  /^(great|excellent|amazing|wonderful|perfect|fantastic|harika|mükemmel|süper|bravo|aferin)[\s,.!]+/i,
];

function stripSycophancy(s: string): string {
  let out = s.trim();
  for (const p of SYCOPHANCY_PATTERNS) {
    out = out.replace(p, "").trimStart();
  }
  return out.charAt(0).toUpperCase() + out.slice(1);
}

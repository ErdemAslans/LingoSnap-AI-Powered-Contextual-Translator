// Exercise generation for SRS reviews.
//
// Pedagogical principles applied:
// - Generative learning: bias toward production over recognition.
// - Interleaving: avoid showing the same exercise type twice in a row for the same card.
// - Comprehensible input (i+1): exercise difficulty scaled to user's CEFR level.
// - No sycophancy: prompts/feedback never include empty praise.
// - Prompts over recasts: hints are provided as guided questions, not direct corrections.

import { chatJson } from "./groq";
import type {
  CefrLevel,
  ExerciseType,
  GeneratedExercise,
  WordCard,
} from "../types/srs";
import type { ExerciseMix } from "../types";

// Production-biased weights for each mix mode.
const MIX_WEIGHTS: Record<ExerciseMix, Record<ExerciseType, number>> = {
  balanced: {
    recall_en_to_tr: 1.0,
    production_tr_to_en: 1.5,
    cloze_sentence: 1.5,
    polysemy_choice: 1.0,
    use_in_sentence: 1.5,
    listen_and_type: 1.0,
    synonym_or_antonym: 1.0,
    context_inference: 1.2,
    yokdil_mcq: 2.0,
  },
  production_heavy: {
    recall_en_to_tr: 0.4,
    production_tr_to_en: 2.0,
    cloze_sentence: 1.5,
    polysemy_choice: 0.6,
    use_in_sentence: 2.5,
    listen_and_type: 1.0,
    synonym_or_antonym: 1.2,
    context_inference: 1.5,
    yokdil_mcq: 1.5,
  },
  recognition_heavy: {
    recall_en_to_tr: 2.0,
    production_tr_to_en: 0.5,
    cloze_sentence: 1.0,
    polysemy_choice: 2.0,
    use_in_sentence: 0.4,
    listen_and_type: 0.5,
    synonym_or_antonym: 0.8,
    context_inference: 1.5,
    yokdil_mcq: 3.0,
  },
};

// Some exercise types only make sense for words with certain properties.
function eligibleTypes(
  card: WordCard,
  mix: ExerciseMix,
  disabled: ExerciseType[],
  ttsEnabled: boolean
): ExerciseType[] {
  const weights = MIX_WEIGHTS[mix];
  return (Object.keys(weights) as ExerciseType[]).filter((t) => {
    if (disabled.includes(t)) return false;
    if (t === "polysemy_choice" && card.meanings.length < 2) return false;
    if (t === "synonym_or_antonym" && card.knownSynonyms.length === 0 && card.knownAntonyms.length === 0) {
      // Still allowed but the model will produce a fresh one.
      return true;
    }
    if (t === "listen_and_type" && !ttsEnabled) return false;
    return true;
  });
}

export function pickExerciseType(
  card: WordCard,
  mix: ExerciseMix,
  disabled: ExerciseType[],
  ttsEnabled: boolean
): ExerciseType {
  const eligible = eligibleTypes(card, mix, disabled, ttsEnabled);
  if (eligible.length === 0) return "recall_en_to_tr";

  const weights = MIX_WEIGHTS[mix];
  // Penalize recently used types to enforce interleaving.
  const recent = new Set(card.recentExerciseTypes.slice(-2));
  const scored = eligible.map((t) => ({
    t,
    w: weights[t] * (recent.has(t) ? 0.2 : 1),
  }));
  const total = scored.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const { t, w } of scored) {
    r -= w;
    if (r <= 0) return t;
  }
  return scored[scored.length - 1].t;
}

// ---------- LLM exercise generation ----------

const EXERCISE_SYSTEM = `You are a master ESL tutor designing dynamic vocabulary exercises for a Turkish learner.
Each exercise must be fresh, contextual, and pitched at the learner's CEFR level (comprehensible input + i+1).
Avoid empty praise. Avoid markdown. Output ONLY valid JSON in the schema requested.`;

interface ExerciseResponse {
  prompt: string;
  contextSentence?: string;
  blank?: string;
  options?: string[];
  expectedAnswer?: string;
  hint?: string;
  ttsText?: string;
  // yokdil_mcq enriched fields
  yokdilFormat?: "single_blank" | "pair" | "conjunction" | "preposition";
  yokdilTranslation?: string;
  yokdilKeyInsight?: string;
  yokdilDistractorAnalysis?: Array<{ option: string; whyWrong: string }>;
}

const TYPE_INSTRUCTIONS: Record<ExerciseType, (card: WordCard, cefr: CefrLevel) => string> = {
  recall_en_to_tr: (card) =>
    `Type: recall_en_to_tr (recognition recall).
Ask the learner: what does "${card.text}" mean in Turkish? If it has multiple meanings, ask for the primary one or all.
Set "expectedAnswer" to the most common Turkish translation: "${card.meanings[0]?.translation ?? ""}".
"prompt" in Turkish.`,

  production_tr_to_en: (card) =>
    `Type: production_tr_to_en (production recall — harder).
Show the Turkish meaning "${card.meanings[0]?.translation ?? ""}" and ask the learner to produce the English ${card.kind === "phrase" ? "phrase" : "word"}.
Set "expectedAnswer" to "${card.text}".
"prompt" in Turkish; the answer field is English.`,

  cloze_sentence: (card, cefr) =>
    `Type: cloze_sentence (fill in the blank).
Construct a NEW natural English sentence at CEFR ${cefr} that uses "${card.text}" in its primary sense ("${card.meanings[0]?.sense ?? ""}").
Replace the target with "_____" in "contextSentence" and put it also in "prompt".
Set "blank" to the exact target form used (may be inflected). Set "expectedAnswer" to the same.
"prompt" header in Turkish; the sentence itself in English.`,

  polysemy_choice: (card) => {
    const list = card.meanings
      .map((m, i) => `${i + 1}. ${m.translation} — _${m.sense}_`)
      .join("\n");
    return `Type: polysemy_choice (which meaning fits this context?).
Construct a NEW English sentence using "${card.text}" in one specific meaning.
Provide ALL meanings as "options" (Turkish translations) so the learner picks the right one for this context.
Available meanings:
${list}
Set "expectedAnswer" to the correct meaning's Turkish translation (one of the options).
"prompt" in Turkish.`;
  },

  use_in_sentence: (card, cefr) =>
    `Type: use_in_sentence (free production).
Ask the learner to write ONE original English sentence using "${card.text}" correctly at CEFR ${cefr}.
No "expectedAnswer" (free production). Provide a "hint" with a 5-word starter prompt.
"prompt" in Turkish.`,

  listen_and_type: (card) =>
    `Type: listen_and_type (dictation).
Construct a short English sentence (8-15 words) using "${card.text}".
Put the sentence in "ttsText" AND in "expectedAnswer".
"prompt" in Turkish, e.g. "Sesli dinle ve duyduğunu yaz."`,

  synonym_or_antonym: (card) => {
    const useAntonym = card.knownSynonyms.length === 0 || Math.random() < 0.4;
    return `Type: synonym_or_antonym.
Ask the learner to give ONE ${useAntonym ? "antonym" : "synonym"} of "${card.text}" in English.
Set "expectedAnswer" to one valid English ${useAntonym ? "antonym" : "synonym"}.
"prompt" in Turkish, e.g. "${useAntonym ? "Şu kelimenin zıt anlamlısını yaz" : "Şu kelimenin eş anlamlısını yaz"}: ${card.text}".`;
  },

  context_inference: (card, cefr) =>
    `Type: context_inference (guess meaning from never-seen context).
Construct a NEW English sentence at CEFR ${cefr} using "${card.text}" in a slightly tricky context.
Ask the learner what "${card.text}" means in this sentence (Turkish answer).
Set "expectedAnswer" to a Turkish gloss matching the meaning used.
Put the English sentence in "contextSentence".
"prompt" in Turkish.`,

  yokdil_mcq: (card, cefr) => {
    const pos = (card.partOfSpeech || "").toLowerCase();
    let formatHint: string;
    if (pos.includes("preposition") || pos === "prep") {
      formatHint = `Format: "preposition" — write a NEW academic English sentence with TWO blanks, both prepositions. The TARGET "${card.text}" fills one of them; the other is a different common preposition you choose. Each of the 5 options is a PAIR like "into / with", "off / on".`;
    } else if (pos.includes("conjunction") || pos.includes("connector")) {
      formatHint = `Format: "conjunction" — write a NEW academic English sentence where the blank is a single conjunction/connector. The TARGET "${card.text}" is the correct option. Distractors should be plausible competing connectors (e.g., While, Because, As though, In order that, Just as).`;
    } else if (card.kind === "phrase" && card.text.split(/\s+/).length >= 2) {
      formatHint = `Format: "single_blank" — write a NEW academic English sentence at CEFR ${cefr}. The blank ("----") is replaced by a PHRASE; the TARGET "${card.text}" is the correct option. Distractors must be plausible competing phrases (same register, similar pattern) but contextually wrong.`;
    } else {
      formatHint = `Format: "single_blank" — write a NEW academic English sentence at CEFR ${cefr} of 25-45 words. The blank ("----") falls where a single content word goes; the TARGET "${card.text}" is the correct option. Distractors are 4 OTHER words of the same part of speech (${pos || "same POS"}), similar register, related but contextually wrong.`;
    }

    return `Type: yokdil_mcq (YÖKDİL-style 5-option multiple choice, academic register).
${formatHint}

REQUIREMENTS:
- contextSentence: the FULL sentence with "----" marking the blank. Tone: academic / encyclopedic / scientific.
- options: exactly 5 entries (A=options[0] … E=options[4]). The correct option MUST be one of them.
- expectedAnswer: the correct option, character-identical to its entry in options.
- yokdilFormat: "single_blank" | "pair" | "conjunction" | "preposition".
- yokdilTranslation: the FULL English sentence translated to natural Turkish (target word translated correctly).
- yokdilKeyInsight: ONE Turkish sentence naming the linguistic key (collocation / register cue / contrast cue / pos cue). No empty praise.
- yokdilDistractorAnalysis: array of 4 entries, one per wrong option, each {option: "...", whyWrong: "kısa Türkçe gerekçe"}.
- prompt: short Turkish instruction (e.g., "Boşluğa en uygun seçeneği işaretle.").

Distractor design (critical):
- Same part of speech and similar morphology to the correct word.
- Plausible at first glance.
- Refutable by ONE strong cue in the sentence (register, collocation, positive/negative polarity, parallelism). Name that cue in distractor analysis.

JSON only.`;
  },
};

export async function generateExercise(
  apiKey: string,
  card: WordCard,
  exerciseType: ExerciseType,
  cefrLevel: CefrLevel
): Promise<GeneratedExercise> {
  const instr = TYPE_INSTRUCTIONS[exerciseType](card, cefrLevel);

  const userPrompt = `Generate ONE vocabulary exercise.

Target: "${card.text}" (${card.kind})
${card.partOfSpeech ? `Part of speech: ${card.partOfSpeech}\n` : ""}Lemma: ${card.lemma ?? card.text}
Meanings:
${card.meanings.map((m, i) => `${i + 1}. ${m.translation} — ${m.sense}`).join("\n")}
${card.firstSeenContext.sentence ? `First-seen context (do NOT reuse verbatim):\n"${card.firstSeenContext.sentence}"\n` : ""}
Recent exercise types for this card (avoid repeating): ${card.recentExerciseTypes.slice(-3).join(", ") || "(none)"}
${card.commonMistakes.length ? `Known recurring mistakes by this learner:\n${card.commonMistakes.map((m) => `- ${m}`).join("\n")}\n` : ""}

${instr}

Return JSON with this shape (omit fields not relevant to this type):
{
  "prompt": "string — instruction shown to learner, in Turkish unless type requires English",
  "contextSentence": "string — only for cloze_sentence / context_inference",
  "blank": "string — the exact masked token for cloze_sentence",
  "options": ["..."] - "only for polysemy_choice",
  "expectedAnswer": "string — the ideal answer (omit for free production)",
  "hint": "string — gentle hint laddered after first wrong try",
  "ttsText": "string — only for listen_and_type"
}

Rules:
- Sentences MUST be NEW; do not reuse the first-seen context.
- No empty praise in any field.
- JSON only.`;

  const parsed = await chatJson<ExerciseResponse>(apiKey, EXERCISE_SYSTEM, userPrompt, {
    temperature: 0.7,
    maxTokens: 700,
  });

  return {
    exerciseType,
    prompt: parsed.prompt,
    contextSentence: parsed.contextSentence,
    blank: parsed.blank,
    options: parsed.options,
    expectedAnswer: parsed.expectedAnswer,
    hint: parsed.hint,
    ttsText: parsed.ttsText,
    cefrTargetLevel: cefrLevel,
    yokdilFormat: parsed.yokdilFormat,
    yokdilTranslation: parsed.yokdilTranslation,
    yokdilKeyInsight: parsed.yokdilKeyInsight,
    yokdilDistractorAnalysis: parsed.yokdilDistractorAnalysis,
  };
}

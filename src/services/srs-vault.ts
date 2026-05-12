// Persist word/phrase cards in the user's vault as Markdown + a fast-lookup index.json.
//
// Layout:
//   {vaultPath}/words/{lemma}.md       -- one card per file, Obsidian-friendly
//   {vaultPath}/words-index.json       -- in-memory hot path: SRS state + last review
//   {vaultPath}/reviews/{YYYY-MM-DD}.md -- daily review journal

import {
  mkdir,
  writeTextFile,
  readTextFile,
  exists,
} from "@tauri-apps/plugin-fs";
import type { WordCard } from "../types/srs";

interface WordsIndex {
  cards: WordCard[];
  lastUpdated: number;
}

function indexPath(vaultPath: string): string {
  return `${vaultPath}/words-index.json`;
}

function wordsDir(vaultPath: string): string {
  return `${vaultPath}/words`;
}

function reviewsDir(vaultPath: string): string {
  return `${vaultPath}/reviews`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80)
    .replace(/-+$/, "") || "card";
}

async function ensureStructure(vaultPath: string): Promise<void> {
  const dirs = [wordsDir(vaultPath), reviewsDir(vaultPath)];
  for (const d of dirs) {
    if (!(await exists(d))) {
      await mkdir(d, { recursive: true });
    }
  }
}

export async function loadWordsIndex(vaultPath: string): Promise<WordCard[]> {
  if (!vaultPath) return [];
  const p = indexPath(vaultPath);
  try {
    if (await exists(p)) {
      const raw = await readTextFile(p);
      const parsed = JSON.parse(raw) as WordsIndex;
      return parsed.cards ?? [];
    }
  } catch (e) {
    console.error("[SRS Vault] Failed to load index:", e);
  }
  return [];
}

async function saveIndex(vaultPath: string, cards: WordCard[]): Promise<void> {
  if (!vaultPath) return;
  await ensureStructure(vaultPath);
  const data: WordsIndex = { cards, lastUpdated: Date.now() };
  try {
    await writeTextFile(indexPath(vaultPath), JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("[SRS Vault] Failed to save index:", e);
  }
}

function cardToMarkdown(card: WordCard): string {
  const meaningsBlock = card.meanings
    .map(
      (m, i) =>
        `${i + 1}. **${m.translation}** — _${m.sense}_${m.example ? `\n   - Example: ${m.example}` : ""}`
    )
    .join("\n");

  const recentReviews = card.reviews
    .slice(-10)
    .map(
      (r) =>
        `- ${new Date(r.timestamp).toISOString()} • ${r.exerciseType} • rating=${r.rating} • ${r.evaluation}`
    )
    .join("\n");

  return `---
id: ${card.id}
text: "${card.text}"
kind: ${card.kind}
lemma: ${card.lemma ?? card.text}
pos: ${card.partOfSpeech ?? ""}
ipa: ${card.ipa ?? ""}
created: ${new Date(card.createdAt).toISOString()}
updated: ${new Date(card.updatedAt).toISOString()}
tags: [${card.tags.join(", ")}]
fsrs_state: ${card.fsrs.state}
fsrs_due: ${card.fsrs.due}
fsrs_stability: ${card.fsrs.stability.toFixed(3)}
fsrs_difficulty: ${card.fsrs.difficulty.toFixed(3)}
fsrs_reps: ${card.fsrs.reps}
fsrs_lapses: ${card.fsrs.lapses}
---

# ${card.text}

## Meanings

${meaningsBlock || "_(no meanings yet)_"}

## First seen

> ${card.firstSeenContext.sentence}

_${new Date(card.firstSeenContext.timestamp).toLocaleString("tr-TR")}_

${card.knownSynonyms.length ? `\n## Synonyms\n\n${card.knownSynonyms.join(", ")}\n` : ""}
${card.knownAntonyms.length ? `\n## Antonyms\n\n${card.knownAntonyms.join(", ")}\n` : ""}
${card.commonMistakes.length ? `\n## Recurring mistakes\n\n${card.commonMistakes.map((m) => `- ${m}`).join("\n")}\n` : ""}

## Review log (last 10)

${recentReviews || "_(no reviews yet)_"}
`;
}

async function writeCardMarkdown(vaultPath: string, card: WordCard): Promise<void> {
  if (!vaultPath) return;
  await ensureStructure(vaultPath);
  const slug = slugify(card.lemma ?? card.text);
  const path = `${wordsDir(vaultPath)}/${slug}.md`;
  try {
    await writeTextFile(path, cardToMarkdown(card));
  } catch (e) {
    console.error("[SRS Vault] Failed to write card markdown:", e);
  }
}

export async function upsertCard(
  vaultPath: string,
  card: WordCard,
  existingCards?: WordCard[]
): Promise<WordCard[]> {
  const cards = existingCards ?? (await loadWordsIndex(vaultPath));
  const idx = cards.findIndex((c) => c.id === card.id);
  if (idx >= 0) {
    cards[idx] = card;
  } else {
    cards.push(card);
  }
  await saveIndex(vaultPath, cards);
  await writeCardMarkdown(vaultPath, card);
  return cards;
}

export async function deleteCard(
  vaultPath: string,
  cardId: string,
  existingCards?: WordCard[]
): Promise<WordCard[]> {
  const cards = (existingCards ?? (await loadWordsIndex(vaultPath))).filter(
    (c) => c.id !== cardId
  );
  await saveIndex(vaultPath, cards);
  return cards;
}

export async function appendDailyReview(
  vaultPath: string,
  card: WordCard,
  reviewIndex: number
): Promise<void> {
  if (!vaultPath) return;
  await ensureStructure(vaultPath);
  const review = card.reviews[reviewIndex];
  if (!review) return;

  const date = new Date(review.timestamp).toISOString().split("T")[0];
  const path = `${reviewsDir(vaultPath)}/${date}.md`;

  const entry = `
---
## ${new Date(review.timestamp).toLocaleTimeString("tr-TR")} • ${card.text}

- **Type:** ${review.exerciseType}
- **Prompt:** ${review.prompt.replace(/\n/g, " ")}
- **Your answer:** ${review.userAnswer || "_(empty)_"}
- **Expected:** ${review.expectedAnswer ?? "_(flexible)_"}
- **Evaluation:** ${review.evaluation}
- **Rating:** ${review.rating} (${["", "Again", "Hard", "Good", "Easy"][review.rating]})
- **Time:** ${(review.timeSpentMs / 1000).toFixed(1)}s
${review.feedback ? `- **Feedback:** ${review.feedback}` : ""}
`;

  try {
    const existing = (await exists(path)) ? await readTextFile(path) : `# Reviews — ${date}\n`;
    await writeTextFile(path, existing + entry);
  } catch (e) {
    console.error("[SRS Vault] Failed to append daily review:", e);
  }
}

import {
  mkdir,
  writeTextFile,
  readTextFile,
  exists,
} from "@tauri-apps/plugin-fs";
import type { TranslationResult } from "../types";

export interface VaultEntry {
  id: string;
  date: string;
  timestamp: number;
  original: string;
  translation: string;
  topic?: string;
  contextNote?: string;
  tags?: string[];
  filePath: string;
}

export interface VaultIndex {
  entries: VaultEntry[];
  topics: Record<string, string[]>; // topic -> entry ids
  lastUpdated: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 50)
    .replace(/-+$/, "");
}

function getDateString(): string {
  return new Date().toISOString().split("T")[0];
}

function getTimeString(): string {
  return new Date().toISOString().split("T")[1].split(".")[0].replace(/:/g, "");
}

export async function ensureVaultStructure(vaultPath: string): Promise<void> {
  const translationsDir = `${vaultPath}/translations`;
  const todayDir = `${translationsDir}/${getDateString()}`;

  try {
    if (!(await exists(translationsDir))) {
      await mkdir(translationsDir, { recursive: true });
    }
    if (!(await exists(todayDir))) {
      await mkdir(todayDir, { recursive: true });
    }
  } catch (e) {
    console.error("[Vault] Error creating directories:", e);
  }
}

export async function saveToVault(
  vaultPath: string,
  id: string,
  originalText: string,
  result: TranslationResult
): Promise<string> {
  await ensureVaultStructure(vaultPath);

  const date = getDateString();
  const time = getTimeString();
  const slug = slugify(originalText.slice(0, 40)) || "translation";
  const fileName = `${time}-${slug}.md`;
  const filePath = `${vaultPath}/translations/${date}/${fileName}`;

  const topicLine = result.topic ? `topic: ${result.topic}` : "topic: General";
  const tagsLine = result.tags?.length ? `tags: [${result.tags.join(", ")}]` : "tags: []";

  const content = `---
id: ${id}
date: ${new Date().toISOString()}
${topicLine}
${tagsLine}
---

## Original (EN)

${originalText}

## Çeviri (TR)

${result.translation}
${result.contextNote ? `\n## Bağlam Notu\n\n${result.contextNote}` : ""}
`;

  try {
    await writeTextFile(filePath, content);
  } catch (e) {
    console.error("[Vault] Error writing file:", e);
  }

  // Update index
  await updateIndex(vaultPath, {
    id,
    date,
    timestamp: Date.now(),
    original: originalText.slice(0, 200),
    translation: result.translation.slice(0, 200),
    topic: result.topic,
    contextNote: result.contextNote,
    tags: result.tags,
    filePath,
  });

  return filePath;
}

async function loadIndex(vaultPath: string): Promise<VaultIndex> {
  const indexPath = `${vaultPath}/index.json`;
  try {
    if (await exists(indexPath)) {
      const raw = await readTextFile(indexPath);
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("[Vault] Error loading index:", e);
  }
  return { entries: [], topics: {}, lastUpdated: 0 };
}

async function saveIndex(vaultPath: string, index: VaultIndex): Promise<void> {
  const indexPath = `${vaultPath}/index.json`;
  try {
    await writeTextFile(indexPath, JSON.stringify(index, null, 2));
  } catch (e) {
    console.error("[Vault] Error saving index:", e);
  }
}

async function updateIndex(vaultPath: string, entry: VaultEntry): Promise<void> {
  const index = await loadIndex(vaultPath);

  // Add entry (keep last 500)
  index.entries.unshift(entry);
  if (index.entries.length > 500) {
    index.entries = index.entries.slice(0, 500);
  }

  // Update topic index
  const topic = entry.topic || "General";
  if (!index.topics[topic]) {
    index.topics[topic] = [];
  }
  index.topics[topic].unshift(entry.id);
  if (index.topics[topic].length > 100) {
    index.topics[topic] = index.topics[topic].slice(0, 100);
  }

  index.lastUpdated = Date.now();
  await saveIndex(vaultPath, index);
}

export async function getRecentByTopic(
  vaultPath: string,
  topic: string,
  limit: number = 5
): Promise<VaultEntry[]> {
  const index = await loadIndex(vaultPath);
  const topicIds = index.topics[topic] || [];
  const entries = topicIds
    .slice(0, limit)
    .map((id) => index.entries.find((e) => e.id === id))
    .filter(Boolean) as VaultEntry[];
  return entries;
}

export async function getRecentTranslations(
  vaultPath: string,
  limit: number = 10
): Promise<VaultEntry[]> {
  const index = await loadIndex(vaultPath);
  return index.entries.slice(0, limit);
}

export async function searchVault(
  vaultPath: string,
  query: string,
  limit: number = 10
): Promise<VaultEntry[]> {
  const index = await loadIndex(vaultPath);
  const lowerQuery = query.toLowerCase();
  return index.entries
    .filter(
      (e) =>
        e.original.toLowerCase().includes(lowerQuery) ||
        e.translation.toLowerCase().includes(lowerQuery) ||
        (e.topic && e.topic.toLowerCase().includes(lowerQuery))
    )
    .slice(0, limit);
}

export async function getVaultStats(vaultPath: string): Promise<{
  totalEntries: number;
  topicCount: number;
  topics: string[];
}> {
  const index = await loadIndex(vaultPath);
  return {
    totalEntries: index.entries.length,
    topicCount: Object.keys(index.topics).length,
    topics: Object.keys(index.topics),
  };
}

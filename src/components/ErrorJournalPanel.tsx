// ErrorJournalPanel — surfaces recurring misconceptions across the deck.
//
// Data source: each WordCard.commonMistakes[] is appended via ReviewTab when
// the user gets an answer wrong AND the AI classifies a misconception
// category. This panel aggregates those tags across the whole deck and
// presents the top recurring patterns so the learner sees themselves.

import { useMemo } from "react";
import { AlertTriangle, BookOpen } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import type { MisconceptionCategory } from "../types/srs";

const CATEGORY_LABELS_TR: Record<MisconceptionCategory, string> = {
  false_friend: "Yalancı eş",
  register: "Kayıt (formal/informal)",
  polysemy: "Çok anlamlılık",
  collocation: "Doğal eşdizim (collocation)",
  preposition: "Bağımlı edat",
  grammar_pattern: "Dilbilgisi kalıbı",
  morphology: "Çekim / kök",
  spelling: "Yazım",
  semantic_neighbor: "Yakın anlam karışıklığı",
  other: "Diğer",
};

interface Entry {
  category: MisconceptionCategory;
  label: string;
  count: number;
  cardIds: string[];
  cardTexts: string[];
}

export default function ErrorJournalPanel() {
  const cards = useAppStore((s) => s.cards);

  const entries = useMemo<Entry[]>(() => {
    const map = new Map<string, Entry>();
    for (const c of cards) {
      for (const m of c.commonMistakes) {
        // Format produced in ReviewTab: "[category] label"
        const match = /^\[(.+?)\]\s+(.*)$/.exec(m);
        if (!match) continue;
        const [, cat, label] = match;
        const key = `${cat}::${label.toLowerCase()}`;
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
          if (!existing.cardIds.includes(c.id)) {
            existing.cardIds.push(c.id);
            existing.cardTexts.push(c.text);
          }
        } else {
          map.set(key, {
            category: cat as MisconceptionCategory,
            label,
            count: 1,
            cardIds: [c.id],
            cardTexts: [c.text],
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [cards]);

  const byCategory = useMemo(() => {
    const m: Partial<Record<MisconceptionCategory, number>> = {};
    for (const e of entries) {
      m[e.category] = (m[e.category] ?? 0) + e.count;
    }
    return Object.entries(m)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .slice(0, 6);
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <BookOpen size={14} />
          <span>Hata günlüğü henüz boş — birkaç tekrar yaptıktan sonra burada görünmeye başlar.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-orange-400" />
        <h3 className="text-base font-semibold text-white">Hata Günlüğü</h3>
        <span className="text-xs text-zinc-500">— düzeltilebilir kalıplar</span>
      </div>

      {/* Category buckets */}
      <div className="grid grid-cols-2 gap-2">
        {byCategory.map(([cat, n]) => (
          <div
            key={cat}
            className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2"
          >
            <div className="text-xs text-zinc-500">
              {CATEGORY_LABELS_TR[cat as MisconceptionCategory] ?? cat}
            </div>
            <div className="text-lg font-bold text-white">{n}</div>
          </div>
        ))}
      </div>

      {/* Pattern list */}
      <div className="space-y-1.5">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          Tekrarlayan kalıplar
        </div>
        {entries.slice(0, 12).map((e, i) => (
          <div
            key={i}
            className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-zinc-500">
                  {CATEGORY_LABELS_TR[e.category] ?? e.category}
                </div>
                <div className="text-sm text-zinc-200">{e.label}</div>
                {e.cardTexts.length > 0 && (
                  <div className="mt-1 text-xs text-zinc-500 truncate">
                    {e.cardTexts.slice(0, 3).join(" · ")}
                    {e.cardTexts.length > 3 && ` +${e.cardTexts.length - 3}`}
                  </div>
                )}
              </div>
              <span className="shrink-0 rounded bg-orange-500/20 px-2 py-0.5 text-xs font-bold text-orange-300">
                ×{e.count}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

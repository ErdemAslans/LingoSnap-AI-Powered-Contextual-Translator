// WordLookupCard — small modal-style card shown when the user clicks a word in the
// translation popup. Fetches definitions via Groq, lets the user add to SRS deck.

import { useEffect, useState } from "react";
import { Loader2, Plus, X, Check, Volume2 } from "lucide-react";
import { lookupWord } from "../services/tutor";
import { useAppStore } from "../stores/appStore";
import { useSRS } from "../hooks/useSRS";
import { speakEnglish } from "../services/tts";
import type { WordLookup } from "../types/srs";

interface Props {
  text: string;
  contextSentence: string;
  translationEntryId?: string;
  onClose: () => void;
}

export default function WordLookupCard({ text, contextSentence, translationEntryId, onClose }: Props) {
  const settings = useAppStore((s) => s.settings);
  const cards = useAppStore((s) => s.cards);
  const { addCardFromLookup } = useSRS();

  const [lookup, setLookup] = useState<WordLookup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  // Already in deck?
  const alreadyInDeck = cards.some(
    (c) => c.lemma?.toLowerCase() === text.toLowerCase() || c.text.toLowerCase() === text.toLowerCase()
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await lookupWord(settings.apiKey, text, contextSentence, settings.cefrLevel);
        if (!cancelled) {
          setLookup(result);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Sözlük araması başarısız");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [text, contextSentence, settings.apiKey, settings.cefrLevel]);

  const handleAdd = async () => {
    if (!lookup) return;
    setAdding(true);
    try {
      await addCardFromLookup(lookup, contextSentence, translationEntryId);
      setAdded(true);
      setTimeout(onClose, 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Karta eklenemedi");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-700/50 bg-gradient-to-br from-zinc-900 to-black p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl font-bold text-white">{text}</h3>
            {lookup?.ipa && <span className="text-sm text-zinc-500">{lookup.ipa}</span>}
            {settings.enableTTS && (
              <button
                onClick={() => speakEnglish(text)}
                className="rounded p-1 text-zinc-500 hover:text-zinc-300"
                title="Telaffuz dinle"
              >
                <Volume2 size={14} />
              </button>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-500 hover:text-white hover:bg-zinc-800">
            <X size={16} />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="ml-3 text-sm text-zinc-400">Sözlük araştırılıyor...</span>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {lookup && !loading && (
          <>
            {lookup.partOfSpeech && (
              <div className="mb-3 text-xs uppercase tracking-wider text-zinc-500">
                {lookup.partOfSpeech} · {lookup.kind === "phrase" ? "İfade" : "Kelime"}
                {lookup.lemma && lookup.lemma.toLowerCase() !== text.toLowerCase() && (
                  <span className="ml-2 text-zinc-400">(lemma: {lookup.lemma})</span>
                )}
              </div>
            )}

            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto pr-1">
              {lookup.meanings.map((m, i) => {
                const isContextual = lookup.inContextMeaningIndex === i;
                return (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 ${
                      isContextual
                        ? "border-yellow-500/40 bg-yellow-500/5"
                        : "border-zinc-800 bg-zinc-900/50"
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold text-zinc-500">{i + 1}.</span>
                      <span className="text-sm font-medium text-white">{m.translation}</span>
                      {isContextual && (
                        <span className="ml-auto text-xs text-yellow-400">bağlama uygun</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zinc-400 italic">{m.sense}</p>
                    {m.example && (
                      <p className="mt-1 text-xs text-zinc-300">
                        <span className="text-zinc-600">"</span>
                        {m.example}
                        <span className="text-zinc-600">"</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {(lookup.synonyms.length > 0 || lookup.antonyms.length > 0) && (
              <div className="mb-4 space-y-1 text-xs">
                {lookup.synonyms.length > 0 && (
                  <div>
                    <span className="text-zinc-500">Eş anlamlı: </span>
                    <span className="text-zinc-300">{lookup.synonyms.join(", ")}</span>
                  </div>
                )}
                {lookup.antonyms.length > 0 && (
                  <div>
                    <span className="text-zinc-500">Zıt: </span>
                    <span className="text-zinc-300">{lookup.antonyms.join(", ")}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-zinc-800 px-4 py-2.5 text-sm text-zinc-400 hover:bg-zinc-900 transition-colors"
              >
                Biliyorum, ekleme
              </button>
              <button
                onClick={handleAdd}
                disabled={adding || added || alreadyInDeck}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                  added
                    ? "bg-green-500/20 text-green-400"
                    : alreadyInDeck
                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    : "bg-white text-black hover:bg-zinc-200 disabled:opacity-50"
                }`}
              >
                {added ? (
                  <>
                    <Check size={14} /> Eklendi
                  </>
                ) : alreadyInDeck ? (
                  "Zaten deck'te"
                ) : adding ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Ekleniyor
                  </>
                ) : (
                  <>
                    <Plus size={14} /> Deck'e Ekle
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

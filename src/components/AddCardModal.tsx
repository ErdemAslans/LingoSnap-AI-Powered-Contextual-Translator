// AddCardModal — Anki-style manual card creation.
//
// User flow:
//   1. Type a word or phrase.
//   2. (Optional) provide a context sentence — improves polysemy disambiguation.
//   3. Click "Ara ve Ekle" → AI looks the word up (lookupWord) and shows a
//      WordLookupCard-style preview with multiple meanings + "Deck'e Ekle".
//
// Reuses the same backend (services/tutor.lookupWord) as the click-to-add
// flow from the translation popup, so manual cards get the same rich data:
// polysemy, IPA, synonyms, antonyms, examples.

import { useState } from "react";
import { Loader2, Plus, X, Check, BookPlus, AlertCircle, Volume2 } from "lucide-react";
import { lookupWord } from "../services/tutor";
import { useAppStore } from "../stores/appStore";
import { useSRS } from "../hooks/useSRS";
import { speakEnglish } from "../services/tts";
import type { WordLookup } from "../types/srs";

interface Props {
  onClose: () => void;
}

type Phase = "entry" | "loading" | "preview" | "saving" | "saved" | "error";

export default function AddCardModal({ onClose }: Props) {
  const settings = useAppStore((s) => s.settings);
  const cards = useAppStore((s) => s.cards);
  const { addCardFromLookup } = useSRS();

  const [word, setWord] = useState("");
  const [context, setContext] = useState("");
  const [phase, setPhase] = useState<Phase>("entry");
  const [lookup, setLookup] = useState<WordLookup | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async () => {
    const trimmed = word.trim();
    if (!trimmed) return;
    if (!settings.apiKey) {
      setError("Önce Ayarlar sekmesinden API anahtarını gir.");
      setPhase("error");
      return;
    }

    setPhase("loading");
    setError(null);
    try {
      const result = await lookupWord(
        settings.apiKey,
        trimmed,
        context.trim() || undefined,
        settings.cefrLevel
      );
      setLookup(result);
      setPhase("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sözlük araması başarısız");
      setPhase("error");
    }
  };

  const handleAdd = async () => {
    if (!lookup) return;
    setPhase("saving");
    try {
      await addCardFromLookup(lookup, context.trim() || word, undefined);
      setPhase("saved");
      setTimeout(onClose, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Karta eklenemedi");
      setPhase("error");
    }
  };

  const existingCard = lookup
    ? cards.find(
        (c) =>
          c.lemma?.toLowerCase() === lookup.lemma.toLowerCase() ||
          c.text.toLowerCase() === lookup.text.toLowerCase()
      )
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-700/50 bg-gradient-to-br from-zinc-900 to-black p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookPlus size={18} className="text-blue-400" />
            <h3 className="text-lg font-bold text-white">Yeni Kart Ekle</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:text-white hover:bg-zinc-800"
          >
            <X size={16} />
          </button>
        </div>

        {phase === "entry" && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                Kelime veya ifade
              </label>
              <input
                type="text"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                placeholder="örn: bedrock, get along with, throw in the towel"
                autoFocus
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-base text-white placeholder:text-zinc-600 focus:border-white focus:outline-none"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Tek kelime, deyim, kalıp ya da phrasal verb olabilir.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                Bağlam cümlesi (opsiyonel)
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Kelimeyi nerede gördüğün cümle — birden fazla anlamı varsa AI doğrusunu seçer."
                rows={3}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-white focus:outline-none resize-none"
              />
            </div>

            <button
              onClick={handleLookup}
              disabled={!word.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Ara ve Önizle
              <Plus size={14} />
            </button>
          </div>
        )}

        {phase === "loading" && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="ml-3 text-sm text-zinc-400">AI ile araştırılıyor...</span>
          </div>
        )}

        {phase === "preview" && lookup && (
          <div className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-white">{lookup.text}</span>
              {lookup.ipa && <span className="text-sm text-zinc-500">{lookup.ipa}</span>}
              {settings.enableTTS && (
                <button
                  onClick={() => speakEnglish(lookup.text)}
                  className="rounded p-1 text-zinc-500 hover:text-zinc-300"
                  title="Telaffuz"
                >
                  <Volume2 size={14} />
                </button>
              )}
              {lookup.partOfSpeech && (
                <span className="ml-auto text-xs uppercase tracking-wide text-zinc-500">
                  {lookup.partOfSpeech} · {lookup.kind === "phrase" ? "İfade" : "Kelime"}
                </span>
              )}
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
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
              <div className="space-y-1 text-xs">
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
                onClick={() => setPhase("entry")}
                className="flex-1 rounded-lg border border-zinc-800 px-4 py-2.5 text-sm text-zinc-400 hover:bg-zinc-900"
              >
                Geri
              </button>
              <button
                onClick={handleAdd}
                disabled={!!existingCard}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                  existingCard
                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    : "bg-white text-black hover:bg-zinc-200"
                }`}
              >
                {existingCard ? (
                  "Zaten deck'te"
                ) : (
                  <>
                    <Plus size={14} /> Deck'e Ekle
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {phase === "saving" && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            <span className="ml-3 text-sm text-zinc-400">Ekleniyor...</span>
          </div>
        )}

        {phase === "saved" && (
          <div className="flex flex-col items-center justify-center py-6">
            <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
              <Check className="h-6 w-6 text-green-400" />
            </div>
            <p className="text-sm font-medium text-white">Eklendi</p>
            <p className="text-xs text-zinc-500 mt-1">Yeni kart deck'inde — yarın bekliyor olacak.</p>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-3 text-sm text-red-300">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => {
                setError(null);
                setPhase("entry");
              }}
              className="w-full rounded-lg border border-zinc-800 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-900"
            >
              Tekrar dene
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

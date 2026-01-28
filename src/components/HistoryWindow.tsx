import { useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Search, Copy, Trash2, Download, Trash, Star, Check } from "lucide-react";
import { useHistory } from "../hooks/useHistory";
import { formatTimestamp, exportAsJson, exportAsCsv } from "../utils/helpers";

type FilterType = "all" | "favorites";

export default function HistoryWindow() {
  const { history, allHistory, search, setSearch, deleteEntry, clearAll, toggleFavorite } =
    useHistory();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");

  const handleCopy = async (text: string, id: string) => {
    await writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filteredHistory =
    filter === "favorites" ? history.filter((e) => e.isFavorite) : history;

  const favoriteCount = allHistory.filter((e) => e.isFavorite).length;

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
              <span className="text-sm font-bold text-black">L</span>
            </div>
            <h1 className="text-lg font-bold">Çeviri Geçmişi</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exportAsJson(allHistory, "lingosnap-history.json")}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
              title="JSON olarak dışa aktar"
            >
              <Download size={12} /> JSON
            </button>
            <button
              onClick={() => exportAsCsv(allHistory, "lingosnap-history.csv")}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
              title="CSV olarak dışa aktar"
            >
              <Download size={12} /> CSV
            </button>
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              title="Tümünü sil"
            >
              <Trash size={12} /> Temizle
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === "all"
                ? "bg-white text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Tümü ({allHistory.length})
          </button>
          <button
            onClick={() => setFilter("favorites")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === "favorites"
                ? "bg-yellow-500/20 text-yellow-400"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Star size={14} />
            Favoriler ({favoriteCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Çevirilerde ara..."
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2.5 pl-9 pr-3 text-sm placeholder:text-zinc-600 focus:border-white focus:outline-none"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredHistory.length === 0 ? (
          <div className="text-center py-12">
            <div className="mb-3 text-4xl">
              {filter === "favorites" ? "⭐" : search ? "🔍" : "📝"}
            </div>
            <p className="text-zinc-500">
              {filter === "favorites"
                ? "Henüz favori çevirin yok"
                : search
                ? "Eşleşen çeviri bulunamadı"
                : "Henüz çeviri yapmadın"}
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              {filter === "favorites"
                ? "Çevirileri yıldızlayarak favorilere ekle"
                : !search && "Ctrl+Shift+C ile ilk çevirini yap!"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredHistory.map((entry) => (
              <div
                key={entry.id}
                className={`group rounded-xl border bg-zinc-900/50 p-4 transition-colors ${
                  entry.isFavorite
                    ? "border-yellow-500/30 hover:border-yellow-500/50"
                    : "border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {entry.isFavorite && (
                        <Star size={12} className="text-yellow-400" fill="currentColor" />
                      )}
                      <p className="text-xs text-zinc-500">
                        {formatTimestamp(entry.timestamp)}
                      </p>
                    </div>
                    <p className="text-sm text-zinc-400 line-clamp-2">
                      {entry.originalText}
                    </p>
                    <p className="mt-1.5 text-sm font-medium text-white">
                      {entry.result.translation}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => toggleFavorite(entry.id)}
                      className={`rounded-lg p-2 transition-colors ${
                        entry.isFavorite
                          ? "text-yellow-400 hover:bg-yellow-500/10"
                          : "text-zinc-500 hover:text-yellow-400 hover:bg-zinc-800"
                      }`}
                      title={entry.isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
                    >
                      <Star size={14} fill={entry.isFavorite ? "currentColor" : "none"} />
                    </button>
                    <button
                      onClick={() => handleCopy(entry.result.translation, entry.id)}
                      className="rounded-lg p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                      title="Kopyala"
                    >
                      {copiedId === entry.id ? (
                        <Check size={14} className="text-green-400" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="rounded-lg p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                      title="Sil"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

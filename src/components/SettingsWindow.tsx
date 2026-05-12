import { useState, useEffect, useMemo } from "react";
import { useSettings } from "../hooks/useSettings";
import { useHistory } from "../hooks/useHistory";
import { useSRS } from "../hooks/useSRS";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { open as dialogOpen } from "@tauri-apps/plugin-dialog";
import { testApiKey } from "../services/groq";
import {
  Settings,
  History,
  Trash2,
  Copy,
  X,
  Star,
  Flame,
  Zap,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  ExternalLink,
  Check,
  ChevronRight,
  FolderOpen,
  MousePointer2,
  BookOpen,
  GraduationCap,
} from "lucide-react";
import ReviewTab from "./ReviewTab";
import { CEFR_LEVELS, type CefrLevel } from "../types/srs";

type Tab = "settings" | "history" | "review";
type HistoryFilter = "all" | "favorites";

function Onboarding({
  onComplete,
}: {
  onComplete: (apiKey: string, vaultPath: string, cefrLevel: CefrLevel) => void;
}) {
  const [step, setStep] = useState(1);
  const [apiKey, setApiKey] = useState("");
  const [vaultPath, setVaultPath] = useState("");
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>("B1");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState("");

  const handleSelectFolder = async () => {
    const selected = await dialogOpen({
      directory: true,
      title: "Bilgi Tabanı Klasörü Seç",
    });
    if (selected) {
      setVaultPath(selected as string);
    }
  };

  const handleValidateAndContinue = async () => {
    if (!apiKey || apiKey.length < 10) {
      setError("Lütfen geçerli bir API anahtarı girin");
      return;
    }
    setIsValidating(true);
    setError("");

    const result = await testApiKey(apiKey);
    setIsValidating(false);

    if (result === "ok") {
      setStep(3);
    } else {
      setError(`API anahtarı doğrulanamadı: ${result}`);
    }
  };

  const handleSelectVaultAndContinue = () => {
    if (!vaultPath) {
      setError("Lütfen bir klasör seçin");
      return;
    }
    setError("");
    setStep(4);
  };

  const handleFinish = () => {
    onComplete(apiKey, vaultPath, cefrLevel);
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-black text-white p-8">
      <div className="w-full max-w-md">
        {step === 1 && (
          <div className="text-center animate-fadeIn">
            <div className="mb-8 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-lg shadow-white/20">
                <span className="text-4xl font-bold text-black">L</span>
              </div>
            </div>

            <h1 className="text-3xl font-bold mb-3">LingoSnap'e Hoş Geldin!</h1>
            <p className="text-zinc-400 mb-8">
              Mouse ile metin seç, anında çevirsin. Öğrenme sürecini takip etsin.
            </p>

            <div className="space-y-3 mb-8 text-left">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50">
                <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <MousePointer2 className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Seç ve Çevir</p>
                  <p className="text-xs text-zinc-500">Mouse ile metin seçince otomatik çevirir</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50">
                <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <FolderOpen className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Bilgi Tabanı</p>
                  <p className="text-xs text-zinc-500">Çevirilerini kaydeder, bağlam oluşturur</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50">
                <div className="h-10 w-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Bağlamsal Çeviri</p>
                  <p className="text-xs text-zinc-500">Önceki çevirilerden öğrenir, tutarlı çevirir</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 text-base font-semibold text-black hover:bg-zinc-200 transition-colors"
            >
              Başlayalım
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fadeIn">
            <button
              onClick={() => setStep(1)}
              className="mb-6 text-sm text-zinc-500 hover:text-white transition-colors"
            >
              ← Geri
            </button>

            <h2 className="text-2xl font-bold mb-2">API Anahtarı</h2>
            <p className="text-zinc-400 mb-6">
              LingoSnap, çeviri için Groq AI kullanır. Ücretsiz bir API anahtarı almanız
              gerekiyor.
            </p>

            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold shrink-0">
                  1
                </div>
                <div>
                  <p className="text-sm">
                    Groq Console'a gidin ve ücretsiz hesap oluşturun
                  </p>
                  <button
                    onClick={() => shellOpen("https://console.groq.com/")}
                    className="mt-1 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    console.groq.com
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold shrink-0">
                  2
                </div>
                <p className="text-sm">API Keys bölümünden yeni bir anahtar oluşturun</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold shrink-0">
                  3
                </div>
                <p className="text-sm">Anahtarı aşağıya yapıştırın</p>
              </div>
            </div>

            <div className="mb-4">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setError("");
                }}
                placeholder="gsk_..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-4 text-base text-white placeholder:text-zinc-600 focus:border-white focus:outline-none"
              />
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            </div>

            <button
              onClick={handleValidateAndContinue}
              disabled={isValidating || !apiKey}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 text-base font-semibold text-black hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isValidating ? "Kontrol ediliyor..." : "Devam"}
              {!isValidating && <ChevronRight size={18} />}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fadeIn">
            <button
              onClick={() => setStep(2)}
              className="mb-6 text-sm text-zinc-500 hover:text-white transition-colors"
            >
              ← Geri
            </button>

            <h2 className="text-2xl font-bold mb-2">Bilgi Tabanı Klasörü</h2>
            <p className="text-zinc-400 mb-6">
              Çevirilerini ve kelime kartlarını nereye kaydetmek istersin? Bu klasör senin kişisel bilgi tabanın olacak.
              Obsidian gibi not uygulamalarıyla da kullanabilirsin.
            </p>

            <button
              onClick={handleSelectFolder}
              className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/50 px-4 py-6 hover:border-zinc-500 transition-colors mb-4"
            >
              <FolderOpen size={24} className="text-zinc-400" />
              <div className="text-left flex-1 min-w-0">
                {vaultPath ? (
                  <>
                    <p className="text-sm font-medium text-white truncate">{vaultPath}</p>
                    <p className="text-xs text-green-400">Klasör seçildi</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-zinc-300">Klasör Seç</p>
                    <p className="text-xs text-zinc-500">Çeviriler buraya kaydedilecek</p>
                  </>
                )}
              </div>
            </button>

            {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

            <button
              onClick={handleSelectVaultAndContinue}
              disabled={!vaultPath}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 text-base font-semibold text-black hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Devam
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="animate-fadeIn">
            <button
              onClick={() => setStep(3)}
              className="mb-6 text-sm text-zinc-500 hover:text-white transition-colors"
            >
              ← Geri
            </button>

            <h2 className="text-2xl font-bold mb-2">İngilizce seviyen?</h2>
            <p className="text-zinc-400 mb-6">
              Tekrar egzersizleri bu seviyeye göre kalibre olur. Sonradan ayarlardan değiştirebilirsin.
            </p>

            <div className="grid grid-cols-3 gap-2 mb-6">
              {CEFR_LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setCefrLevel(lvl)}
                  className={`rounded-xl border p-4 transition-colors ${
                    cefrLevel === lvl
                      ? "border-white bg-white text-black"
                      : "border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:border-zinc-700"
                  }`}
                >
                  <div className="text-lg font-bold">{lvl}</div>
                  <div className="text-xs mt-1 opacity-70">
                    {lvl === "A1" ? "Yeni başlayan" :
                     lvl === "A2" ? "Temel" :
                     lvl === "B1" ? "Orta-alt" :
                     lvl === "B2" ? "Orta-üst" :
                     lvl === "C1" ? "İleri" :
                     "Usta"}
                  </div>
                </button>
              ))}
            </div>

            <p className="mb-6 text-xs text-zinc-500">
              Emin değilsen <b>B1</b> ile başla — sonradan ayarlanabilir.
            </p>

            <button
              onClick={handleFinish}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 text-base font-semibold text-black hover:bg-zinc-200 transition-colors"
            >
              Tamamla
              <Check size={18} />
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

function StatsCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
      <div
        className={`h-10 w-10 rounded-lg flex items-center justify-center ${color}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-lg font-bold text-white">{value}</p>
        <p className="text-xs text-zinc-500">{label}</p>
      </div>
    </div>
  );
}

export default function SettingsWindow() {
  const { settings, stats, isLoaded, updateSettings } = useSettings();
  const { history, search, setSearch, deleteEntry, clearAll } = useHistory();
  const { stats: srsStatsFn } = useSRS();
  const srsStats = useMemo(() => srsStatsFn(), [srsStatsFn]);
  const dueToday = srsStats.dueToday;
  const [activeTab, setActiveTab] = useState<Tab>("settings");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [apiKeyInput, setApiKeyInput] = useState(settings.apiKey);
  const [isStarting, setIsStarting] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (isLoaded && !settings.hasCompletedOnboarding && !settings.apiKey) {
      setShowOnboarding(true);
    }
  }, [isLoaded, settings.hasCompletedOnboarding, settings.apiKey]);

  useEffect(() => {
    setApiKeyInput(settings.apiKey);
  }, [settings.apiKey]);

  // Tray menu navigation
  useEffect(() => {
    const unlisten = listen<string>("navigate-tab", (event) => {
      const t = event.payload;
      if (t === "settings" || t === "history" || t === "review") {
        setActiveTab(t);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleOnboardingComplete = async (apiKey: string, vaultPath: string, cefrLevel: CefrLevel) => {
    await updateSettings({
      apiKey,
      vaultPath,
      cefrLevel,
      hasCompletedOnboarding: true,
    });
    setApiKeyInput(apiKey);
    setShowOnboarding(false);
  };

  const handleSelectVault = async () => {
    const selected = await dialogOpen({
      directory: true,
      title: "Bilgi Tabanı Klasörü Seç",
    });
    if (selected) {
      await updateSettings({ vaultPath: selected as string });
    }
  };

  const handleStart = async () => {
    if (!apiKeyInput || apiKeyInput.length < 10) {
      alert("Lütfen geçerli bir API anahtarı girin.");
      return;
    }
    await updateSettings({ apiKey: apiKeyInput });
    setIsStarting(true);
    setTimeout(() => invoke("hide_window", { label: "main" }), 500);
  };

  const filteredHistory =
    historyFilter === "favorites"
      ? history.filter((e) => e.isFavorite)
      : history;

  const favoriteCount = history.filter((e) => e.isFavorite).length;

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white mb-4">
            <span className="text-2xl font-bold text-black">L</span>
          </div>
          <div className="h-1 w-32 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-white animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      </div>
    );
  }

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="flex h-screen bg-black text-white">
      {/* Sidebar */}
      <div className="w-56 border-r border-zinc-800 p-4 flex flex-col">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
            <span className="text-lg font-bold text-black">L</span>
          </div>
          <span className="text-lg font-semibold">LingoSnap</span>
        </div>

        <div className="mb-6 p-3 rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-4 w-4 text-orange-400" />
            <span className="text-sm font-medium">
              {stats.currentStreak} günlük seri
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            Bugün {stats.todayTranslations} çeviri yaptın
          </p>
        </div>

        <nav className="space-y-1 flex-1">
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "settings"
                ? "bg-white text-black"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            <Settings size={18} />
            Ayarlar
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "history"
                ? "bg-white text-black"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            <History size={18} />
            Geçmiş
            {history.length > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-800 px-1.5 text-xs">
                {history.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("review")}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "review"
                ? "bg-white text-black"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            <BookOpen size={18} />
            Tekrar
            {dueToday > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-xs font-bold text-white">
                {dueToday}
              </span>
            )}
          </button>
        </nav>

        <div className="mb-4 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <MousePointer2 size={14} />
            <span>Metin seç, otomatik çevirsin</span>
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={isStarting}
          className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-zinc-200 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isStarting ? "Başlatılıyor..." : "Başlat"}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "review" ? (
          <ReviewTab />
        ) : activeTab === "settings" ? (
          <div className="max-w-lg">
            <h2 className="mb-6 text-xl font-semibold">Ayarlar</h2>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <StatsCard
                icon={Zap}
                label="Toplam Çeviri"
                value={stats.totalTranslations}
                color="bg-blue-500/20 text-blue-400"
              />
              <StatsCard
                icon={Flame}
                label="En Uzun Seri"
                value={`${stats.longestStreak} gün`}
                color="bg-orange-500/20 text-orange-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-8">
              <StatsCard
                icon={BookOpen}
                label="Toplam Kart"
                value={srsStats.totalCards}
                color="bg-purple-500/20 text-purple-400"
              />
              <StatsCard
                icon={GraduationCap}
                label="Mastered"
                value={srsStats.masteredCount}
                color="bg-emerald-500/20 text-emerald-400"
              />
            </div>

            <div className="space-y-6">
              {/* API Key */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-400">
                  API Anahtarı
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Groq API anahtarınızı girin"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-white focus:outline-none"
                />
                <p className="mt-2 text-xs text-zinc-500">
                  Ücretsiz API anahtarı için:{" "}
                  <button
                    onClick={() => shellOpen("https://console.groq.com/")}
                    className="text-white underline hover:text-blue-400"
                  >
                    console.groq.com
                  </button>
                </p>
              </div>

              {/* Vault Path */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-400">
                  Bilgi Tabanı Klasörü
                </label>
                <button
                  onClick={handleSelectVault}
                  className="w-full flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 hover:border-zinc-700 transition-colors text-left"
                >
                  <FolderOpen size={18} className="text-purple-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    {settings.vaultPath ? (
                      <p className="text-sm text-white truncate">{settings.vaultPath}</p>
                    ) : (
                      <p className="text-sm text-zinc-500">Klasör seçilmedi</p>
                    )}
                  </div>
                </button>
                <p className="mt-2 text-xs text-zinc-500">
                  Çeviriler Markdown olarak bu klasöre kaydedilir
                </p>
              </div>

              {/* Sound & TTS Settings */}
              <div>
                <label className="mb-3 block text-sm font-medium text-zinc-400">
                  Ses Ayarları
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => updateSettings({ enableTTS: !settings.enableTTS })}
                    className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {settings.enableTTS ? (
                        <Volume2 size={18} className="text-blue-400" />
                      ) : (
                        <VolumeX size={18} className="text-zinc-500" />
                      )}
                      <span className="text-sm">Sesli Telaffuz (TTS)</span>
                    </div>
                    <div
                      className={`h-5 w-9 rounded-full transition-colors ${
                        settings.enableTTS ? "bg-blue-500" : "bg-zinc-700"
                      }`}
                    >
                      <div
                        className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          settings.enableTTS ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </button>

                  <button
                    onClick={() => updateSettings({ enableSound: !settings.enableSound })}
                    className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {settings.enableSound ? (
                        <Bell size={18} className="text-green-400" />
                      ) : (
                        <BellOff size={18} className="text-zinc-500" />
                      )}
                      <span className="text-sm">Bildirim Sesleri</span>
                    </div>
                    <div
                      className={`h-5 w-9 rounded-full transition-colors ${
                        settings.enableSound ? "bg-green-500" : "bg-zinc-700"
                      }`}
                    >
                      <div
                        className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          settings.enableSound ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </button>
                </div>
              </div>

              {/* CEFR Level */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-400">
                  Hedef Dil Seviyen (CEFR)
                </label>
                <div className="grid grid-cols-6 gap-1.5">
                  {CEFR_LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => updateSettings({ cefrLevel: lvl })}
                      className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                        settings.cefrLevel === lvl
                          ? "border-white bg-white text-black"
                          : "border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Egzersizlerin zorluğu bu seviyeye göre kalibre edilir
                </p>
              </div>

              {/* Daily new word goal */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-400">
                  Günlük yeni kelime hedefi: {settings.dailyNewWordGoal}
                </label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={settings.dailyNewWordGoal}
                  onChange={(e) =>
                    updateSettings({ dailyNewWordGoal: parseInt(e.target.value) })
                  }
                  className="w-full accent-white"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Günde {settings.dailyNewWordGoal} yeni kelime/ifade. 0 = sınır yok.
                </p>
              </div>

              {/* Exercise mix */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-400">
                  Egzersiz Dağılımı
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["balanced", "production_heavy", "recognition_heavy"] as const).map((mix) => (
                    <button
                      key={mix}
                      onClick={() => updateSettings({ exerciseMix: mix })}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                        settings.exerciseMix === mix
                          ? "border-white bg-white text-black"
                          : "border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      {mix === "balanced"
                        ? "Dengeli"
                        : mix === "production_heavy"
                        ? "Üretim ağırlıklı"
                        : "Tanıma ağırlıklı"}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Üretim ağırlıklı: kelime/cümle yazma soruları artar (öğrenme kazanımı daha yüksek)
                </p>
              </div>

              {/* Review batch size */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-400">
                  Tek oturumda maks. tekrar: {settings.reviewBatchSize}
                </label>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={settings.reviewBatchSize}
                  onChange={(e) =>
                    updateSettings({ reviewBatchSize: parseInt(e.target.value) })
                  }
                  className="w-full accent-white"
                />
              </div>

              {/* Theme */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-400">
                  Tema
                </label>
                <div className="flex gap-2">
                  {(["dark", "light"] as const).map((theme) => (
                    <button
                      key={theme}
                      onClick={() => updateSettings({ theme })}
                      className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                        settings.theme === theme
                          ? "border-white bg-white text-black"
                          : "border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      {theme === "dark" ? "Koyu" : "Açık"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Popup Duration */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-400">
                  Popup Süresi: {settings.popupDuration} saniye
                </label>
                <input
                  type="range"
                  min="3"
                  max="30"
                  value={settings.popupDuration}
                  onChange={(e) =>
                    updateSettings({ popupDuration: parseInt(e.target.value) })
                  }
                  className="w-full accent-white"
                />
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Çeviri Geçmişi</h2>
              {history.length > 0 && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:border-red-500/50 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                  Tümünü Sil
                </button>
              )}
            </div>

            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setHistoryFilter("all")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  historyFilter === "all"
                    ? "bg-white text-black"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Tümü ({history.length})
              </button>
              <button
                onClick={() => setHistoryFilter("favorites")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  historyFilter === "favorites"
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Star size={14} />
                Favoriler ({favoriteCount})
              </button>
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Çevirilerde ara..."
              className="mb-4 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-white focus:outline-none"
            />

            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
              {filteredHistory.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mb-3 text-4xl">
                    {historyFilter === "favorites" ? "⭐" : "📝"}
                  </div>
                  <p className="text-zinc-500">
                    {historyFilter === "favorites"
                      ? "Henüz favori çevirin yok"
                      : "Henüz çeviri yapmadın"}
                  </p>
                  <p className="text-xs text-zinc-600 mt-1">
                    {historyFilter === "favorites"
                      ? "Çevirileri yıldızlayarak favorilere ekle"
                      : "Metin seçerek ilk çevirini yap!"}
                  </p>
                </div>
              ) : (
                filteredHistory
                  .filter(
                    (entry) =>
                      entry.originalText.toLowerCase().includes(search.toLowerCase()) ||
                      entry.result.translation.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className={`group rounded-xl border bg-zinc-900/50 p-4 transition-colors ${
                        entry.isFavorite
                          ? "border-yellow-500/30 hover:border-yellow-500/50"
                          : "border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {entry.isFavorite && (
                              <Star
                                size={12}
                                className="text-yellow-400"
                                fill="currentColor"
                              />
                            )}
                            <p className="text-xs text-zinc-500">
                              {new Date(entry.timestamp).toLocaleString("tr-TR")}
                            </p>
                            {entry.result.topic && (
                              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-xs text-zinc-400">
                                {entry.result.topic}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-400 line-clamp-2">
                            {entry.originalText}
                          </p>
                          <p className="mt-1.5 text-sm text-white font-medium">
                            {entry.result.translation}
                          </p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(entry.result.translation);
                            }}
                            className="rounded-lg p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                            title="Kopyala"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            onClick={() => deleteEntry(entry.id)}
                            className="rounded-lg p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                            title="Sil"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-4 right-6 text-xs text-zinc-600">v2.0.0</div>
    </div>
  );
}

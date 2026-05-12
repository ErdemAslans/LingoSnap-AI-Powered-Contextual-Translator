# LingoSnap

**AI-Powered Contextual Translator + Spaced-Repetition Tutor for Windows**

LingoSnap is a lightweight, privacy-focused desktop application that instantly translates any selected text from English to Turkish using AI — and goes far beyond that. Click a word in any translation to add it to your personal **spaced-repetition deck** (FSRS-5 algorithm, Anki-grade). On review, the AI generates **fresh, dynamic exercises** every time — no two questions are ever the same.

![LingoSnap Demo](docs/demo.gif)

## Features

### Translation
- **Auto-Detect Selection** - Select text with the mouse and LingoSnap translates it automatically (no hotkey required)
- **Contextual Translation** - Uses your recent translations as context for consistent terminology (RAG)
- **Markdown Knowledge Base** - Translations are persisted as Markdown files (Obsidian-compatible vault)
- **Text-to-Speech** - Listen to correct pronunciation in both languages

### Spaced-Repetition Tutor (v3.0)
- **Click-to-Learn** - Click any word in a translation; AI looks up definitions (with polysemy + IPA + synonyms) and adds it to your deck
- **Multi-word Phrases** - Shift-drag across words to capture idioms, collocations, phrasal verbs as a single card
- **FSRS-5 Scheduling** - The same algorithm Anki uses; better calibration than SM-2
- **Dynamic AI Exercises** - 8 exercise types: recall, production, cloze, polysemy disambiguation, sentence-use, listen-and-type, synonyms/antonyms, context inference
- **Pedagogical Guardrails** - Production-bias, interleaving, i+1 difficulty (calibrated to your CEFR level), no sycophantic feedback, prompts-over-recasts hint ladder
- **Semantic Answer Evaluation** - AI judge accepts paraphrases and synonyms, not just exact matches
- **CEFR Calibration** - Pick your level (A1–C2); exercise difficulty adapts

### General
- **Translation History & Favorites** - Search, filter, export (JSON/CSV)
- **Statistics & Streaks** - Track your learning progress day-over-day
- **System Tray** - Runs quietly in the background
- **Dark/Light Theme** - Choose your preferred appearance
- **100% Free & Open Source** - No subscriptions, no limits

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Rust](https://rustup.rs/) (latest stable)
- [Groq API Key](https://console.groq.com/) (free)

### Build from Source

```bash
# Clone the repository
git clone https://github.com/ErdemAslans/LingoSnap-AI-Powered-Contextual-Translator.git
cd LingoSnap-AI-Powered-Contextual-Translator

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Download Pre-built Binary

Check the [Releases](https://github.com/ErdemAslans/LingoSnap-AI-Powered-Contextual-Translator/releases) page for Windows installers.

## Setup

1. Launch LingoSnap
2. Get your free API key from [console.groq.com](https://console.groq.com/)
3. Enter your API key during onboarding
4. Pick a folder for your Markdown vault (translations are saved as `.md` files there)
5. Click "Start" — LingoSnap minimizes to the system tray
6. Select any English text with the mouse → translation popup appears automatically

## Usage

| Action | How |
|--------|-----|
| Translate selected text | Just select text with the mouse — auto-detected |
| Add a word to deck | Click the word inside the translation popup |
| Add a phrase to deck | **Drag-select** across words in the translation popup |
| Start a review session | Right-click tray icon > Tekrar Zamanı, or Settings > Tekrar tab |
| Open settings | Left-click tray icon, or right-click tray icon > Ayarlar |
| View history | Right-click tray icon > Çeviri Geçmişi |
| Quit | Right-click tray icon > Çıkış |

**Selection requirements:** drag at least 30 px and hold for ≥ 200 ms. Holding `Shift`/`Ctrl`/`Alt` while releasing the mouse suppresses translation (useful for normal text editing).

## How the Spaced-Repetition Tutor Works

1. **Pick up vocabulary in context.** Translate a sentence as usual. In the popup, click any English word — a dictionary card opens with multiple meanings, the one matching the context, IPA, and a Turkish translation.

2. **Add to your deck.** Click "Deck'e Ekle". The card enters the FSRS-5 scheduler with state = New.

3. **Review when due.** Open the **Tekrar** tab. Cards that have reached their due date appear in a queue (configurable batch size, default 20).

4. **Each review is a fresh AI-generated exercise.** Instead of always asking "what does X mean?", the system picks an exercise type weighted by:
   - Your mix preference (balanced / production-heavy / recognition-heavy)
   - **Interleaving** — types you saw recently on this card are penalized 5×
   - Card-data eligibility — `polysemy_choice` requires ≥2 meanings; `listen_and_type` requires TTS enabled, etc.

5. **The AI evaluates your answer semantically.** Paraphrases and synonyms count as correct. The judge suggests an Anki-style rating (Again / Hard / Good / Easy), but you can override.

6. **Schedule updates.** FSRS-5 recomputes stability, difficulty, and the next due date. Mastered = stability ≥ 30 days.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Zustand
- **Backend**: Tauri 2.0 + Rust
- **AI**: Groq API (`llama-3.3-70b-versatile`)
- **Spaced repetition**: `ts-fsrs` (FSRS-5)
- **Storage**: Tauri Store + Markdown vault (Obsidian-compatible)

## Privacy & Security

LingoSnap takes your privacy seriously:

- **No Data Collection** - Your translations are never sent to our servers
- **Local Storage** - All settings and history stored locally on your device
- **Direct API Calls** - Translations go directly to Groq API
- **Open Source** - Full code transparency, audit it yourself
- **No Telemetry** - Zero tracking or analytics

Your API key is stored locally via the [Tauri Store plugin](https://v2.tauri.app/plugin/store/) under your OS app-data directory as a JSON file (no OS-level encryption — protected by your user account file permissions). It is only transmitted directly to Groq's API for translation requests.

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a PR.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Tauri](https://tauri.app/) - For the amazing desktop framework
- [Groq](https://groq.com/) - For fast AI inference
- [Lucide](https://lucide.dev/) - For beautiful icons

---

Made with love for language learners everywhere.

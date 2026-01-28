# LingoSnap

**AI-Powered Contextual Translator for Windows**

LingoSnap is a lightweight, privacy-focused desktop application that instantly translates any selected text from English to Turkish using AI. Simply select text anywhere on your screen and press `Ctrl+Shift+C` to get an instant translation popup.

![LingoSnap Demo](docs/demo.gif)

## Features

- **Instant Translation** - Select any text and press `Ctrl+Shift+C`
- **Floating Indicator** - Draggable on-screen button for quick access
- **Auto-Translate Clipboard** - Automatically translate copied text
- **Text-to-Speech** - Listen to correct pronunciation
- **Translation History** - Keep track of all your translations
- **Favorites** - Save important translations for later
- **Statistics** - Track your learning progress with streaks
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
git clone https://github.com/yourusername/lingosnap.git
cd lingosnap

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Download Pre-built Binary

Check the [Releases](https://github.com/yourusername/lingosnap/releases) page for Windows installers.

## Setup

1. Launch LingoSnap
2. Get your free API key from [console.groq.com](https://console.groq.com/)
3. Enter your API key in the settings
4. Click "Start" - LingoSnap will minimize to system tray
5. Select any English text and press `Ctrl+Shift+C`

## Usage

| Action | How |
|--------|-----|
| Translate selected text | Select text + `Ctrl+Shift+C` |
| Quick translate | Click floating indicator (copies selected text first) |
| Open settings | Right-click tray icon > Settings |
| View history | Right-click tray icon > History |
| Toggle indicator | Right-click tray icon > Toggle Indicator |

## Privacy & Security

LingoSnap takes your privacy seriously:

- **No Data Collection** - Your translations are never sent to our servers
- **Local Storage** - All settings and history stored locally on your device
- **Direct API Calls** - Translations go directly to Groq API
- **Open Source** - Full code transparency, audit it yourself
- **No Telemetry** - Zero tracking or analytics

Your API key is stored locally using Tauri's secure store plugin and is never transmitted anywhere except directly to Groq's API for translation requests.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Tauri 2.0 + Rust
- **AI**: Groq API (Llama 3.1 8B)
- **State**: Zustand
- **Storage**: Tauri Store Plugin

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

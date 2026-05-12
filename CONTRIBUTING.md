# Contributing to LingoSnap

First off, thank you for considering contributing to LingoSnap! It's people like you that make LingoSnap such a great tool.

## Code of Conduct

By participating in this project, you are expected to uphold our values of respect, inclusivity, and constructive collaboration.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.

**When reporting a bug, include:**
- Your operating system and version
- LingoSnap version
- Steps to reproduce the behavior
- Expected vs actual behavior
- Screenshots if applicable
- Any error messages from the console

### Suggesting Features

Feature requests are welcome! Please provide:
- Clear description of the feature
- Use case / why it would be useful
- Possible implementation approach (optional)

### Pull Requests

1. Fork the repo and create your branch from the default branch
2. Make your changes
3. Ensure the code builds without errors
4. Test your changes thoroughly
5. Update documentation if needed
6. Submit a pull request

## Development Setup

### Prerequisites

- Node.js 18+
- Rust (latest stable)
- A code editor (VS Code recommended)

### Getting Started

```bash
# Clone your fork
git clone https://github.com/<your-username>/LingoSnap-AI-Powered-Contextual-Translator.git
cd LingoSnap-AI-Powered-Contextual-Translator

# Install dependencies
npm install

# Start development server
npm run tauri dev
```

### Project Structure

```
LingoSnap-AI-Powered-Contextual-Translator/
├── src/                    # React frontend
│   ├── components/         # UI components (TranslationPopup, SettingsWindow, HistoryWindow)
│   ├── hooks/              # Custom React hooks (useTranslation, useSettings, useHistory)
│   ├── services/           # API/utility services (groq, storage, tts, vault)
│   ├── stores/             # Zustand state management
│   ├── types/              # TypeScript types
│   └── utils/              # Helpers (id generation, export)
└── src-tauri/              # Rust backend
    ├── src/
    │   ├── lib.rs          # Tauri builder, plugin registration
    │   ├── main.rs         # Entry point
    │   ├── commands.rs     # Tauri commands (IPC)
    │   ├── clipboard.rs    # Clipboard handling
    │   ├── mouse_hook.rs   # Windows low-level mouse hook (auto-selection)
    │   ├── tray.rs         # System tray
    │   └── window.rs       # Popup positioning
    ├── capabilities/       # Tauri ACL permissions
    └── tauri.conf.json     # Tauri configuration
```

### Code Style

**TypeScript/React:**
- Use functional components with hooks
- Prefer `const` over `let`
- Use TypeScript types/interfaces
- Follow existing naming conventions

**Rust:**
- Follow Rust standard conventions
- Use `rustfmt` for formatting
- Handle errors properly with `Result`

### Commit Messages

Use clear, descriptive commit messages:
- `feat: add new feature`
- `fix: resolve bug in translation`
- `docs: update README`
- `refactor: improve code structure`
- `style: format code`
- `test: add unit tests`

## Security

- NEVER commit API keys or secrets
- Review code for potential security issues
- Report security vulnerabilities privately (see SECURITY.md)

## Questions?

Feel free to open an issue for any questions about contributing.

Thank you for helping make LingoSnap better!

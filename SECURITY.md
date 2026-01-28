# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability within LingoSnap, please report it responsibly.

### How to Report

1. **DO NOT** open a public GitHub issue for security vulnerabilities
2. Email your findings to [your-email@example.com] (replace with your actual email)
3. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Response Time**: We aim to respond within 48 hours
- **Investigation**: We will investigate and validate the report
- **Fix Timeline**: Critical vulnerabilities will be addressed within 7 days
- **Credit**: We will credit you in the release notes (unless you prefer anonymity)

## Security Best Practices for Users

### API Key Safety

- **Never share** your Groq API key publicly
- **Never commit** your API key to version control
- If you accidentally expose your key, **regenerate it immediately** at [console.groq.com](https://console.groq.com/)

### Application Security

- Only download LingoSnap from official sources:
  - This GitHub repository
  - Official releases page
- Verify the checksum of downloaded binaries (when available)
- Keep LingoSnap updated to the latest version

## Data Handling

LingoSnap handles the following data locally:

| Data | Storage Location | Encryption |
|------|------------------|------------|
| API Key | Tauri Store (AppData) | OS-level |
| Translation History | Tauri Store (AppData) | No |
| Settings | Tauri Store (AppData) | No |

### What We DON'T Do

- We don't collect any user data
- We don't have servers that store your information
- We don't track usage or analytics
- We don't share data with third parties

### External Connections

LingoSnap only connects to:
- `api.groq.com` - For AI translation requests

## Security Features

- **No Remote Code Execution**: The app doesn't execute remote code
- **Sandboxed Renderer**: Tauri's secure webview sandbox
- **Minimal Permissions**: Only requests necessary system permissions
- **No Network Storage**: All data stays on your device

## Known Limitations

- Clipboard monitoring (when enabled) reads clipboard contents locally
- Global hotkey requires system-level keyboard hook
- Translations are sent to Groq API (third-party service)

## Audit

This codebase is open source and can be audited by anyone. We welcome security researchers to review our code and report any findings.

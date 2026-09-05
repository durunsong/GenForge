# GenForge

**Language / 语言:** [中文](README.md) | [English](README.en.md)

An AI image generation desktop app powered by Gemini / GPT Image (TypeScript + Electron).

Supports **Windows / macOS / Linux**, concurrent generation, 2K/4K rendering, and local chat & image storage.

Author and maintainer: [durunsong](https://github.com/durunsong).

[![Release](https://img.shields.io/github/v/release/durunsong/GenForge?label=Release)](https://github.com/durunsong/GenForge/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)](https://github.com/durunsong/GenForge/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](LICENSE)

---

## Contents

- [Features](#features)
- [Download & Install](#download--install)
- [Quick Start (Development)](#quick-start-development)
- [Usage](#usage)
- [API Configuration](#api-configuration)
- [Auto Update](#auto-update)
- [Releasing](#releasing)
- [Project Structure](#project-structure)
- [Scripts](#scripts)
- [FAQ](#faq)
- [License](#license)

---

## Features

| Capability | Description |
|------------|-------------|
| Multi-model generation | Gemini image models, GPT Image, via OpenAI-compatible or native Gemini APIs |
| Multi-provider management | Configure multiple API providers with random preferred rotation |
| Resolution & aspect ratio | 1K / 2K / 4K; Auto, 21:9, 16:9, 1:1, 9:16, and more |
| Reference images | Upload references for image-to-image / edits |
| Conversation context | Optionally keep the last N turns for continuous creation |
| Auto-save locally | Save generated images to a chosen local folder |
| Dark mode | Toggle theme in Settings |
| Auto update | Supported on Windows installer, macOS, and Linux AppImage |

### Creation tools

| Tool | Description |
|------|-------------|
| **XHS Inspiration Lab** | Xiaohongshu-style copy & image inspiration |
| **Prompt Quicker** | Browse, search, and copy quality prompts |
| **My Prompts** | Personal prompt library with one-click fill |
| **Sticker Maker** | Quick sticker generation mode |
| **Image Slicer** | 3×3 grid slicing tool |

---

## Download & Install

1. Open [Releases](https://github.com/durunsong/GenForge/releases)
2. Download the package for your OS:

| OS | Recommended | Notes |
|----|--------------|-------|
| Windows | `GeminiImageStudio-*-win-x64.exe` | NSIS installer, auto-update enabled |
| Windows | `GeminiImageStudio-*-portable.exe` | Portable; manual updates |
| macOS | `GeminiImageStudio-*-mac-universal.dmg` | Intel + Apple Silicon |
| Linux | `GeminiImageStudio-*-linux-x64.AppImage` | Recommended, auto-update |
| Linux | `GeminiImageStudio-*-linux-x64.deb` | Debian / Ubuntu |

3. Install and launch

### First launch on macOS

Builds are unsigned / not notarized by default. If macOS blocks the app:

1. Right-click the App → **Open**
2. Or run:

```bash
xattr -cr /Applications/Gemini绘图工作台.app
```

### Linux AppImage

```bash
chmod +x GeminiImageStudio-*-linux-x64.AppImage
./GeminiImageStudio-*-linux-x64.AppImage
```

---

## Quick Start (Development)

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Build without launching:

```bash
npm run build
npm start
```

---

## Usage

1. Open the app → **Settings → API Providers**
2. Add a provider: name, API type, Base URL, API Key, model
3. Describe the image in the main input; optionally upload references
4. Pick resolution and aspect ratio in Settings, then send
5. Use the left sidebar for sessions and creation tools

Copy prompts from **Prompt Quicker**, or save them to **My Prompts** for one-click fill.

---

## API Configuration

Settings → **API Providers**:

| API type | When to use |
|----------|-------------|
| Native Gemini | Direct Gemini endpoints |
| OpenAI-compatible · Chat Completions | Most Gemini image proxies / legacy flow |
| OpenAI-compatible · Images API | `gpt-image-*`, via `/v1/images/generations` / `edits` |

### Notes

- **Base URL** should be the host root **without** `/v1` (e.g. `https://api.example.com`)
- Preset models: `gpt-image-2`, `gpt-image-1.5`, `gemini-2.5-flash-image`, `gemini-3-pro-image-preview` (custom names allowed)
- With **Images API**: no reference → `/v1/images/generations`; with reference → `/v1/images/edits`
- Add multiple providers and use “Random preferred” for rotation

API keys are stored locally only; they are not uploaded to this project’s servers.

---

## Auto Update

| Package | Auto update |
|---------|-------------|
| Windows NSIS installer | ✅ |
| Windows portable | ❌ Use the installer or download from Releases |
| macOS (dmg + zip) | ✅ |
| Linux AppImage | ✅ |
| Linux deb | Prefer manual upgrade |

Use **Check for updates** in Settings. When a new version is found, confirm to download and restart.

---

## Releasing

### Recommended: tag → CI builds all platforms

1. Bump `version` in `package.json` (e.g. `1.0.0` → `1.0.1`)
2. Commit and tag:

```bash
git add .
git commit -m "release: v1.0.1"
git tag v1.0.1
git push origin main
git push origin v1.0.1
```

3. GitHub Actions builds on **Windows / macOS / Linux** and publishes one Release
4. Users on older installs get an update prompt → download → restart

### Local package (no publish)

```bash
npm run dist          # current OS
npm run dist:win      # Windows only (on Windows / CI)
npm run dist:mac      # macOS only (on macOS)
npm run dist:linux    # Linux only (on Linux)
```

### Local publish to GitHub Releases

```bash
npm run release
# or
npm run release:win
npm run release:mac
npm run release:linux
```

Requires `gh` login or `GH_TOKEN`. For full cross-platform releases, prefer tag + Actions.

---

## Project Structure

```
src/main/           Electron main process & auto-updater
src/renderer/       UI and app logic
scripts/            Build & icon generation
build/              Icons and packaging assets
.github/workflows/  Multi-platform release workflow
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Build and launch for development |
| `npm run build` | Compile main/renderer and generate icons |
| `npm start` | Launch the built app |
| `npm run dist` | Package for current OS (no publish) |
| `npm run dist:win` / `dist:mac` / `dist:linux` | Package for a specific OS |
| `npm run dist:portable` | Windows portable only |
| `npm run release` | Package and publish to GitHub Releases |

---

## FAQ

**Q: Generation fails / 401?**  
Check API Key, Base URL, and that the model matches the provider. Do not append `/v1` to the Base URL.

**Q: macOS says the app can’t be opened?**  
See [First launch on macOS](#first-launch-on-macos).

**Q: No update prompt on portable builds?**  
Portable builds do not auto-update. Download from [Releases](https://github.com/durunsong/GenForge/releases).

**Q: Can’t pick an auto-save folder?**  
This relies on the File System Access API; use a recent Chromium-based environment. The desktop app settings should work for selecting a save directory.

---

## License

[Apache-2.0](LICENSE)

---

**Language / 语言:** [中文](README.md) | [English](README.en.md)

# Coursework

Self-contained desktop app for self-paced coursework. Import MIT OCW downloads, watch lectures in-app, take real-time timestamped notes.

Fully contained: Tauri shell + Rust backend + SQLite + bundled frontend. No server process, no Docker, no Postgres.

## Stack

- **Shell:** Tauri 2 (system webview)
- **Backend:** Rust + `rusqlite` (bundled SQLite)
- **Frontend:** Vite + React 19 + Tailwind 3 + react-router
- **Storage:** single `db.sqlite` file in OS user-data dir
- **Notes:** markdown files on disk (Obsidian-compatible `[[wikilinks]]`) + structured timestamped note rows

## Develop

```bash
bun install
bun run tauri:dev      # launches Tauri dev window with HMR on Vite
```

## Build

```bash
bun run tauri:build                 # full bundle (.app + .dmg if GUI session)
bunx tauri build --bundles app      # headless-safe .app only
```

## Install (end users)

### Homebrew (recommended)

```bash
brew install --cask aspectrr/tap/coursework
xattr -dr com.apple.quarantine /Applications/Coursework.app
```

The `xattr` line is required because the app is unsigned — see
[aspectrr/homebrew-tap](https://github.com/aspectrr/homebrew-tap).

### Direct download

Prebuilt bundles from the GitHub Releases page:

- **Latest from `main`:** https://github.com/aspectrr/coursework-structure/releases/tag/latest
- **Versioned:** any `v*` tag, e.g. https://github.com/aspectrr/coursework-structure/releases/tag/v0.1.0

Releases are produced automatically by `.github/workflows/release.yml` on every
push to `main` (rolling `latest` release) and on `v*` tag pushes (versioned
releases). PRs build via `.github/workflows/build.yml` and attach artifacts to
the workflow run (downloadable from the Actions tab).

**macOS Apple Silicon:** `*.aarch64.dmg` — drag to Applications, then clear the
quarantine flag once: `xattr -dr com.apple.quarantine /Applications/Coursework.app`

The app is not code-signed or notarized. macOS blocks quarantined unsigned apps
with a "damaged" error — right-click → Open no longer bypasses this on recent
macOS versions. Permanent fix when distributing publicly: Developer ID
signing + notarization (Apple Developer Program).


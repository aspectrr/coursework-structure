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

Easiest path: download a prebuilt bundle from the GitHub Releases page.

- **Latest from `main`:** https://github.com/aspectrr/coursework-structure/releases/tag/latest
- **Versioned:** any `v*` tag, e.g. https://github.com/aspectrr/coursework-structure/releases/tag/v0.1.0

Releases are produced automatically by `.github/workflows/release.yml` on every
push to `main` (rolling `latest` release) and on `v*` tag pushes (versioned
releases). PRs build via `.github/workflows/build.yml` and attach artifacts to
the workflow run (downloadable from the Actions tab).

Platform downloads:

- **macOS Apple Silicon:** `*.aarch64.dmg` — drag to Applications. First launch: right-click → Open (app is unsigned).

The app is not code-signed or notarized — macOS will warn on first launch.
Right-click → Open to bypass. Add a signing cert later when distributing publicly.
Linux/Windows builds aren't currently produced by CI; add them back to the
workflow matrix when needed.

## Data location

- **Database:** `~/Library/Application Support/com.coursework.desktop/coursework/db.sqlite` (macOS)
- **Notes (markdown):** `~/Library/Application Support/com.coursework.desktop/coursework/notes/`
- **Courses folder:** picked at first launch via folder dialog; persisted in `settings` table

## Usage

1. Launch app
2. Admin → Choose folder → point at your MIT OCW downloads root
3. Admin → Import / re-sync
4. Today page shows today's plan; click any item to open the lecture player
5. In the player: watch the YouTube video, type notes — each note captures the current video timestamp; click a timestamp to seek back

## Regenerate placeholder icons

Real icons live in `src-tauri/icons/`. To regenerate solid-color placeholders:

```bash
bun run icons    # python3 scripts/make-icons.py
```

Replace `src-tauri/icons/app-icon.png` with a real 1024×1024 design, then re-run the script to derive all sizes + `.icns` + `.ico`.

## Architecture

```
src-tauri/
  src/
    lib.rs             # entry: Tauri builder + command registration
    commands.rs        # all #[tauri::command] handlers
    plan.rs            # daily-plan algorithm, streak, mark-item
    importer.rs        # MIT OCW data.json parser
    import_runner.rs   # DB inserts (idempotent on slug)
    db.rs              # rusqlite connection + migrations runner
    models.rs          # serde types matching the SQLite schema
    paths.rs           # user-data dir resolution
    error.rs           # unified error type
  migrations/001_init.sql

src/
  main.tsx, App.tsx    # Vite + React entry, hash router
  pages/               # Today, Calendar, Admin, CourseDetail, ItemPlayer
  components/          # VideoPlayer (YT IFrame API), NoteStream, NoteEditor
  lib/api.ts           # typed wrappers around Tauri `invoke`
```

Every backend operation is a `#[tauri::command]`. The frontend calls them via `@tauri-apps/api/core`'s `invoke`. No HTTP, no Next.js, no server.

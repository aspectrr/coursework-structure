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
bun run tauri:build    # produces src-tauri/target/release/bundle/macos/Coursework.app
                       # (.dmg requires running on a Mac with GUI session — uses Finder AppleScript)
```

To build just the `.app` (works in headless):

```bash
bunx tauri build --bundles app
```

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

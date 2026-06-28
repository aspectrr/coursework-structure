use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Root of all per-user app data: <app_data_dir>/coursework
pub fn app_data_dir(app: &AppHandle) -> PathBuf {
    let base = app.path().app_data_dir()
        .expect("app_data_dir resolvable");
    let dir = base.join("coursework");
    std::fs::create_dir_all(&dir).ok();
    dir
}

pub fn db_path(app: &AppHandle) -> PathBuf {
    app_data_dir(app).join("db.sqlite")
}

/// Where Obsidian-compatible markdown notes live.
pub fn notes_dir(app: &AppHandle) -> PathBuf {
    let dir = app_data_dir(app).join("notes");
    std::fs::create_dir_all(&dir).ok();
    dir
}

/// Courses dir is configurable — stored in settings table as 'courses_dir'.
/// Falls back to a sensible default inside app data if unset.
pub fn default_courses_dir(app: &AppHandle) -> PathBuf {
    app_data_dir(app).join("courses")
}

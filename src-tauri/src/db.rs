use std::sync::Mutex;
use rusqlite::Connection;
use tauri::AppHandle;

use crate::paths::db_path;

pub struct Db(pub Mutex<Connection>);

impl Db {
    pub fn get(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.0.lock().unwrap()
    }
}

pub fn init(app: &AppHandle) -> rusqlite::Result<Db> {
    let path = db_path(app);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;
         PRAGMA synchronous = NORMAL;",
    )?;
    migrate(&conn)?;
    Ok(Db(Mutex::new(conn)))
}

fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS __migrations (
            id    INTEGER PRIMARY KEY,
            name  TEXT NOT NULL UNIQUE,
            applied_at TEXT NOT NULL
        );",
    )?;
    let already: Vec<String> = {
        let mut stmt = conn.prepare("SELECT name FROM __migrations ORDER BY name")?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
        rows.filter_map(std::result::Result::ok).collect()
    };
    let migrations: &[(&str, &str)] = &[
        ("001_init", include_str!("../migrations/001_init.sql")),
    ];
    for (name, sql) in migrations {
        if already.iter().any(|a| a == name) { continue; }
        let now = now_iso();
        conn.execute_batch(sql)?;
        conn.execute(
            "INSERT INTO __migrations (name, applied_at) VALUES (?, ?)",
            rusqlite::params![name, now],
        )?;
    }
    Ok(())
}

pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

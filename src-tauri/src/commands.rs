use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{Manager, State};

use crate::db::Db;
use crate::error::{CmdResult, Result};
use crate::importer::{find_course_dirs, import_all};
use crate::models::{Course, Item, Session, VideoNote, slugify, parse_json_array};
use crate::plan::{build_daily_plan, get_streak, mark_item, row_to_item, DailyPlan};
use crate::paths::{notes_dir, default_courses_dir};

// ---------- composite view payloads ----------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TodayView {
    pub plan: DailyPlan,
    pub streak: i64,
    pub progress: Vec<CourseProgress>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseProgress {
    pub course: CourseSummary,
    pub total: i64,
    pub done: i64,
    pub minutes_total: i64,
    pub minutes_done: i64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CourseSummary {
    pub id: String,
    pub slug: String,
    pub title: String,
    pub course_number: Option<String>,
    pub image_url: Option<String>,
    pub status: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseDetail {
    pub course: Course,
    pub sessions: Vec<Session>,
    pub items: Vec<Item>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarView {
    pub days: Vec<DayCell>,           // 56 entries aligned to Sunday
    pub recent: Vec<DayLogSummary>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DayCell {
    pub date: String,
    pub minutes: i64,
    pub items: i64,
    pub future: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DayLogSummary {
    pub date: String,
    pub minutes: i64,
    pub items: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteNote {
    pub course_slug: String,
    pub kind: String,       // 'course' | 'lecture' | 'assignment'
    pub order: Option<i64>,
    pub title_slug: String,
    pub content: String,
}

// ---------- helpers ----------

fn courses_root(app: &tauri::AppHandle) -> Result<PathBuf> {
    let db = app.state::<Db>();
    let conn = db.get();
    let cur: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key='courses_dir'",
            [],
            |r| r.get(0),
        )
        .ok();
    let p = match cur {
        Some(s) if !s.is_empty() => PathBuf::from(s),
        _ => default_courses_dir(app),
    };
    Ok(p)
}

// ---------- commands ----------

#[tauri::command]
pub fn today_get(app: tauri::AppHandle, state: State<'_, Db>) -> CmdResult<TodayView> {
    let conn = state.get();
    let plan = build_daily_plan(&conn, None).map_err(|e| e.to_string())?;
    let streak = get_streak(&conn).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, slug, title, course_number, image_url, status
         FROM courses WHERE status='active'
         ORDER BY order_index ASC, title ASC"
    ).map_err(|e| e.to_string())?;
    let summaries: Vec<CourseSummary> = stmt.query_map([], |r| Ok(CourseSummary {
        id: r.get(0)?, slug: r.get(1)?, title: r.get(2)?,
        course_number: r.get(3)?, image_url: r.get(4)?, status: r.get(5)?,
    })).map_err(|e| e.to_string())?.flatten().collect();

    let mut progress = Vec::new();
    for c in &summaries {
        let row: Option<(i64, i64, i64, i64)> = conn.query_row(
            "SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS done,
                COALESCE(SUM(estimated_minutes), 0) AS mt,
                COALESCE(SUM(CASE WHEN status='completed' THEN estimated_minutes ELSE 0 END), 0) AS md
             FROM items WHERE course_id = ?1",
            params![c.id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        ).ok();
        let (total, done, mt, md) = row.unwrap_or((0,0,0,0));
        progress.push(CourseProgress {
            course: c.clone(),
            total, done, minutes_total: mt, minutes_done: md,
        });
    }
    let _ = app; // unused but kept for symmetry
    Ok(TodayView { plan, streak, progress })
}

#[tauri::command]
pub fn calendar_get(state: State<'_, Db>) -> CmdResult<CalendarView> {
    let conn = state.get();
    let today = chrono::Utc::now();
    let mut start = today - chrono::Duration::days(55);
    while start.format("%w").to_string().parse::<u32>().unwrap_or(0) != 0 {
        start = start - chrono::Duration::days(1);
    }
    let start_iso = start.format("%Y-%m-%d").to_string();

    // Aggregate per date
    let mut by_date: std::collections::HashMap<String, (i64, i64)> = std::collections::HashMap::new();
    let mut stmt = conn.prepare(
        "SELECT date, COALESCE(SUM(minutes_logged),0), COALESCE(SUM(items_completed),0)
         FROM day_logs WHERE date >= ?1 GROUP BY date ORDER BY date DESC"
    ).map_err(|e| e.to_string())?;
    let rows: Vec<(String, i64, i64)> = stmt.query_map([start_iso.as_str()], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?, r.get::<_, i64>(2)?))
    }).map_err(|e| e.to_string())?.flatten().collect();
    let recent: Vec<DayLogSummary> = rows.iter().take(20)
        .map(|(d, m, i)| DayLogSummary { date: d.clone(), minutes: *m, items: *i }).collect();
    for (d, m, i) in &rows { by_date.insert(d.clone(), (*m, *i)); }

    let mut days = Vec::with_capacity(56);
    for i in 0..56 {
        let d = start + chrono::Duration::days(i);
        let iso = d.format("%Y-%m-%d").to_string();
        let (m, it) = by_date.remove(&iso).unwrap_or((0, 0));
        days.push(DayCell {
            date: iso,
            minutes: m,
            items: it,
            future: d > today,
        });
    }
    Ok(CalendarView { days, recent })
}

#[tauri::command]
pub fn admin_list_courses(state: State<'_, Db>) -> CmdResult<Vec<Course>> {
    let conn = state.get();
    let mut stmt = conn.prepare(
        "SELECT id, slug, title, description, course_number, extra_course_numbers,
                term, year, level, department_numbers, instructors, topics, image_url,
                source_path, source_uid, status, daily_budget_minutes, order_index,
                imported_at, updated_at
         FROM courses ORDER BY title ASC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| {
        let dn: Option<String> = r.get(9)?;
        let ins: Option<String> = r.get(10)?;
        let top: Option<String> = r.get(11)?;
        Ok(Course {
            id: r.get(0)?, slug: r.get(1)?, title: r.get(2)?, description: r.get(3)?,
            course_number: r.get(4)?, extra_course_numbers: r.get(5)?, term: r.get(6)?,
            year: r.get(7)?, level: r.get(8)?,
            department_numbers: parse_json_array(&dn),
            instructors: parse_json_array(&ins),
            topics: parse_json_array(&top),
            image_url: r.get(12)?, source_path: r.get(13)?, source_uid: r.get(14)?,
            status: r.get(15)?, daily_budget_minutes: r.get(16)?, order_index: r.get(17)?,
            imported_at: r.get(18)?, updated_at: r.get(19)?,
        })
    }).map_err(|e| e.to_string())?;
    Ok(rows.flatten().collect())
}

#[tauri::command]
pub fn admin_import(app: tauri::AppHandle, state: State<'_, Db>) -> CmdResult<serde_json::Value> {
    let root = courses_root(&app).map_err(|e| e.to_string())?;
    let conn = state.get();
    let results = import_all(&conn, &root).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "ok": true, "results": results }))
}

#[tauri::command]
pub fn mark_item_complete(state: State<'_, Db>, item_id: String, status: Option<String>) -> CmdResult<()> {
    let conn = state.get();
    let st = status.unwrap_or_else(|| "completed".to_string());
    mark_item(&conn, &item_id, &st).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn course_detail(state: State<'_, Db>, slug: String) -> CmdResult<CourseDetail> {
    let conn = state.get();
    let course: Course = {
        let mut stmt = conn.prepare(
            "SELECT id, slug, title, description, course_number, extra_course_numbers,
                    term, year, level, department_numbers, instructors, topics, image_url,
                    source_path, source_uid, status, daily_budget_minutes, order_index,
                    imported_at, updated_at
             FROM courses WHERE slug = ?1"
        ).map_err(|e| e.to_string())?;
        let mut rows = stmt.query_map([slug], |r| {
            let dn: Option<String> = r.get(9)?;
            let ins: Option<String> = r.get(10)?;
            let top: Option<String> = r.get(11)?;
            Ok(Course {
                id: r.get(0)?, slug: r.get(1)?, title: r.get(2)?, description: r.get(3)?,
                course_number: r.get(4)?, extra_course_numbers: r.get(5)?, term: r.get(6)?,
                year: r.get(7)?, level: r.get(8)?,
                department_numbers: parse_json_array(&dn),
                instructors: parse_json_array(&ins),
                topics: parse_json_array(&top),
                image_url: r.get(12)?, source_path: r.get(13)?, source_uid: r.get(14)?,
                status: r.get(15)?, daily_budget_minutes: r.get(16)?, order_index: r.get(17)?,
                imported_at: r.get(18)?, updated_at: r.get(19)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.next().ok_or("course not found").map_err(|e| e.to_string())?.map_err(|e: rusqlite::Error| e.to_string())
    }?;

    let sessions: Vec<Session> = {
        let mut stmt = conn.prepare(
            "SELECT id, course_id, order_index, session_number, title, notes
             FROM sessions WHERE course_id=?1 ORDER BY order_index ASC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![course.id], |r| Ok(Session {
            id: r.get(0)?, course_id: r.get(1)?, order_index: r.get(2)?,
            session_number: r.get(3)?, title: r.get(4)?, notes: r.get(5)?,
        })).map_err(|e| e.to_string())?;
        rows.flatten().collect()
    };

    let items: Vec<Item> = {
        let mut stmt = conn.prepare(
            "SELECT id, course_id, session_id, type, order_index, title, description,
                    estimated_minutes, status, due_session_id, due_at, youtube_key, archive_url,
                    thumbnail_url, pdf_path, transcript_path, external_url, source_key, resource_type,
                    learning_resource_types, started_at, completed_at, created_at, updated_at
             FROM items WHERE course_id=?1 ORDER BY order_index ASC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![course.id], row_to_item).map_err(|e| e.to_string())?;
        rows.flatten().collect()
    };

    Ok(CourseDetail { course, sessions, items })
}

#[tauri::command]
pub fn item_detail(state: State<'_, Db>, id: String) -> CmdResult<Item> {
    let conn = state.get();
    let mut stmt = conn.prepare(
        "SELECT id, course_id, session_id, type, order_index, title, description,
                estimated_minutes, status, due_session_id, due_at, youtube_key, archive_url,
                thumbnail_url, pdf_path, transcript_path, external_url, source_key, resource_type,
                learning_resource_types, started_at, completed_at, created_at, updated_at
         FROM items WHERE id = ?1"
    ).map_err(|e| e.to_string())?;
    let mut rows = stmt.query_map(params![id], row_to_item).map_err(|e| e.to_string())?;
    rows.next().ok_or_else(|| "item not found".to_string()).map_err(|e| e)?.map_err(|e: rusqlite::Error| e.to_string())
}

// ---------- markdown file notes ----------

#[tauri::command]
pub fn notes_read(app: tauri::AppHandle, payload: WriteNote) -> CmdResult<Option<String>> {
    let rel = note_rel_path(&payload);
    let abs = notes_dir(&app).join(&rel);
    Ok(std::fs::read_to_string(abs).ok())
}

#[tauri::command]
pub fn notes_write(app: tauri::AppHandle, payload: WriteNote) -> CmdResult<String> {
    let rel = note_rel_path(&payload);
    let abs = notes_dir(&app).join(&rel);
    if let Some(parent) = abs.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&abs, &payload.content).map_err(|e| e.to_string())?;
    Ok(rel)
}

fn note_rel_path(p: &WriteNote) -> String {
    let slug_title = slugify(&p.title_slug);
    if p.kind == "course" {
        return format!("{}/{}.md", p.course_slug, p.course_slug);
    }
    let prefix = if p.kind == "lecture" { "lec" } else { "hw" };
    match p.order {
        Some(n) => format!("{}/{}-{:02}-{}.md", p.course_slug, prefix, n, slug_title),
        None => format!("{}/{}-{}.md", p.course_slug, prefix, slug_title),
    }
}

// ---------- video notes (timestamped) ----------

#[tauri::command]
pub fn video_notes_list(state: State<'_, Db>, item_id: String) -> CmdResult<Vec<VideoNote>> {
    let conn = state.get();
    let mut stmt = conn.prepare(
        "SELECT id, item_id, content, video_time_seconds, created_at, updated_at
         FROM video_notes WHERE item_id = ?1
         ORDER BY (video_time_seconds IS NULL) ASC, video_time_seconds ASC, created_at ASC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![item_id], |r| Ok(VideoNote {
        id: r.get(0)?, item_id: r.get(1)?, content: r.get(2)?,
        video_time_seconds: r.get(3)?, created_at: r.get(4)?, updated_at: r.get(5)?,
    })).map_err(|e| e.to_string())?;
    Ok(rows.flatten().collect())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVideoNote {
    pub item_id: String,
    pub content: String,
    pub video_time_seconds: Option<i64>,
}

#[tauri::command]
pub fn video_notes_create(state: State<'_, Db>, payload: CreateVideoNote) -> CmdResult<VideoNote> {
    let conn = state.get();
    let id = uuid::Uuid::new_v4().to_string();
    let now = crate::db::now_iso();
    conn.execute(
        "INSERT INTO video_notes (id, item_id, content, video_time_seconds, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?5)",
        params![id, payload.item_id, payload.content, payload.video_time_seconds, now],
    ).map_err(|e| e.to_string())?;
    Ok(VideoNote {
        id, item_id: payload.item_id, content: payload.content,
        video_time_seconds: payload.video_time_seconds,
        created_at: now.clone(), updated_at: now,
    })
}

#[tauri::command]
pub fn video_notes_update(state: State<'_, Db>, id: String, content: String) -> CmdResult<()> {
    let conn = state.get();
    let now = crate::db::now_iso();
    conn.execute(
        "UPDATE video_notes SET content=?1, updated_at=?2 WHERE id=?3",
        params![content, now, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn video_notes_delete(state: State<'_, Db>, id: String) -> CmdResult<()> {
    let conn = state.get();
    conn.execute("DELETE FROM video_notes WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ---------- settings ----------

#[tauri::command]
pub fn get_courses_dir(app: tauri::AppHandle, state: State<'_, Db>) -> CmdResult<String> {
    let conn = state.get();
    let cur: Option<String> = conn.query_row(
        "SELECT value FROM settings WHERE key='courses_dir'",
        [], |r| r.get::<_, String>(0),
    ).ok();
    Ok(cur.unwrap_or_else(|| default_courses_dir(&app).to_string_lossy().into_owned()))
}

#[tauri::command]
pub async fn pick_courses_dir(app: tauri::AppHandle, state: State<'_, Db>) -> CmdResult<Option<String>> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file().set_title("Pick courses folder").pick_folder(move |chosen| {
        let _ = tx.send(chosen);
    });
    let chosen = rx.recv().map_err(|e| e.to_string())?;
    let Some(path) = chosen else { return Ok(None) };
    let path_str = path.to_string();
    let now = crate::db::now_iso();
    {
        let conn = state.get();
        conn.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES ('courses_dir', ?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
            params![path_str, now],
        ).map_err(|e| e.to_string())?;
    }
    Ok(Some(path_str))
}

#[tauri::command]
pub fn preview_import(app: tauri::AppHandle, state: State<'_, Db>) -> CmdResult<Vec<String>> {
    let _ = state;
    let root = courses_root(&app).map_err(|e| e.to_string())?;
    let dirs = find_course_dirs(&root);
    Ok(dirs.into_iter().map(|d| d.to_string_lossy().into_owned()).collect())
}

#[tauri::command]
pub fn convert_local_path_to_url(path: String, app: tauri::AppHandle) -> CmdResult<String> {
    
    let _ = app;
    // ponytail: webview uses tauri://localhost on mac, asset protocol elsewhere.
    // Frontend should use convertFileSrc; this server-side variant is a convenience for back-compat.
    let _ = app;
    // ponytail: webview uses tauri://localhost on mac, asset protocol elsewhere.
    // Frontend should use convertFileSrc; this server-side variant is a convenience for back-compat.
    let p = std::path::Path::new(&path);
    let abs = if p.is_absolute() { p.to_path_buf() } else { std::env::current_dir().ok().map(|c| c.join(p)).unwrap_or_default() };
    Ok(format!("convertfilesrc:{}", abs.display()))
}

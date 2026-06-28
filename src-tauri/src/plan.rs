use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::db::now_iso;
use crate::error::{Error, Result};
use crate::models::{Course, Item};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanLine {
    pub item_id: String,
    pub course_slug: String,
    pub course_title: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub title: String,
    pub estimated_minutes: i64,
    pub session_number: Option<String>,
    pub youtube_key: Option<String>,
    pub pdf_path: Option<String>,
    pub is_continue: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyPlan {
    pub date: String,
    pub budget_minutes: i64,
    pub scheduled_minutes: i64,
    pub remaining_minutes: i64,
    pub lines: Vec<PlanLine>,
    pub overdue_count: i64,
}

pub fn default_budget() -> i64 { 60 }

pub fn build_daily_plan(conn: &Connection, budget_minutes: Option<i64>) -> Result<DailyPlan> {
    let budget = budget_minutes.unwrap_or_else(default_budget);
    let now = chrono::Utc::now();
    let date = now.format("%Y-%m-%d").to_string();
    let now_iso = now.to_rfc3339();

    // Active courses
    let courses = active_courses(conn)?;
    if courses.is_empty() {
        return Ok(DailyPlan {
            date, budget_minutes: budget, scheduled_minutes: 0, remaining_minutes: budget,
            lines: Vec::new(), overdue_count: 0,
        });
    }
    let course_by_id: std::collections::HashMap<String, Course> =
        courses.iter().map(|c| (c.id.clone(), c.clone())).collect();

    let mut lines: Vec<PlanLine> = Vec::new();
    let mut used: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut scheduled: i64 = 0;

    let to_line = |i: &Item, c: &Course| PlanLine {
        item_id: i.id.clone(),
        course_slug: c.slug.clone(),
        course_title: c.title.clone(),
        kind: i.item_type.clone(),
        title: i.title.clone(),
        estimated_minutes: i.estimated_minutes.unwrap_or(0),
        session_number: None,
        youtube_key: i.youtube_key.clone(),
        pdf_path: i.pdf_path.clone(),
        is_continue: i.status == "in_progress",
    };

    // 1) Overdue assignments
    let course_ids: Vec<String> = courses.iter().map(|c| c.id.clone()).collect();
    let overdue = query_overdue(conn, &course_ids, &now_iso)?;
    let overdue_count = overdue.len() as i64;
    for i in &overdue {
        if scheduled >= budget { break; }
        if used.contains(&i.id) { continue; }
        if let Some(c) = course_by_id.get(&i.course_id) {
            lines.push(to_line(i, c));
            used.insert(i.id.clone());
            scheduled += i.estimated_minutes.unwrap_or(60);
        }
    }

    // 2) In-progress
    if scheduled < budget {
        let in_prog = query_in_progress(conn, &course_ids)?;
        for i in &in_prog {
            if scheduled >= budget { break; }
            if used.contains(&i.id) { continue; }
            if let Some(c) = course_by_id.get(&i.course_id) {
                lines.push(to_line(i, c));
                used.insert(i.id.clone());
                scheduled += i.estimated_minutes.unwrap_or(30);
            }
        }
    }

    // 3) Round-robin next undone lecture
    if scheduled < budget {
        let mut exhausted: std::collections::HashSet<String> = std::collections::HashSet::new();
        let mut idx = 0i32;
        while scheduled < budget && idx < 50 && exhausted.len() < courses.len() {
            idx += 1;
            let c = &courses[((idx as usize) - 1) % courses.len()];
            if exhausted.contains(&c.id) { continue; }
            let next = query_next_lecture(conn, &c.id)?;
            let Some(lec) = next.into_iter().find(|x| !used.contains(&x.id)) else {
                exhausted.insert(c.id.clone());
                continue;
            };
            used.insert(lec.id.clone());
            lines.push(to_line(&lec, c));
            scheduled += lec.estimated_minutes.unwrap_or(45);
        }
    }

    Ok(DailyPlan {
        date,
        budget_minutes: budget,
        scheduled_minutes: scheduled,
        remaining_minutes: (budget - scheduled).max(0),
        lines,
        overdue_count,
    })
}

pub fn get_streak(conn: &Connection) -> Result<i64> {
    let mut stmt = conn.prepare(
        "SELECT date, SUM(minutes_logged) AS total FROM day_logs GROUP BY date ORDER BY date DESC LIMIT 400"
    )?;
    let rows = stmt.query_map([], |r| {
        let d: String = r.get(0)?;
        let t: i64 = r.get(1)?;
        Ok((d, t))
    })?;
    let mut active: std::collections::HashSet<String> = std::collections::HashSet::new();
    for r in rows.flatten() {
        if r.1 > 0 { active.insert(r.0); }
    }

    let mut streak = 0i64;
    let mut d = chrono::Utc::now();
    let iso_today = d.format("%Y-%m-%d").to_string();
    if !active.contains(&iso_today) {
        d = d - chrono::Duration::days(1);
    }
    loop {
        let iso = d.format("%Y-%m-%d").to_string();
        if !active.contains(&iso) { break; }
        streak += 1;
        d = d - chrono::Duration::days(1);
    }
    Ok(streak)
}

pub fn mark_item(conn: &Connection, item_id: &str, status: &str) -> Result<()> {
    let now = chrono::Utc::now();
    let now_iso = now.to_rfc3339();
    let date = now.format("%Y-%m-%d").to_string();

    let existing: Option<(String, Option<i64>, Option<String>)> = conn
        .query_row(
            "SELECT status, estimated_minutes, started_at FROM items WHERE id = ?1",
            params![item_id],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, Option<i64>>(1)?, r.get::<_, Option<String>>(2)?)),
        )
        .ok();
    let Some((prev_status, est, started_at)) = existing else {
        return Err(Error::NotFound("item not found".into()));
    };

    let was_completed = prev_status == "completed";
    let will_complete = status == "completed";
    let new_started = if status == "in_progress" && started_at.is_none() { Some(now_iso.clone()) } else { started_at };
    let new_completed = if will_complete { Some(now_iso.clone()) } else { None };

    conn.execute(
        "UPDATE items SET status=?1, started_at=?2, completed_at=?3, updated_at=?4 WHERE id=?5",
        params![status, new_started, new_completed, now_iso, item_id],
    )?;

    if will_complete && !was_completed {
        let delta_min = est.unwrap_or(30);
        // Upsert day log
        let course_id: Option<String> = conn
            .query_row("SELECT course_id FROM items WHERE id=?1", params![item_id], |r| r.get::<_, String>(0))
            .ok();
        let existing_log: Option<(i64, i64)> = conn
            .query_row(
                "SELECT minutes_logged, items_completed FROM day_logs WHERE date=?1 AND (course_id IS ?2)",
                params![date, course_id],
                |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?)),
            )
            .ok();
        match existing_log {
            Some(_) => {
                conn.execute(
                    "UPDATE day_logs SET minutes_logged = minutes_logged + ?1, items_completed = items_completed + ?2
                     WHERE date=?3 AND (course_id IS ?4)",
                    params![delta_min, 1, date, course_id],
                )?;
            }
            None => {
                conn.execute(
                    "INSERT INTO day_logs (date, course_id, minutes_logged, items_completed) VALUES (?1,?2,?3,?4)",
                    params![date, course_id, delta_min, 1],
                )?;
            }
        }
    }
    Ok(())
}

// ---------- query helpers ----------

fn active_courses(conn: &Connection) -> Result<Vec<Course>> {
    let mut stmt = conn.prepare(
        "SELECT id, slug, title, description, course_number, extra_course_numbers,
                term, year, level, department_numbers, instructors, topics, image_url,
                source_path, source_uid, status, daily_budget_minutes, order_index,
                imported_at, updated_at
         FROM courses WHERE status = 'active'
         ORDER BY order_index ASC, title ASC"
    )?;
    let rows = stmt.query_map([], row_to_course)?;
    Ok(rows.flatten().collect())
}

fn row_to_course(r: &rusqlite::Row<'_>) -> rusqlite::Result<Course> {
    use crate::models::parse_json_array;
    let dn: Option<String> = r.get("department_numbers")?;
    let ins: Option<String> = r.get("instructors")?;
    let top: Option<String> = r.get("topics")?;
    Ok(Course {
        id: r.get("id")?,
        slug: r.get("slug")?,
        title: r.get("title")?,
        description: r.get("description")?,
        course_number: r.get("course_number")?,
        extra_course_numbers: r.get("extra_course_numbers")?,
        term: r.get("term")?,
        year: r.get("year")?,
        level: r.get("level")?,
        department_numbers: parse_json_array(&dn),
        instructors: parse_json_array(&ins),
        topics: parse_json_array(&top),
        image_url: r.get("image_url")?,
        source_path: r.get("source_path")?,
        source_uid: r.get("source_uid")?,
        status: r.get("status")?,
        daily_budget_minutes: r.get("daily_budget_minutes")?,
        order_index: r.get("order_index")?,
        imported_at: r.get("imported_at")?,
        updated_at: r.get("updated_at")?,
    })
}

fn query_overdue(conn: &Connection, course_ids: &[String], now_iso: &str) -> Result<Vec<Item>> {
    if course_ids.is_empty() { return Ok(Vec::new()); }
    let placeholders: Vec<String> = (0..course_ids.len()).map(|_| "?".to_string()).collect();
    let in_clause = placeholders.join(",");
    let sql = format!(
        "SELECT id, course_id, session_id, type, order_index, title, description,
                estimated_minutes, status, due_session_id, due_at, youtube_key, archive_url,
                thumbnail_url, pdf_path, transcript_path, external_url, source_key, resource_type,
                learning_resource_types, started_at, completed_at, created_at, updated_at
         FROM items
         WHERE course_id IN ({in})
           AND status NOT IN ('completed','skipped')
           AND due_at IS NOT NULL AND due_at <= ?
           AND completed_at IS NULL
         ORDER BY due_at ASC",
        in = in_clause
    );
    let mut stmt = conn.prepare(&sql)?;
    let mut binds: Vec<&dyn rusqlite::ToSql> = course_ids.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
    binds.push(&now_iso);
    let rows = stmt.query_map(binds.as_slice(), row_to_item)?;
    Ok(rows.flatten().collect())
}

fn query_in_progress(conn: &Connection, course_ids: &[String]) -> Result<Vec<Item>> {
    if course_ids.is_empty() { return Ok(Vec::new()); }
    let placeholders: Vec<String> = (0..course_ids.len()).map(|_| "?".to_string()).collect();
    let in_clause = placeholders.join(",");
    let sql = format!(
        "SELECT id, course_id, session_id, type, order_index, title, description,
                estimated_minutes, status, due_session_id, due_at, youtube_key, archive_url,
                thumbnail_url, pdf_path, transcript_path, external_url, source_key, resource_type,
                learning_resource_types, started_at, completed_at, created_at, updated_at
         FROM items
         WHERE course_id IN ({in}) AND status = 'in_progress'
         ORDER BY updated_at ASC",
        in = in_clause
    );
    let mut stmt = conn.prepare(&sql)?;
    let binds: Vec<&dyn rusqlite::ToSql> = course_ids.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
    let rows = stmt.query_map(binds.as_slice(), row_to_item)?;
    Ok(rows.flatten().collect())
}

fn query_next_lecture(conn: &Connection, course_id: &str) -> Result<Vec<Item>> {
    let sql =
        "SELECT id, course_id, session_id, type, order_index, title, description,
                estimated_minutes, status, due_session_id, due_at, youtube_key, archive_url,
                thumbnail_url, pdf_path, transcript_path, external_url, source_key, resource_type,
                learning_resource_types, started_at, completed_at, created_at, updated_at
         FROM items
         WHERE course_id = ? AND type = 'lecture'
           AND status NOT IN ('completed','skipped')
         ORDER BY order_index ASC LIMIT 5";
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map(params![course_id], row_to_item)?;
    Ok(rows.flatten().collect())
}

pub fn row_to_item(r: &rusqlite::Row<'_>) -> rusqlite::Result<Item> {
    use crate::models::parse_json_array;
    let lrt: Option<String> = r.get("learning_resource_types")?;
    Ok(Item {
        id: r.get("id")?,
        course_id: r.get("course_id")?,
        session_id: r.get("session_id")?,
        item_type: r.get("type")?,
        order_index: r.get("order_index")?,
        title: r.get("title")?,
        description: r.get("description")?,
        estimated_minutes: r.get("estimated_minutes")?,
        status: r.get("status")?,
        due_session_id: r.get("due_session_id")?,
        due_at: r.get("due_at")?,
        youtube_key: r.get("youtube_key")?,
        archive_url: r.get("archive_url")?,
        thumbnail_url: r.get("thumbnail_url")?,
        pdf_path: r.get("pdf_path")?,
        transcript_path: r.get("transcript_path")?,
        external_url: r.get("external_url")?,
        source_key: r.get("source_key")?,
        resource_type: r.get("resource_type")?,
        learning_resource_types: parse_json_array(&lrt),
        started_at: r.get("started_at")?,
        completed_at: r.get("completed_at")?,
        created_at: r.get("created_at")?,
        updated_at: r.get("updated_at")?,
    })
}

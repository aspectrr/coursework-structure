use std::collections::HashMap;
use rusqlite::{params, Connection};

use crate::error::Result;
use crate::importer::{ParsedCourse, default_lecture_minutes, default_assignment_minutes};
use crate::models::{to_json, opt_json};
use crate::db::now_iso;

/// Insert/update course + sessions + items. Idempotent on slug.
pub fn run(conn: &Connection, parsed: &ParsedCourse) -> Result<(String, bool)> {
    let now = now_iso();
    let course = &parsed.course;

    let existing_id: Option<String> = conn
        .query_row(
            "SELECT id FROM courses WHERE slug = ?1",
            params![course.slug],
            |r| r.get(0),
        )
        .ok();
    let updated = existing_id.is_some();
    let course_id = match existing_id {
        Some(id) => {
            conn.execute(
                "UPDATE courses SET title=?1, description=?2, course_number=?3, extra_course_numbers=?4,
                    term=?5, year=?6, level=?7, department_numbers=?8, instructors=?9, topics=?10,
                    image_url=?11, source_path=?12, source_uid=?13, updated_at=?14
                 WHERE id=?15",
                params![
                    course.title, course.description, course.course_number, course.extra_course_numbers,
                    course.term, course.year, course.level,
                    opt_json(&course.department_numbers), opt_json(&course.instructors), opt_json(&course.topics),
                    course.image_url, course.source_path, course.source_uid, now, id,
                ],
            )?;
            id
        }
        None => {
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO courses (id, slug, title, description, course_number, extra_course_numbers,
                    term, year, level, department_numbers, instructors, topics, image_url,
                    source_path, source_uid, status, daily_budget_minutes, order_index, imported_at, updated_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,'active',60,0,?16,?16)",
                params![
                    id, course.slug, course.title, course.description, course.course_number, course.extra_course_numbers,
                    course.term, course.year, course.level,
                    opt_json(&course.department_numbers), opt_json(&course.instructors), opt_json(&course.topics),
                    course.image_url, course.source_path, course.source_uid, now,
                ],
            )?;
            id
        }
    };

    // Snapshot prior completion by sourceKey
    let mut completion: HashMap<String, (String, Option<String>, Option<String>)> = HashMap::new();
    {
        let mut stmt = conn.prepare(
            "SELECT source_key, status, started_at, completed_at FROM items WHERE course_id = ?1 AND source_key IS NOT NULL"
        )?;
        let rows = stmt.query_map(params![course_id], |r| {
            let sk: String = r.get(0)?;
            let st: String = r.get(1)?;
            let sa: Option<String> = r.get(2)?;
            let ca: Option<String> = r.get(3)?;
            Ok((sk, st, sa, ca))
        })?;
        for row in rows.flatten() {
            completion.insert(row.0, (row.1, row.2, row.3));
        }
    }

    // Wipe children
    conn.execute("DELETE FROM sessions WHERE course_id = ?1", params![course_id])?;
    conn.execute("DELETE FROM items WHERE course_id = ?1", params![course_id])?;

    insert_items(conn, &course_id, parsed, &completion, &now)?;
    Ok((course_id, updated))
}

fn insert_items(
    conn: &Connection,
    course_id: &str,
    parsed: &ParsedCourse,
    completion: &HashMap<String, (String, Option<String>, Option<String>)>,
    now: &str,
) -> Result<()> {
    // Build session rows
    struct Sess { order: i64, number: Option<String>, title: String, markers: Vec<String> }
    let mut session_rows: Vec<Sess> = Vec::new();

    if !parsed.sessions.is_empty() {
        for (i, s) in parsed.sessions.iter().enumerate() {
            session_rows.push(Sess {
                order: i as i64,
                number: s.session_number.clone(),
                title: s.title.clone(),
                markers: s.assignment_markers.clone(),
            });
        }
    } else {
        for (i, l) in parsed.lectures.iter().enumerate() {
            session_rows.push(Sess {
                order: i as i64,
                number: l.session_number.as_ref().map(|n| n.to_string()),
                title: l.resource.title.clone().unwrap_or_else(|| format!("Lecture {}", i + 1)),
                markers: Vec::new(),
            });
        }
        if session_rows.is_empty() {
            session_rows.push(Sess { order: 0, number: None, title: "General".into(), markers: Vec::new() });
        }
    }

    let mut session_ids: Vec<Option<String>> = Vec::new();
    for s in &session_rows {
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO sessions (id, course_id, order_index, session_number, title) VALUES (?1,?2,?3,?4,?5)",
            params![id, course_id, s.order, s.number, s.title],
        )?;
        session_ids.push(Some(id));
    }

    let first_session_id = session_ids.first().cloned().flatten();
    let mut session_by_number: HashMap<String, String> = HashMap::new();
    for (i, s) in session_rows.iter().enumerate() {
        if let (Some(n), Some(Some(id))) = (&s.number, session_ids.get(i)) {
            session_by_number.insert(n.clone(), id.clone());
        }
    }

    // HW due-session map
    let mut hw_due_session: HashMap<i64, String> = HashMap::new();
    for (i, s) in session_rows.iter().enumerate() {
        let Some(sid) = session_ids.get(i).and_then(|x| x.clone()) else { continue };
        for marker in &s.markers {
            let m = regex::Regex::new(r"^(\d+)\s+(due|out)$").unwrap();
            if let Some(c) = m.captures(marker) {
                if let (Some(n), Some(v)) = (c.get(1), c.get(2)) {
                    if v.as_str() == "due" {
                        if let Ok(num) = n.as_str().parse::<i64>() {
                            hw_due_session.insert(num, sid.clone());
                        }
                    }
                }
            }
        }
    }

    let mut item_order: i64 = 0;

    // Lectures
    for lec in &parsed.lectures {
        let session_id = lec.session_number
            .as_ref()
            .and_then(|n| session_by_number.get(&n.to_string()))
            .or(first_session_id.as_ref())
            .cloned();
        let preserved = if lec.source_key.is_empty() { None } else { completion.get(&lec.source_key) };
        let (status, started, completed) = match preserved {
            Some((s, a, b)) => (s.clone(), a.clone(), b.clone()),
            None => ("not_started".to_string(), None, None),
        };
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO items (id, course_id, session_id, type, order_index, title, description,
                estimated_minutes, status, due_session_id, due_at, youtube_key, archive_url,
                thumbnail_url, pdf_path, transcript_path, external_url, source_key, resource_type,
                learning_resource_types, started_at, completed_at, created_at, updated_at)
             VALUES (?1,?2,?3,'lecture',?4,?5,?6,?7,?8,NULL,NULL,?9,?10,?11,?12,?13,NULL,?14,?15,?16,?17,?18,?18,?18)",
            params![
                id, course_id, session_id, item_order,
                lec.resource.title.clone().unwrap_or_else(|| format!("Lecture {}", lec.session_number.unwrap_or(item_order))),
                lec.resource.description,
                default_lecture_minutes(&lec.resource),
                status,
                lec.resource.youtube_key, lec.resource.archive_url,
                lec.resolved.thumbnail_url, lec.resolved.pdf_url, lec.resolved.transcript_url,
                lec.source_key, lec.resource.resource_type,
                to_json(&lec.resource.learning_resource_types),
                started, completed, now,
            ],
        )?;
        item_order += 1;
    }

    // Assignments
    for hw in &parsed.assignments {
        let due_sid = hw.hw_number.and_then(|n| hw_due_session.get(&n)).cloned();
        let preserved = if hw.source_key.is_empty() { None } else { completion.get(&hw.source_key) };
        let (status, started, completed) = match preserved {
            Some((s, a, b)) => (s.clone(), a.clone(), b.clone()),
            None => ("not_started".to_string(), None, None),
        };
        let id = uuid::Uuid::new_v4().to_string();
        let title = hw.resource.title.clone()
            .unwrap_or_else(|| format!("Assignment {}", hw.hw_number.map(|n| n.to_string()).unwrap_or_default()));
        conn.execute(
            "INSERT INTO items (id, course_id, session_id, type, order_index, title, description,
                estimated_minutes, status, due_session_id, due_at, youtube_key, archive_url,
                thumbnail_url, pdf_path, transcript_path, external_url, source_key, resource_type,
                learning_resource_types, started_at, completed_at, created_at, updated_at)
             VALUES (?1,?2,NULL,'assignment',?3,?4,?5,?6,?7,?8,NULL,NULL,NULL,NULL,?9,NULL,NULL,?10,?11,?12,?13,?14,?14,?14)",
            params![
                id, course_id, item_order, title,
                hw.resource.description,
                default_assignment_minutes(&hw.resource),
                status,
                due_sid,
                hw.resolved.pdf_url,
                hw.source_key, hw.resource.resource_type,
                to_json(&hw.resource.learning_resource_types),
                started, completed, now,
            ],
        )?;
        item_order += 1;
    }

    Ok(())
}

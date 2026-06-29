use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use regex::Regex;
use std::sync::OnceLock;

use crate::error::{Error, Result};
use crate::models::{slugify, Instructor};

// ---------- parsed types ----------

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedSession {
    pub session_number: Option<String>,
    pub title: String,
    pub assignment_markers: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Resolved {
    pub pdf_url: Option<String>,        // on-disk path
    pub transcript_url: Option<String>, // on-disk path
    pub thumbnail_url: Option<String>,  // on-disk path or http
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceData {
    pub title: Option<String>,
    pub description: Option<String>,
    pub file: Option<String>,
    pub learning_resource_types: Vec<String>,
    pub resource_type: Option<String>,
    pub file_type: Option<String>,
    pub youtube_key: Option<String>,
    pub captions_file: Option<String>,
    pub transcript_file: Option<String>,
    pub thumbnail_file: Option<String>,
    pub archive_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedLecture {
    pub session_number: Option<i64>,
    pub source_key: String,
    pub resource: ResourceData,
    pub resolved: Resolved,
    pub folder_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedAssignment {
    pub hw_number: Option<i64>,
    pub source_key: String,
    pub resource: ResourceData,
    pub resolved: Resolved,
    pub folder_name: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedCourse {
    pub course: ParsedCourseHeader,
    pub sessions: Vec<ParsedSession>,
    pub lectures: Vec<ParsedLecture>,
    pub assignments: Vec<ParsedAssignment>,
    pub other_items: Vec<ParsedOtherItem>,
    pub assignments_page_content: Option<String>,
    pub warnings: Vec<String>,
    pub course_path: String,
    pub course_rel_path: String,
    pub folder_name: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedCourseHeader {
    pub slug: String,
    pub title: String,
    pub description: Option<String>,
    pub course_number: Option<String>,
    pub extra_course_numbers: Option<String>,
    pub term: Option<String>,
    pub year: Option<String>,
    pub level: Option<String>,
    pub department_numbers: Vec<String>,
    pub instructors: Vec<Instructor>,
    pub topics: Vec<Vec<String>>,
    pub image_url: Option<String>,
    pub source_path: String,
    pub source_uid: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedOtherItem {
    pub source_key: String,
    pub resource: ResourceData,
    pub resolved: Resolved,
    pub folder_name: String,
    #[serde(rename = "type")]
    pub kind: String,
}

// ---------- regex setup ----------

fn assignment_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"(?i)Assignment\s+(\d+|\w+)\s+(out|due)").unwrap())
}

// ---------- helpers ----------

fn read_json(path: &Path) -> Option<Value> {
    let s = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&s).ok()
}

fn s(v: &Value, k: &str) -> Option<String> {
    v.get(k).and_then(|x| x.as_str()).map(|s| s.to_string())
}

fn arr_str(v: &Value, k: &str) -> Vec<String> {
    v.get(k)
        .and_then(|x| x.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect())
        .unwrap_or_default()
}

fn list_subdirs(dir: &Path) -> Vec<PathBuf> {
    match std::fs::read_dir(dir) {
        Ok(rd) => rd.filter_map(|e| e.ok())
            .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
            .map(|e| e.path())
            .filter(|p| p.file_name().and_then(|n| n.to_str()).map(|n| !n.starts_with('.')).unwrap_or(true))
            .collect(),
        Err(_) => Vec::new(),
    }
}

fn session_number_from_folder(name: &str) -> Option<i64> {
    let l = name.to_lowercase();
    if let Some(caps) = regex::Regex::new(r"(?i)^lecture[-_ ]?(\d+)").unwrap().captures(&l) {
        return caps.get(1).and_then(|m| m.as_str().parse().ok());
    }
    if let Some(caps) = regex::Regex::new(r"(?i)[_-]?lec(\d+)").unwrap().captures(&l) {
        return caps.get(1).and_then(|m| m.as_str().parse().ok());
    }
    None
}

fn hw_number_from_folder(name: &str) -> Option<i64> {
    regex::Regex::new(r"(?i)[_-]?hw\s*(\d+)")
        .unwrap()
        .captures(name)
        .and_then(|c| c.get(1).and_then(|m| m.as_str().parse().ok()))
}

fn basename_of(file_url: &str) -> Option<String> {
    let clean = file_url.split(['?', '#']).next().unwrap_or("");
    let idx = clean.rfind('/').map(|i| i + 1).unwrap_or(0);
    let base = &clean[idx..];
    if base.is_empty() { None } else { Some(base.to_string()) }
}

fn resolve_static(course_path: &Path, file_url: Option<&str>) -> Option<String> {
    let base = basename_of(file_url?)?;
    let abs = course_path.join("static_resources").join(&base);
    if abs.is_file() {
        Some(abs.to_string_lossy().into_owned())
    } else {
        None
    }
}

fn resolve_resource(course_path: &Path, r: &ResourceData) -> Resolved {
    let pdf_url = resolve_static(course_path, r.file.as_deref());
    let transcript_url = resolve_static(course_path, r.transcript_file.as_deref());
    let thumbnail_url = if let Some(t) = &r.thumbnail_file {
        if t.starts_with("http://") || t.starts_with("https://") {
            Some(t.clone())
        } else {
            resolve_static(course_path, Some(t))
        }
    } else {
        None
    };
    Resolved { pdf_url, transcript_url, thumbnail_url }
}

// ---------- calendar parsing ----------

pub fn parse_calendar_content(raw: &str) -> Vec<ParsedSession> {
    if raw.is_empty() { return Vec::new(); }
    let header_re = regex::Regex::new(r"(?i)^(ses|#|session|topics|key\s+dates)").unwrap();
    let line_re = regex::Regex::new(
        r"^([A-Za-z]?\s*\d+\s*[-–~]\s*\d+|[A-Za-z]?\s*\d+)\s+(.*)$",
    ).unwrap();
    let assign_re = assignment_re();

    let mut lines: Vec<&str> = raw
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect();
    while lines.first().map(|first| header_re.is_match(first)).unwrap_or(false) {
        lines.remove(0);
    }

    let mut out = Vec::new();
    for line in lines {
        let caps = match line_re.captures(line) {
            Some(c) => c,
            None => continue,
        };
        let session_number = caps.get(1).map(|m| m.as_str().split_whitespace().collect::<String>());
        let rest = caps.get(2).map(|m| m.as_str()).unwrap_or("");

        let mut markers = Vec::new();
        for m in assign_re.captures_iter(rest) {
            let n = m.get(1).map(|x| x.as_str()).unwrap_or("");
            let v = m.get(2).map(|x| x.as_str()).unwrap_or("");
            markers.push(format!("{} {}", n.to_lowercase(), v.to_lowercase()));
        }

        let title: String = assign_re.replace_all(rest, "")
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        out.push(ParsedSession {
            session_number,
            title,
            assignment_markers: markers,
        });
    }
    out
}

// ---------- course discovery ----------

pub fn find_course_dirs(root: &Path) -> Vec<PathBuf> {
    let mut found = Vec::new();
    for sub in list_subdirs(root) {
        if sub.join("data.json").is_file() {
            found.push(sub);
            continue;
        }
        for nested in list_subdirs(&sub) {
            if nested.join("data.json").is_file() {
                found.push(nested);
            }
        }
    }
    found
}

// ---------- main parse ----------

pub fn parse_course(course_path: &Path, root: &Path) -> Result<ParsedCourse> {
    let warnings = Vec::new();
    let data_path = course_path.join("data.json");
    let data = read_json(&data_path).ok_or_else(|| Error::NotFound(format!("data.json at {}", course_path.display())))?;
    let folder_name = course_path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
    let course_rel_path = path_relative_to(root, course_path);

    let primary_num = s(&data, "primary_course_number");
    let term = s(&data, "term");
    let year = s(&data, "year");
    let slug_key = match (&primary_num, &term, &year) {
        (Some(p), Some(t), Some(y)) => format!("{}-{}-{}", p, t, y),
        (Some(p), _, _) => p.clone(),
        _ => folder_name.clone(),
    };
    let slug = slugify(&slug_key);

    // Image
    let image_url = s(&data, "image_src").and_then(|src| {
        if src.starts_with("http://") || src.starts_with("https://") {
            Some(src)
        } else {
            let rel = src.trim_start_matches("./").trim_start_matches('/');
            let abs = course_path.join(rel);
            if abs.is_file() {
                Some(abs.to_string_lossy().into_owned())
            } else {
                None
            }
        }
    });

    let instructors: Vec<Instructor> = data.get("instructors")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| {
            if x.is_null() { return None; }
            Some(Instructor {
                first_name: x.get("first_name").and_then(|v| v.as_str()).map(String::from),
                last_name: x.get("last_name").and_then(|v| v.as_str()).map(String::from),
                middle_initial: x.get("middle_initial").and_then(|v| v.as_str()).map(String::from),
                salutation: x.get("salutation").and_then(|v| v.as_str()).map(String::from),
                title: x.get("title").and_then(|v| v.as_str()).map(String::from),
            })
        }).collect())
        .unwrap_or_default();

    let topics: Vec<Vec<String>> = data.get("topics")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_array().map(|inner| {
            inner.iter().filter_map(|y| y.as_str().map(String::from)).collect()
        })).collect())
        .unwrap_or_default();

    let level = data.get("level").and_then(|v| v.as_array())
        .and_then(|a| a.first()).and_then(|v| v.as_str()).map(String::from);

    let course = ParsedCourseHeader {
        slug,
        title: s(&data, "course_title").unwrap_or_else(|| folder_name.clone()),
        description: s(&data, "course_description"),
        course_number: primary_num,
        extra_course_numbers: s(&data, "extra_course_numbers"),
        term,
        year,
        level,
        department_numbers: arr_str(&data, "department_numbers"),
        instructors,
        topics,
        image_url,
        source_path: course_rel_path.clone(),
        source_uid: s(&data, "site_uid"),
    };

    // Calendar
    let cal_data = read_json(&course_path.join("pages").join("calendar").join("data.json"));
    let sessions = cal_data.as_ref()
        .and_then(|v| v.get("content"))
        .and_then(|v| v.as_str())
        .map(parse_calendar_content)
        .unwrap_or_default();
    let assignments_data = read_json(&course_path.join("pages").join("assignments").join("data.json"));
    let assignments_page_content = assignments_data.as_ref()
        .and_then(|v| v.get("content"))
        .and_then(|v| v.as_str())
        .map(String::from);

    // Resources
    let resources_dir = course_path.join("resources");
    let resource_folders = list_subdirs(&resources_dir);

    let mut lectures: Vec<ParsedLecture> = Vec::new();
    let mut assignments: Vec<ParsedAssignment> = Vec::new();
    let mut other_items: Vec<ParsedOtherItem> = Vec::new();

    // First pass — collect lec-numbered PDF-only
    let mut pdf_only_by_lec: std::collections::HashMap<i64, (String, ResourceData, Resolved)> = std::collections::HashMap::new();

    for folder in &resource_folders {
        let fp = folder.join("data.json");
        let r_val = match read_json(&fp) { Some(v) => v, None => continue };
        let r = resource_from_value(&r_val);
        let resolved = resolve_resource(course_path, &r);
        let folder_name_local = folder.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
        let lec_n = session_number_from_folder(&folder_name_local);
        let hw_n = hw_number_from_folder(&folder_name_local);
        let is_pdf = r.file_type.as_deref() == Some("application/pdf")
            || r.resource_type.as_deref() == Some("Document");

        if let Some(n) = lec_n {
            if is_pdf {
                pdf_only_by_lec.insert(n, (folder_name_local.clone(), r.clone(), resolved.clone()));
                continue;
            }
            lectures.push(ParsedLecture {
                session_number: Some(n),
                source_key: folder_name_local.clone(),
                resource: r.clone(),
                resolved: resolved.clone(),
                folder_name: folder_name_local,
            });
            continue;
        }
        if r.youtube_key.is_some() {
            lectures.push(ParsedLecture {
                session_number: None,
                source_key: folder_name_local.clone(),
                resource: r.clone(),
                resolved: resolved.clone(),
                folder_name: folder_name_local,
            });
            continue;
        }
        if let Some(n) = hw_n {
            assignments.push(ParsedAssignment {
                hw_number: Some(n),
                source_key: folder_name_local.clone(),
                resource: r.clone(),
                resolved: resolved.clone(),
                folder_name: folder_name_local,
            });
            continue;
        }
        if is_pdf && hw_n.is_none() {
            // pdf without lec/hw marker — treat as lecture-ish
            other_items.push(ParsedOtherItem {
                source_key: folder_name_local.clone(),
                resource: r.clone(),
                resolved: resolved.clone(),
                folder_name: folder_name_local,
                kind: r.resource_type.clone().unwrap_or_else(|| "other".into()),
            });
            continue;
        }
        other_items.push(ParsedOtherItem {
            source_key: folder_name_local.clone(),
            resource: r.clone(),
            resolved: resolved.clone(),
            folder_name: folder_name_local,
            kind: r.resource_type.clone().unwrap_or_else(|| "other".into()),
        });
    }

    // Merge pdf-only into video lectures
    let mut to_synthesize: Vec<(i64, String, ResourceData, Resolved)> = Vec::new();
    for lec in lectures.iter_mut() {
        if let Some(n) = lec.session_number {
            if let Some((_, pdf_r, pdf_resolved)) = pdf_only_by_lec.remove(&n) {
                lec.resolved = Resolved {
                    pdf_url: pdf_resolved.pdf_url.or(lec.resolved.pdf_url.clone()),
                    transcript_url: pdf_resolved.transcript_url.or(lec.resolved.transcript_url.clone()),
                    thumbnail_url: lec.resolved.thumbnail_url.clone(),
                };
                let _ = pdf_r;
            }
        }
    }
    for (n, (folder, r, resolved)) in pdf_only_by_lec.into_iter() {
        to_synthesize.push((n, folder, r, resolved));
    }
    for (n, folder, _r, resolved) in to_synthesize {
        lectures.push(ParsedLecture {
            session_number: Some(n),
            source_key: folder.clone(),
            resource: ResourceData {
                title: Some(format!("Lecture {}", n)),
                resource_type: Some("Document".into()),
                file_type: Some("application/pdf".into()),
                ..Default::default()
            },
            resolved,
            folder_name: folder,
        });
    }

    // Sort lectures by session_number (nulls last)
    lectures.sort_by(|a, b| match (a.session_number, b.session_number) {
        (Some(x), Some(y)) => x.cmp(&y),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => std::cmp::Ordering::Equal,
    });

    Ok(ParsedCourse {
        course,
        sessions,
        lectures,
        assignments,
        other_items,
        assignments_page_content,
        warnings,
        course_path: course_path.to_string_lossy().into_owned(),
        course_rel_path,
        folder_name,
    })
}

fn resource_from_value(v: &Value) -> ResourceData {
    ResourceData {
        title: s(v, "title"),
        description: s(v, "description"),
        file: s(v, "file"),
        learning_resource_types: arr_str(v, "learning_resource_types"),
        resource_type: s(v, "resource_type"),
        file_type: s(v, "file_type"),
        youtube_key: s(v, "youtube_key"),
        captions_file: s(v, "captions_file"),
        transcript_file: s(v, "transcript_file"),
        thumbnail_file: s(v, "thumbnail_file"),
        archive_url: s(v, "archive_url"),
    }
}

fn path_relative_to(base: &Path, p: &Path) -> String {
    let b = base.to_string_lossy().into_owned();
    let s = p.to_string_lossy().into_owned();
    if let Some(rest) = s.strip_prefix(&b) {
        rest.trim_start_matches('/').to_string()
    } else {
        s
    }
}

pub fn default_lecture_minutes(r: &ResourceData) -> i64 {
    if r.youtube_key.is_some() || r.archive_url.is_some() { 45 }
    else if r.file_type.as_deref() == Some("application/pdf") { 30 }
    else { 30 }
}

pub fn default_assignment_minutes(_r: &ResourceData) -> i64 { 60 }

// ---------- import runner ----------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub slug: String,
    pub title: String,
    pub updated: bool,
    pub ok: bool,
    pub error: Option<String>,
}

pub fn import_course_into_db(
    conn: &rusqlite::Connection,
    parsed: &ParsedCourse,
) -> Result<(String, bool)> {
    crate::import_runner::run(conn, parsed)
}

pub fn import_all(conn: &rusqlite::Connection, root: &Path) -> Result<Vec<ImportResult>> {
    let dirs = find_course_dirs(root);
    let mut results = Vec::new();
    for dir in dirs {
        let parsed = match parse_course(&dir, root) {
            Ok(p) => p,
            Err(e) => {
                results.push(ImportResult {
                    slug: dir.to_string_lossy().into_owned(),
                    title: dir.to_string_lossy().into_owned(),
                    updated: false,
                    ok: false,
                    error: Some(e.to_string()),
                });
                continue;
            }
        };
        let slug = parsed.course.slug.clone();
        let title = parsed.course.title.clone();
        match import_course_into_db(&conn, &parsed) {
            Ok((_id, updated)) => results.push(ImportResult { slug, title, updated, ok: true, error: None }),
            Err(e) => results.push(ImportResult { slug, title, updated: false, ok: false, error: Some(e.to_string()) }),
        }
    }
    Ok(results)
}



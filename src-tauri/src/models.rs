use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Course {
    pub id: String,
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
    pub status: String,
    pub daily_budget_minutes: Option<i64>,
    pub order_index: i64,
    pub imported_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Instructor {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub middle_initial: Option<String>,
    pub salutation: Option<String>,
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub course_id: String,
    pub order_index: i64,
    pub session_number: Option<String>,
    pub title: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    pub course_id: String,
    pub session_id: Option<String>,
    #[serde(rename = "type")]
    pub item_type: String,
    pub order_index: i64,
    pub title: String,
    pub description: Option<String>,
    pub estimated_minutes: Option<i64>,
    pub status: String,
    pub due_session_id: Option<String>,
    pub due_at: Option<String>,
    pub youtube_key: Option<String>,
    pub archive_url: Option<String>,
    pub thumbnail_url: Option<String>,
    pub pdf_path: Option<String>,
    pub transcript_path: Option<String>,
    pub external_url: Option<String>,
    pub source_key: Option<String>,
    pub resource_type: Option<String>,
    pub learning_resource_types: Vec<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DayLog {
    pub date: String,
    pub course_id: Option<String>,
    pub minutes_logged: i64,
    pub items_completed: i64,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoNote {
    pub id: String,
    pub item_id: String,
    pub content: String,
    pub video_time_seconds: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

// ---------- helpers for JSON columns ----------

pub fn parse_json_array<T: for<'de> Deserialize<'de>>(s: &Option<String>) -> Vec<T> {
    match s {
        Some(s) if !s.is_empty() => serde_json::from_str(s).unwrap_or_default(),
        _ => Vec::new(),
    }
}

pub fn to_json<T: Serialize>(v: &T) -> String {
    serde_json::to_string(v).unwrap_or_else(|_| "null".into())
}

pub fn opt_json<T: Serialize>(v: &T) -> String {
    serde_json::to_string(v).unwrap_or_else(|_| "null".into())
}

pub fn slugify(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

#[allow(dead_code)]
fn _ensure_unicode_normalization_unused() {
    // ponytail: prior NFKD combiner-stripping removed; slugify is ASCII-only now.
    // MIT OCW titles are ASCII; add unicode-normalization crate if real NFKD ever needed.
}

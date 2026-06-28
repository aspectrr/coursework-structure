-- Mirrors the prior Postgres schema. Enums → TEXT + CHECK.
-- Timestamps → TEXT (ISO 8601 UTC). JSON columns → TEXT.

CREATE TABLE IF NOT EXISTS courses (
  id                   TEXT PRIMARY KEY,
  slug                 TEXT NOT NULL UNIQUE,
  title                TEXT NOT NULL,
  description          TEXT,
  course_number        TEXT,
  extra_course_numbers TEXT,
  term                 TEXT,
  year                 TEXT,
  level                TEXT,
  department_numbers   TEXT,    -- JSON array
  instructors          TEXT,    -- JSON array
  topics               TEXT,    -- JSON nested array
  image_url            TEXT,
  source_path          TEXT NOT NULL,
  source_uid           TEXT,
  status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','paused','archived','completed')),
  daily_budget_minutes INTEGER DEFAULT 60,
  order_index          INTEGER NOT NULL DEFAULT 0,
  imported_at          TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT PRIMARY KEY,
  course_id       TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  order_index     INTEGER NOT NULL,
  session_number  TEXT,
  title           TEXT,
  notes           TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_course ON sessions(course_id);

CREATE TABLE IF NOT EXISTS items (
  id                       TEXT PRIMARY KEY,
  course_id                TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  session_id               TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  type                     TEXT NOT NULL
                             CHECK (type IN ('lecture','assignment','reading','project','exam')),
  order_index              INTEGER NOT NULL,
  title                    TEXT NOT NULL,
  description              TEXT,
  estimated_minutes        INTEGER,
  status                   TEXT NOT NULL DEFAULT 'not_started'
                             CHECK (status IN ('not_started','in_progress','completed','skipped')),
  due_session_id           TEXT,
  due_at                   TEXT,
  youtube_key              TEXT,
  archive_url              TEXT,
  thumbnail_url            TEXT,
  pdf_path                 TEXT,
  transcript_path          TEXT,
  external_url             TEXT,
  source_key               TEXT,
  resource_type            TEXT,
  learning_resource_types  TEXT,    -- JSON array
  started_at               TEXT,
  completed_at             TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_course ON items(course_id);
CREATE INDEX IF NOT EXISTS idx_items_session ON items(session_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);

CREATE TABLE IF NOT EXISTS day_logs (
  date             TEXT NOT NULL,   -- YYYY-MM-DD local
  course_id        TEXT REFERENCES courses(id) ON DELETE CASCADE,
  minutes_logged   INTEGER NOT NULL DEFAULT 0,
  items_completed  INTEGER NOT NULL DEFAULT 0,
  notes            TEXT,
  PRIMARY KEY (date, course_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,   -- JSON
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS note_index (
  id           TEXT PRIMARY KEY,
  course_slug  TEXT NOT NULL,
  item_slug    TEXT,
  file_path    TEXT NOT NULL,
  title        TEXT,
  links_found  TEXT NOT NULL DEFAULT '[]',   -- JSON array
  backlinks    TEXT NOT NULL DEFAULT '[]',   -- JSON array
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS video_notes (
  id                  TEXT PRIMARY KEY,
  item_id             TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  content             TEXT NOT NULL,
  video_time_seconds  INTEGER,   -- null if captured off-video
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_video_notes_item ON video_notes(item_id);
CREATE INDEX IF NOT EXISTS idx_video_notes_time ON video_notes(video_time_seconds);

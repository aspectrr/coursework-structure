import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  uuid,
  pgEnum,
} from 'drizzle-orm/pg-core';

// ---------- enums ----------
export const courseStatus = pgEnum('course_status', ['active', 'paused', 'archived', 'completed']);
export const itemStatus = pgEnum('item_status', ['not_started', 'in_progress', 'completed', 'skipped']);
export const itemType = pgEnum('item_type', ['lecture', 'assignment', 'reading', 'project', 'exam']);

// ---------- courses ----------
export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  courseNumber: text('course_number'),
  extraCourseNumbers: text('extra_course_numbers'),
  term: text('term'),
  year: text('year'),
  level: text('level'),
  departmentNumbers: text('department_numbers').array(),
  instructors: jsonb('instructors').$type<CourseInstructor[]>(),
  topics: jsonb('topics').$type<string[][]>(),
  imageUrl: text('image_url'),
  sourcePath: text('source_path').notNull(),
  sourceUid: text('source_uid'),
  status: courseStatus('status').default('active').notNull(),
  dailyBudgetMinutes: integer('daily_budget_minutes').default(60),
  orderIndex: integer('order_index').default(0).notNull(),
  importedAt: timestamp('imported_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ---------- sessions (calendar entries; groups items) ----------
// Represents one row of the MIT calendar: "Session 1 — Introduction"
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  orderIndex: integer('order_index').notNull(),
  sessionNumber: text('session_number'), // "1", "4-5", null if no calendar
  title: text('title'),
  notes: text('notes'),
});

// ---------- items (lectures, assignments, readings) ----------
export const items = pgTable('items', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),

  type: itemType('type').notNull(),
  orderIndex: integer('order_index').notNull(),
  title: text('title').notNull(),
  description: text('description'),

  // Scheduling
  estimatedMinutes: integer('estimated_minutes'),
  status: itemStatus('status').default('not_started').notNull(),
  dueSessionId: uuid('due_session_id'), // for assignments — when due relative to a session
  dueAt: timestamp('due_at', { withTimezone: true }),

  // Content pointers (nullable — depends on type)
  youtubeKey: text('youtube_key'),
  archiveUrl: text('archive_url'),
  thumbnailUrl: text('thumbnail_url'),
  pdfPath: text('pdf_path'),
  transcriptPath: text('transcript_path'),
  externalUrl: text('external_url'),

  // Identifier from source (folder name or UID) — used for idempotent re-import
  sourceKey: text('source_key'),
  resourceType: text('resource_type'),
  learningResourceTypes: text('learning_resource_types').array(),

  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ---------- day log (consistency tracking) ----------
export const dayLogs = pgTable('day_logs', {
  date: text('date').notNull(), // YYYY-MM-DD, local
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'cascade' }),
  minutesLogged: integer('minutes_logged').default(0).notNull(),
  itemsCompleted: integer('items_completed').default(0).notNull(),
  notes: text('notes'),
});

// ---------- settings ----------
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ---------- backlinks cache for notes (optional v1.5) ----------
export const noteIndex = pgTable('note_index', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseSlug: text('course_slug').notNull(),
  itemSlug: text('item_slug'), // session-stamped lecture id, or "course" for course-level note
  filePath: text('file_path').notNull(),
  title: text('title'),
  linksFound: text('links_found').array().default([]).notNull(),
  backlinks: text('backlinks').array().default([]).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ---------- types ----------
export type CourseInstructor = {
  first_name?: string;
  last_name?: string;
  middle_initial?: string;
  salutation?: string;
  title?: string;
};

export type Course = typeof courses.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Item = typeof items.$inferSelect;
export type DayLog = typeof dayLogs.$inferSelect;

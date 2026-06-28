import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';

// Domain types — mirror src-tauri/src/models.rs
export type ItemType = 'lecture' | 'assignment' | 'reading' | 'project' | 'exam';
export type ItemStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

export interface Instructor { firstName?: string; lastName?: string; middleInitial?: string; salutation?: string; title?: string; }

export interface Course {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  courseNumber?: string | null;
  extraCourseNumbers?: string | null;
  term?: string | null;
  year?: string | null;
  level?: string | null;
  departmentNumbers: string[];
  instructors: Instructor[];
  topics: string[][];
  imageUrl?: string | null;
  sourcePath: string;
  sourceUid?: string | null;
  status: string;
  dailyBudgetMinutes?: number | null;
  orderIndex: number;
  importedAt: string;
  updatedAt: string;
}

export interface Session {
  id: string; courseId: string; orderIndex: number;
  sessionNumber?: string | null; title?: string | null; notes?: string | null;
}

export interface Item {
  id: string; courseId: string; sessionId?: string | null;
  type: ItemType; orderIndex: number; title: string;
  description?: string | null;
  estimatedMinutes?: number | null;
  status: ItemStatus;
  dueSessionId?: string | null;
  dueAt?: string | null;
  youtubeKey?: string | null;
  archiveUrl?: string | null;
  thumbnailUrl?: string | null;
  pdfPath?: string | null;
  transcriptPath?: string | null;
  externalUrl?: string | null;
  sourceKey?: string | null;
  resourceType?: string | null;
  learningResourceTypes: string[];
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string; updatedAt: string;
}

export interface VideoNote {
  id: string; itemId: string; content: string;
  videoTimeSeconds?: number | null;
  createdAt: string; updatedAt: string;
}

export interface PlanLine {
  itemId: string; courseSlug: string; courseTitle: string;
  type: ItemType; title: string; estimatedMinutes: number;
  sessionNumber?: string | null;
  youtubeKey?: string | null;
  pdfPath?: string | null;
  isContinue: boolean;
}

export interface DailyPlan {
  date: string;
  budgetMinutes: number;
  scheduledMinutes: number;
  remainingMinutes: number;
  lines: PlanLine[];
  overdueCount: number;
}

export interface CourseSummary {
  id: string; slug: string; title: string;
  courseNumber?: string | null; imageUrl?: string | null; status: string;
}

export interface CourseProgress {
  course: CourseSummary;
  total: number; done: number;
  minutesTotal: number; minutesDone: number;
}

export interface TodayView {
  plan: DailyPlan;
  streak: number;
  progress: CourseProgress[];
}

export interface DayCell { date: string; minutes: number; items: number; future: boolean; }
export interface DayLogSummary { date: string; minutes: number; items: number; }
export interface CalendarView { days: DayCell[]; recent: DayLogSummary[]; }

export interface CourseDetail { course: Course; sessions: Session[]; items: Item[]; }

export interface ImportResult {
  slug: string; title: string; updated: boolean; ok: boolean; error?: string | null;
}

// ---------- command wrappers ----------

export const api = {
  todayGet: () => invoke<TodayView>('today_get'),
  calendarGet: () => invoke<CalendarView>('calendar_get'),
  adminListCourses: () => invoke<Course[]>('admin_list_courses'),
  adminImport: () => invoke<{ ok: boolean; results: ImportResult[] }>('admin_import'),
  previewImport: () => invoke<string[]>('preview_import'),
  markItemComplete: (itemId: string, status?: ItemStatus) => invoke<void>('mark_item_complete', { itemId, status }),
  courseDetail: (slug: string) => invoke<CourseDetail>('course_detail', { slug }),
  itemDetail: (id: string) => invoke<Item>('item_detail', { id }),
  notesRead: (courseSlug: string, kind: 'course' | 'lecture' | 'assignment', order: number | null, titleSlug: string) =>
    invoke<string | null>('notes_read', { payload: { courseSlug, kind, order, titleSlug, content: '' } }),
  notesWrite: (courseSlug: string, kind: 'course' | 'lecture' | 'assignment', order: number | null, titleSlug: string, content: string) =>
    invoke<string>('notes_write', { payload: { courseSlug, kind, order, titleSlug, content } }),
  videoNotesList: (itemId: string) => invoke<VideoNote[]>('video_notes_list', { itemId }),
  videoNotesCreate: (itemId: string, content: string, videoTimeSeconds: number | null) =>
    invoke<VideoNote>('video_notes_create', { payload: { itemId, content, videoTimeSeconds } }),
  videoNotesUpdate: (id: string, content: string) => invoke<void>('video_notes_update', { id, content }),
  videoNotesDelete: (id: string) => invoke<void>('video_notes_delete', { id }),
  getCoursesDir: () => invoke<string>('get_courses_dir'),
  pickCoursesDir: () => invoke<string | null>('pick_courses_dir'),
};

// ---------- helpers ----------

export function fileUrl(localPath?: string | null): string | null {
  if (!localPath) return null;
  if (/^https?:\/\//.test(localPath)) return localPath;
  return convertFileSrc(localPath);
}

export function fmtTime(seconds?: number | null): string {
  if (seconds == null) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

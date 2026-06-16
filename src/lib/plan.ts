import { db } from '@/db/client';
import { courses, items, dayLogs } from '@/db/schema';
import { and, asc, eq, inArray, isNull, lte, ne, sql } from 'drizzle-orm';

export type PlanLine = {
  itemId: string;
  courseSlug: string;
  courseTitle: string;
  courseColor?: string;
  type: 'lecture' | 'assignment' | 'reading' | 'project' | 'exam';
  title: string;
  estimatedMinutes: number;
  sessionNumber: string | null;
  youtubeKey: string | null;
  pdfPath: string | null;
  isContinue: boolean; // partially in-progress
};

export type DailyPlan = {
  date: string; // YYYY-MM-DD
  budgetMinutes: number;
  scheduledMinutes: number;
  remainingMinutes: number;
  lines: PlanLine[];
  overdueCount: number;
};

const DEFAULT_BUDGET = Number(process.env.DAILY_BUDGET_MINUTES ?? 60);

// Build today's plan across all active courses.
// Algorithm:
//   1) Pull overdue items (status != completed, dueAt < now) — prioritize
//   2) Pull items due today or tomorrow (anything within 48h)
//   3) For remaining budget: walk next undone lecture per active course, round-robin
//   4) Fill remaining budget with continuation of in_progress items
export async function buildDailyPlan(now: Date = new Date(), budgetMinutes: number = DEFAULT_BUDGET): Promise<DailyPlan> {
  const date = now.toISOString().slice(0, 10);

  // Active courses only
  const activeCourses = await db
    .select()
    .from(courses)
    .where(eq(courses.status, 'active'))
    .orderBy(asc(courses.orderIndex), asc(courses.title));
  if (activeCourses.length === 0) {
    return { date, budgetMinutes, scheduledMinutes: 0, remainingMinutes: budgetMinutes, lines: [], overdueCount: 0 };
  }

  const courseIds = activeCourses.map((c) => c.id);
  const courseById = new Map(activeCourses.map((c) => [c.id, c]));

  const lines: PlanLine[] = [];
  const usedIds = new Set<string>();
  let scheduled = 0;

  const toItem = (i: typeof items.$inferSelect): PlanLine => {
    const c = courseById.get(i.courseId)!;
    return {
      itemId: i.id,
      courseSlug: c.slug,
      courseTitle: c.title,
      type: i.type as PlanLine['type'],
      title: i.title,
      estimatedMinutes: i.estimatedMinutes ?? 0,
      sessionNumber: null,
      youtubeKey: i.youtubeKey,
      pdfPath: i.pdfPath,
      isContinue: i.status === 'in_progress',
    };
  };

  // 1) Overdue assignments
  const overdue = await db
    .select()
    .from(items)
    .where(
      and(
        inArray(items.courseId, courseIds),
        ne(items.status, 'completed'),
        ne(items.status, 'skipped'),
        lte(items.dueAt, now),
        isNull(items.completedAt),
      ),
    )
    .orderBy(asc(items.dueAt));

  for (const i of overdue) {
    if (scheduled >= budgetMinutes) break;
    if (usedIds.has(i.id)) continue;
    lines.push(toItem(i));
    usedIds.add(i.id);
    scheduled += i.estimatedMinutes ?? 60;
  }

  // 2) In-progress items (continue)
  if (scheduled < budgetMinutes) {
    const inProg = await db
      .select()
      .from(items)
      .where(
        and(
          inArray(items.courseId, courseIds),
          eq(items.status, 'in_progress'),
        ),
      )
      .orderBy(asc(items.updatedAt));
    for (const i of inProg) {
      if (scheduled >= budgetMinutes) break;
      if (usedIds.has(i.id)) continue;
      lines.push(toItem(i));
      usedIds.add(i.id);
      scheduled += i.estimatedMinutes ?? 30;
    }
  }

  // 3) Round-robin next undone lecture across courses
  if (scheduled < budgetMinutes) {
    let idx = 0;
    const perCourse = new Map<string, typeof items.$inferSelect | null>();
    while (scheduled < budgetMinutes && idx < 50) {
      idx++;
      const c = activeCourses[(idx - 1) % activeCourses.length];
      if (!c) break;
      if (perCourse.has(c.id) && perCourse.get(c.id) === null) {
        // exhausted this course
        if ([...perCourse.values()].every((v) => v === null)) break;
        continue;
      }
      // Find next undone lecture in this course not yet used
      const next = await db
        .select()
        .from(items)
        .where(
          and(
            eq(items.courseId, c.id),
            eq(items.type, 'lecture'),
            ne(items.status, 'completed'),
            ne(items.status, 'skipped'),
          ),
        )
        .orderBy(asc(items.orderIndex))
        .limit(1);
      const lec = next.find((x) => !usedIds.has(x.id));
      if (!lec) {
        perCourse.set(c.id, null);
        continue;
      }
      perCourse.set(c.id, lec);
      usedIds.add(lec.id);
      lines.push(toItem(lec));
      scheduled += lec.estimatedMinutes ?? 45;
    }
  }

  return {
    date,
    budgetMinutes,
    scheduledMinutes: scheduled,
    remainingMinutes: Math.max(0, budgetMinutes - scheduled),
    lines,
    overdueCount: overdue.length,
  };
}

// Mark item status; updates day_log with minutes + items completed.
export async function markItem(
  itemId: string,
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped',
) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);

  const [existing] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  if (!existing) throw new Error('item not found');

  const wasCompleted = existing.status === 'completed';
  const willComplete = status === 'completed';

  await db
    .update(items)
    .set({
      status,
      startedAt: status === 'in_progress' && !existing.startedAt ? now : existing.startedAt,
      completedAt: willComplete ? now : null,
      updatedAt: now,
    })
    .where(eq(items.id, itemId));

  // Update day log
  const deltaMinutes = willComplete && !wasCompleted ? existing.estimatedMinutes ?? 30 : 0;
  const deltaItems = willComplete && !wasCompleted ? 1 : 0;
  if (deltaMinutes > 0 || deltaItems > 0) {
    const [course] = await db.select().from(courses).where(eq(courses.id, existing.courseId)).limit(1);
    const courseId = course?.id ?? null;
    const log = await db
      .select()
      .from(dayLogs)
      .where(and(eq(dayLogs.date, date), courseId ? eq(dayLogs.courseId, courseId) : isNull(dayLogs.courseId)))
      .limit(1);
    if (log.length === 0) {
      await db.insert(dayLogs).values({
        date,
        courseId,
        minutesLogged: deltaMinutes,
        itemsCompleted: deltaItems,
      });
    } else {
      await db
        .update(dayLogs)
        .set({
          minutesLogged: sql`${dayLogs.minutesLogged} + ${deltaMinutes}`,
          itemsCompleted: sql`${dayLogs.itemsCompleted} + ${deltaItems}`,
        })
        .where(eq(dayLogs.date, date));
    }
  }

  return { ok: true };
}

// Streak: consecutive days with dayLogs.minutesLogged > 0
export async function getStreak(now: Date = new Date()): Promise<number> {
  const rows = await db
    .select({ date: dayLogs.date, total: sql<number>`sum(${dayLogs.minutesLogged})` })
    .from(dayLogs)
    .groupBy(dayLogs.date)
    .orderBy(sql`date desc`)
    .limit(400);

  const active = new Set(rows.filter((r) => Number(r.total) > 0).map((r) => r.date));

  let streak = 0;
  const d = new Date(now);
  // If today not active, start from yesterday (don't break streak if today just hasn't started)
  if (!active.has(d.toISOString().slice(0, 10))) {
    d.setDate(d.getDate() - 1);
  }
  while (active.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

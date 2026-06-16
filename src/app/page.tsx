import { db } from '@/db/client';
import { courses, items } from '@/db/schema';
import { eq, sql, asc } from 'drizzle-orm';
import { buildDailyPlan, getStreak } from '@/lib/plan';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const [plan, streak, activeCourses] = await Promise.all([
    buildDailyPlan(),
    getStreak(),
    db
      .select({
        id: courses.id,
        slug: courses.slug,
        title: courses.title,
        courseNumber: courses.courseNumber,
        imageUrl: courses.imageUrl,
        status: courses.status,
      })
      .from(courses)
      .where(eq(courses.status, 'active'))
      .orderBy(asc(courses.orderIndex), asc(courses.title)),
  ]);

  // Progress per course
  const progress = await Promise.all(
    activeCourses.map(async (c) => {
      const rows = await db
        .select({
          total: sql<number>`count(*)::int`,
          done: sql<number>`count(*) filter (where ${items.status} = 'completed')::int`,
          minutesTotal: sql<number>`coalesce(sum(${items.estimatedMinutes}), 0)::int`,
          minutesDone: sql<number>`coalesce(sum(${items.estimatedMinutes}) filter (where ${items.status} = 'completed'), 0)::int`,
        })
        .from(items)
        .where(eq(items.courseId, c.id));
      return { course: c, ...rows[0] };
    }),
  );

  return (
    <div className="space-y-10">
      {/* Today block */}
      <section>
        <div className="flex items-baseline justify-between mb-1">
          <h1 className="font-serif text-3xl">Today</h1>
          <div className="text-sm text-ink-500 tabular">
            {new Date(plan.date + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </div>
        <div className="text-sm text-ink-600 mb-4">
          {plan.lines.length === 0 ? (
            <span>Nothing scheduled. Drop a new course folder or mark items as in-progress.</span>
          ) : (
            <span>
              <span className="font-medium text-accent">{plan.scheduledMinutes}min</span> planned of{' '}
              <span className="tabular">{plan.budgetMinutes}min</span> budget
              {plan.overdueCount > 0 && <span className="text-red-700"> · {plan.overdueCount} overdue</span>}
            </span>
          )}
        </div>

        {plan.lines.length > 0 && (
          <ul className="bg-white border border-ink-200 rounded-xl divide-y divide-ink-100 shadow-sm">
            {plan.lines.map((line, i) => (
              <li key={line.itemId} className="flex items-start gap-3 px-5 py-3">
                <span className="text-xs text-ink-400 tabular mt-1 w-6">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-ink-500 mb-1">
                    <span className="uppercase tracking-wide font-medium">{line.type}</span>
                    <span>·</span>
                    <a href={`/courses/${line.courseSlug}`} className="hover:text-accent">
                      {line.courseTitle}
                    </a>
                    {line.estimatedMinutes > 0 && (
                      <>
                        <span>·</span>
                        <span className="tabular">{line.estimatedMinutes}m</span>
                      </>
                    )}
                  </div>
                  <a
                    href={`/courses/${line.courseSlug}/items/${line.itemId}`}
                    className="font-medium text-ink-900 hover:text-accent"
                  >
                    {line.title}
                  </a>
                  <div className="flex gap-3 mt-1 text-xs">
                    {line.youtubeKey && (
                      <a
                        href={`https://www.youtube.com/watch?v=${line.youtubeKey}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-red-700 hover:underline"
                      >
                        ▶ video
                      </a>
                    )}
                    {line.pdfPath && (
                      <a href={line.pdfPath} target="_blank" rel="noreferrer" className="text-ink-600 hover:underline">
                        📄 pdf
                      </a>
                    )}
                  </div>
                </div>
                <form action={`/api/plan/complete`} method="POST">
                  <input type="hidden" name="itemId" value={line.itemId} />
                  <button
                    type="submit"
                    className="text-xs px-3 py-1.5 border border-ink-300 rounded-md hover:bg-ink-50"
                    title="Mark complete"
                  >
                    done
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Stats */}
      <section className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-ink-200 rounded-xl p-5">
          <div className="text-xs uppercase tracking-wide text-ink-500">Streak</div>
          <div className="mt-1 text-3xl font-serif tabular">{streak}</div>
          <div className="text-xs text-ink-500">day{streak === 1 ? '' : 's'}</div>
        </div>
        <div className="bg-white border border-ink-200 rounded-xl p-5">
          <div className="text-xs uppercase tracking-wide text-ink-500">Active courses</div>
          <div className="mt-1 text-3xl font-serif tabular">{activeCourses.length}</div>
        </div>
        <div className="bg-white border border-ink-200 rounded-xl p-5">
          <div className="text-xs uppercase tracking-wide text-ink-500">Budget</div>
          <div className="mt-1 text-3xl font-serif tabular">{plan.budgetMinutes}</div>
          <div className="text-xs text-ink-500">min / day</div>
        </div>
      </section>

      {/* Course progress */}
      <section>
        <h2 className="font-serif text-2xl mb-3">Courses</h2>
        {progress.length === 0 ? (
          <div className="bg-white border border-dashed border-ink-300 rounded-xl p-8 text-center text-ink-500">
            No courses imported. Visit <a href="/admin" className="text-accent underline">admin</a> to import.
          </div>
        ) : (
          <ul className="space-y-3">
            {progress.map(({ course, total, done, minutesTotal, minutesDone }) => {
              const pct = total > 0 ? Math.round((Number(done) / Number(total)) * 100) : 0;
              return (
                <li
                  key={course.id}
                  className="bg-white border border-ink-200 rounded-xl p-5 flex items-center gap-5"
                >
                  {course.imageUrl && (
                    <img
                      src={course.imageUrl}
                      alt=""
                      className="w-16 h-16 object-cover rounded-md border border-ink-200"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <a href={`/courses/${course.slug}`} className="font-medium text-ink-900 hover:text-accent">
                      {course.courseNumber ? `${course.courseNumber} — ` : ''}
                      {course.title}
                    </a>
                    <div className="text-xs text-ink-500 mt-0.5 tabular">
                      {String(done)}/{String(total)} items · {minutesDone}m / {minutesTotal}m
                    </div>
                    <div className="mt-2 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-2xl font-serif tabular text-ink-700">{pct}%</div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

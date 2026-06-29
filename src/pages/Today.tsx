import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fileUrl, type TodayView } from '@/lib/api';

export default function Today() {
  const [data, setData] = useState<TodayView | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try { setData(await api.todayGet()); setErr(null); }
    catch (e: any) { setErr(String(e)); }
  }
  useEffect(() => { load(); }, []);

  async function complete(itemId: string) {
    await api.markItemComplete(itemId, 'completed');
    load();
  }

  if (err) return <div className="text-red-700 text-sm">Error: {err}</div>;
  if (!data) return <div className="text-ink-500">Loading…</div>;

  const { plan, streak, progress } = data;
  const dateStr = new Date(plan.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-baseline justify-between mb-1">
          <h1 className="font-serif text-3xl">Today</h1>
          <div className="text-sm text-ink-500 tabular">{dateStr}</div>
        </div>
        <div className="text-sm text-ink-600 mb-4">
          {plan.lines.length === 0 ? (
            <span>Nothing scheduled. Import a course folder in <Link to="/admin" className="text-accent underline">admin</Link>.</span>
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
                <span className="text-xs text-ink-400 tabular mt-1 w-6">{String(i + 1).padStart(2, '0')}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-ink-500 mb-1">
                    <span className="uppercase tracking-wide font-medium">{line.type}</span>
                    <span>·</span>
                    <Link to={`/courses/${line.courseSlug}`} className="hover:text-accent">{line.courseTitle}</Link>
                    {line.estimatedMinutes > 0 && (<><span>·</span><span className="tabular">{line.estimatedMinutes}m</span></>)}
                  </div>
                  <Link to={`/courses/${line.courseSlug}/items/${line.itemId}`} className="font-medium text-ink-900 hover:text-accent">
                    {line.title}
                  </Link>
                  <div className="flex gap-3 mt-1 text-xs">
                    {line.youtubeKey && (
                      <Link to={`/courses/${line.courseSlug}/items/${line.itemId}`} className="text-red-700 hover:underline">▶ video</Link>
                    )}
                    {line.pdfPath && (
                      <Link to={`/courses/${line.courseSlug}/items/${line.itemId}`} className="text-ink-600 hover:underline">📄 pdf</Link>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => complete(line.itemId)}
                  className="text-xs px-3 py-1.5 border border-ink-300 rounded-md hover:bg-ink-50"
                  title="Mark complete"
                >
                  done
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-3 gap-4">
        <Stat label="Streak" value={streak} sub={`day${streak === 1 ? '' : 's'}`} />
        <Stat label="Active courses" value={progress.length} />
        <Stat label="Budget" value={plan.budgetMinutes} sub="min / day" />
      </section>

      <section>
        <h2 className="font-serif text-2xl mb-3">Courses</h2>
        {progress.length === 0 ? (
          <div className="bg-white border border-dashed border-ink-300 rounded-xl p-8 text-center text-ink-500">
            No courses imported. Visit <Link to="/admin" className="text-accent underline">admin</Link> to import.
          </div>
        ) : (
          <ul className="space-y-3">
            {progress.map(({ course, total, done, minutesTotal, minutesDone }) => {
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <li key={course.id} className="bg-white border border-ink-200 rounded-xl p-5 flex items-center gap-5">
                  {course.imageUrl && (
                    <img src={fileUrl(course.imageUrl) ?? ''} alt="" className="w-16 h-16 object-cover rounded-md border border-ink-200" />
                  )}
                  <div className="flex-1 min-w-0">
                    <Link to={`/courses/${course.slug}`} className="font-medium text-ink-900 hover:text-accent">
                      {course.courseNumber ? `${course.courseNumber} — ` : ''}{course.title}
                    </Link>
                    <div className="text-xs text-ink-500 mt-0.5 tabular">
                      {done}/{total} items · {minutesDone}m / {minutesTotal}m
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

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-white border border-ink-200 rounded-xl p-5">
      <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-1 text-3xl font-serif tabular">{value}</div>
      {sub && <div className="text-xs text-ink-500">{sub}</div>}
    </div>
  );
}

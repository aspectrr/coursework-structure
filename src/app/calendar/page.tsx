import { db } from '@/db/client';
import { dayLogs } from '@/db/schema';
import { desc, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const fmt = (d: Date) => d.toISOString().slice(0, 10);

export default async function CalendarPage() {
  // Last 8 weeks of day logs
  const today = new Date();
  const weeksAgo = new Date(today);
  weeksAgo.setDate(weeksAgo.getDate() - 56);

  const rows = await db
    .select({
      date: dayLogs.date,
      minutes: sql<number>`coalesce(sum(${dayLogs.minutesLogged}), 0)::int`,
      items: sql<number>`coalesce(sum(${dayLogs.itemsCompleted}), 0)::int`,
    })
    .from(dayLogs)
    .where(sql`${dayLogs.date} >= ${fmt(weeksAgo)}`)
    .groupBy(dayLogs.date)
    .orderBy(desc(dayLogs.date));

  const byDate = new Map(rows.map((r: any) => [r.date as string, r]));

  // Build grid: 8 cols x 7 rows (weekdays), aligned to last 56 days
  const days: Date[] = [];
  const start = new Date(today);
  start.setDate(start.getDate() - 55);
  // Align start to a Sunday
  while (start.getDay() !== 0) start.setDate(start.getDate() - 1);
  for (let i = 0; i < 56; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl">Calendar</h1>

      <section className="bg-white border border-ink-200 rounded-xl p-5">
        <div className="text-sm text-ink-600 mb-3">last 8 weeks · minutes logged</div>
        <div className="grid grid-cols-8 gap-1">
          {Array.from({ length: 7 }).map((_, row) =>
            Array.from({ length: 8 }).map((_, col) => {
              const idx = col * 7 + row;
              const d = days[idx];
              if (!d) return <div key={`${row}-${col}`} />;
              const iso = fmt(d);
              const entry = byDate.get(iso);
              const minutes = entry?.minutes ?? 0;
              const intensity =
                minutes === 0 ? 'bg-ink-100' : minutes < 30 ? 'bg-accent-soft' : minutes < 60 ? 'bg-accent-soft' : 'bg-accent';
              const future = d > today;
              return (
                <div
                  key={iso}
                  title={`${iso} · ${minutes}m`}
                  className={`aspect-square rounded-sm border border-ink-100 ${
                    future ? 'bg-ink-50 opacity-40' : intensity
                  }`}
                />
              );
            }),
          )}
        </div>
        <div className="mt-4 text-xs text-ink-500 flex items-center gap-2">
          less
          <span className="w-3 h-3 bg-ink-100 rounded-sm" />
          <span className="w-3 h-3 bg-accent-soft rounded-sm" />
          <span className="w-3 h-3 bg-accent rounded-sm" />
          more
        </div>
      </section>

      <section>
        <h2 className="font-serif text-xl mb-3">Recent sessions</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-500">No activity yet. Mark items as complete to populate this.</p>
        ) : (
          <ul className="bg-white border border-ink-200 rounded-xl divide-y divide-ink-100">
            {rows.slice(0, 20).map((r) => (
              <li key={r.date} className="px-5 py-2.5 flex items-baseline gap-4 text-sm tabular">
                <span className="text-ink-700 w-28">{r.date}</span>
                <span className="text-ink-900">{r.minutes}m</span>
                <span className="text-ink-500">{r.items} item{r.items === 1 ? '' : 's'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

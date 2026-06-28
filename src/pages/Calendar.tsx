import { useEffect, useState } from 'react';
import { api, type CalendarView } from '@/lib/api';

export default function Calendar() {
  const [data, setData] = useState<CalendarView | null>(null);
  useEffect(() => { api.calendarGet().then(setData).catch(console.error); }, []);
  if (!data) return <div className="text-ink-500">Loading…</div>;

  const intensity = (m: number) =>
    m === 0 ? 'bg-ink-100' : m < 30 ? 'bg-accent-soft/60' : m < 60 ? 'bg-accent-soft' : 'bg-accent';

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl">Calendar</h1>

      <section className="bg-white border border-ink-200 rounded-xl p-5">
        <div className="text-sm text-ink-600 mb-3">last 8 weeks · minutes logged</div>
        <div className="grid grid-cols-8 gap-1">
          {Array.from({ length: 7 }).map((_, row) =>
            Array.from({ length: 8 }).map((_, col) => {
              const idx = col * 7 + row;
              const cell = data.days[idx];
              if (!cell) return <div key={`${row}-${col}`} />;
              return (
                <div
                  key={cell.date}
                  title={`${cell.date} · ${cell.minutes}m`}
                  className={`aspect-square rounded-sm border border-ink-100 ${cell.future ? 'bg-ink-50 opacity-40' : intensity(cell.minutes)}`}
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
        {data.recent.length === 0 ? (
          <p className="text-sm text-ink-500">No activity yet. Mark items as complete to populate this.</p>
        ) : (
          <ul className="bg-white border border-ink-200 rounded-xl divide-y divide-ink-100">
            {data.recent.map((r) => (
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

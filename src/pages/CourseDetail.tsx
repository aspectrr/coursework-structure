import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fileUrl, type CourseDetail } from '@/lib/api';

export default function CourseDetail() {
  const { slug = '' } = useParams();
  const [data, setData] = useState<CourseDetail | null>(null);

  useEffect(() => { api.courseDetail(slug).then(setData).catch(console.error); }, [slug]);
  if (!data) return <div className="text-ink-500">Loading…</div>;

  const { course, items } = data;
  const total = items.length;
  const done = items.filter((i) => i.status === 'completed').length;
  const minutesTotal = items.reduce((s, i) => s + (i.estimatedMinutes ?? 0), 0);
  const minutesDone = items.filter((i) => i.status === 'completed').reduce((s, i) => s + (i.estimatedMinutes ?? 0), 0);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-8">
      <header className="flex items-start gap-5">
        {course.imageUrl && (
          <img src={fileUrl(course.imageUrl) ?? ''} alt="" className="w-24 h-24 object-cover rounded-lg border border-ink-200" />
        )}
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-ink-500">{course.courseNumber}</div>
          <h1 className="font-serif text-3xl">{course.title}</h1>
          {course.term && <div className="text-sm text-ink-500 mt-1">{course.term} {course.year}</div>}
          {course.description && <p className="text-sm text-ink-600 mt-3 max-w-2xl">{course.description}</p>}
          <div className="mt-3 text-xs text-ink-500 tabular">
            {done}/{total} items · {minutesDone}m / {minutesTotal}m
          </div>
          <div className="mt-2 h-1.5 bg-ink-100 rounded-full overflow-hidden max-w-md">
            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      <section>
        <h2 className="font-serif text-xl mb-3">Items</h2>
        <ul className="bg-white border border-ink-200 rounded-xl divide-y divide-ink-100">
          {items.map((item) => (
            <li key={item.id} className="px-5 py-3 flex items-center gap-4">
              <input
                type="checkbox"
                className="cbox"
                checked={item.status === 'completed'}
                onChange={async () => {
                  await api.markItemComplete(item.id, item.status === 'completed' ? 'not_started' : 'completed');
                  setData(await api.courseDetail(slug));
                }}
              />
              <div className="flex-1 min-w-0">
                <Link to={`/courses/${slug}/items/${item.id}`} className="font-medium text-ink-900 hover:text-accent">
                  {item.title}
                </Link>
                <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-2">
                  <span className="uppercase tracking-wide">{item.type}</span>
                  {item.estimatedMinutes != null && <span>· {item.estimatedMinutes}m</span>}
                  {item.youtubeKey && <span className="text-red-700">· ▶ video</span>}
                  {item.pdfPath && <span className="text-ink-600">· 📄 pdf</span>}
                </div>
              </div>
              <span className="text-xs text-ink-400 uppercase">{item.status.replace('_', ' ')}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

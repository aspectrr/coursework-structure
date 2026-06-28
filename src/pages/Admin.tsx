import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Course, type ImportResult } from '@/lib/api';

export default function Admin() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesDir, setCoursesDir] = useState<string>('');
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [summary, setSummary] = useState('');
  const [preview, setPreview] = useState<string[] | null>(null);

  async function load() {
    const [cs, dir] = await Promise.all([api.adminListCourses(), api.getCoursesDir()]);
    setCourses(cs);
    setCoursesDir(dir);
    try {
      setPreview(await api.previewImport());
    } catch { setPreview(null); }
  }
  useEffect(() => { load(); }, []);

  async function runImport() {
    setState('running');
    setSummary('');
    try {
      const { results } = await api.adminImport();
      const lines = results.map((r: ImportResult) =>
        `${r.ok ? (r.updated ? '↻' : '✓') : '✗'} ${r.slug} — ${r.title}${r.error ? ` (${r.error})` : ''}`,
      );
      setSummary(lines.join('\n') || 'no courses found');
      setState('done');
      load();
    } catch (e: any) {
      setSummary(String(e));
      setState('error');
    }
  }

  async function pickFolder() {
    const picked = await api.pickCoursesDir();
    if (picked) {
      setCoursesDir(picked);
      try { setPreview(await api.previewImport()); } catch { setPreview(null); }
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl">admin</h1>

      <section className="bg-white border border-ink-200 rounded-xl p-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-xl">Courses folder</h2>
          <code className="text-xs bg-ink-100 px-2 py-1 rounded break-all">{coursesDir}</code>
        </div>
        <p className="text-sm text-ink-600 mt-2">
          Point this at your MIT OCW downloads. App scans recursively for folders containing <code className="bg-ink-100 px-1 rounded">data.json</code>.
        </p>
        <button
          type="button"
          onClick={pickFolder}
          className="mt-4 px-4 py-2 border border-ink-300 rounded-md text-sm hover:bg-ink-50"
        >
          Choose folder…
        </button>
        {preview && preview.length > 0 && (
          <div className="mt-3 text-xs text-ink-500">
            {preview.length} course folder{preview.length === 1 ? '' : 's'} detected:
            <ul className="mt-1 ml-4 list-disc">
              {preview.slice(0, 5).map((p) => <li key={p} className="font-mono">{p}</li>)}
              {preview.length > 5 && <li>…and {preview.length - 5} more</li>}
            </ul>
          </div>
        )}
      </section>

      <section className="bg-white border border-ink-200 rounded-xl p-5">
        <h2 className="font-serif text-xl">Import courses</h2>
        <p className="text-sm text-ink-600 mt-2">
          Re-import is idempotent and preserves completion status.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={runImport}
            disabled={state === 'running'}
            className="px-4 py-2 bg-accent text-white text-sm rounded-md hover:bg-accent-dim disabled:opacity-50"
          >
            {state === 'running' ? 'importing…' : 'import / re-sync'}
          </button>
          {summary && (
            <pre className="mt-3 text-xs bg-ink-50 border border-ink-200 rounded-md p-3 whitespace-pre-wrap font-mono">
              {summary}
            </pre>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-xl mb-3">Database ({courses.length})</h2>
        {courses.length === 0 ? (
          <p className="text-sm text-ink-500">No courses yet.</p>
        ) : (
          <ul className="bg-white border border-ink-200 rounded-xl divide-y divide-ink-100">
            {courses.map((c) => (
              <li key={c.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1">
                  <Link to={`/courses/${c.slug}`} className="font-medium hover:text-accent">
                    {c.courseNumber} — {c.title}
                  </Link>
                  <div className="text-xs text-ink-500 mt-0.5">
                    {c.term} {c.year} · imported {new Date(c.importedAt).toLocaleDateString()}
                  </div>
                </div>
                <code className="text-xs text-ink-500">{c.status}</code>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

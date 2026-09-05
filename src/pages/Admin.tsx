import { createSignal, For, onMount, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { api, type Course, type ImportResult } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function Admin() {
  const [courses, setCourses] = createSignal<Course[]>([]);
  const [coursesDir, setCoursesDir] = createSignal('');
  const [preview, setPreview] = createSignal<string[] | null>(null);
  const [status, setStatus] = createSignal<'idle' | 'running' | 'done' | 'error'>('idle');
  const [summary, setSummary] = createSignal('');

  async function load() {
    const [cs, dir] = await Promise.all([api.adminListCourses(), api.getCoursesDir()]);
    setCourses(cs);
    setCoursesDir(dir);
    try {
      setPreview(await api.previewImport());
    } catch {
      setPreview(null);
    }
  }
  onMount(load);

  async function runImport() {
    setStatus('running');
    setSummary('');
    try {
      const { results } = await api.adminImport();
      const lines = results.map(
        (r: ImportResult) =>
          `${r.ok ? (r.updated ? '↻' : '✓') : '✗'} ${r.slug} — ${r.title}${r.error ? ` (${r.error})` : ''}`,
      );
      setSummary(lines.join('\n') || 'no courses found');
      setStatus('done');
      load();
    } catch (e) {
      setSummary(String(e));
      setStatus('error');
    }
  }

  async function pickFolder() {
    const picked = await api.pickCoursesDir();
    if (picked) {
      setCoursesDir(picked);
      try {
        setPreview(await api.previewImport());
      } catch {
        setPreview(null);
      }
    }
  }

  return (
    <div class="space-y-8">
      <div>
        <span class="eyebrow">Library setup</span>
        <span class="eyebrow-wave" />
      </div>
      <h1 class="font-serif text-heading font-bold text-true-black">admin</h1>

      <Card class="space-y-2">
        <div class="flex items-baseline justify-between gap-4">
          <h2 class="font-serif text-heading-sm font-bold text-true-black">Courses folder</h2>
          <code class="break-all rounded-lg bg-cream-paper px-2 py-1 text-xs text-stone">{coursesDir()}</code>
        </div>
        <p class="text-body-sm text-stone">
          Point this at your MIT OCW downloads. App scans recursively for folders containing{' '}
          <code class="rounded bg-cream-paper px-1">data.json</code>.
        </p>
        <div>
          <Button variant="outline" class="mt-2" onClick={pickFolder}>
            Choose folder…
          </Button>
        </div>
        <Show when={preview() && preview()!.length > 0}>
          <div class="text-xs text-stone">
            {preview()!.length} course folder{preview()!.length === 1 ? '' : 's'} detected:
            <ul class="ml-4 mt-1 list-disc">
              <For each={preview()!.slice(0, 5)}>{(p) => <li class="font-mono">{p}</li>}</For>
              <Show when={preview()!.length > 5}>
                <li>…and {preview()!.length - 5} more</li>
              </Show>
            </ul>
          </div>
        </Show>
      </Card>

      <Card class="space-y-2">
        <h2 class="font-serif text-heading-sm font-bold text-true-black">Import courses</h2>
        <p class="text-body-sm text-stone">Re-import is idempotent and preserves completion status.</p>
        <div class="mt-2">
          <Button onClick={runImport} disabled={status() === 'running'}>
            {status() === 'running' ? 'importing…' : 'import / re-sync'}
          </Button>
          <Show when={summary()}>
            <pre class="mt-3 whitespace-pre-wrap rounded-lg border border-fog bg-cream-paper p-3 font-mono text-xs text-stone">
              {summary()}
            </pre>
          </Show>
        </div>
      </Card>

      <section>
        <h2 class="mb-3 font-serif text-heading-sm font-bold text-true-black">
          Database ({courses().length})
        </h2>
        <Show
          when={courses().length}
          fallback={<p class="text-body-sm text-stone">No courses yet.</p>}
        >
          <ul class="divide-y divide-fog rounded-lg border border-fog bg-pure-white">
            <For each={courses()}>
              {(c) => (
                <li class="flex items-center gap-4 px-5 py-3">
                  <div class="flex-1">
                    <A href={`/courses/${c.slug}`} class="font-medium text-true-black hover:text-moss">
                      {c.courseNumber} — {c.title}
                    </A>
                    <div class="mt-0.5 text-xs text-stone">
                      {c.term} {c.year} · imported {new Date(c.importedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <code class="text-xs text-stone">{c.status}</code>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </section>
    </div>
  );
}

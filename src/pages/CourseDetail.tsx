import { createResource, For, Show } from 'solid-js';
import { A, useParams } from '@solidjs/router';
import { api, fileUrl, type CourseDetail } from '@/lib/api';
import { Checkbox } from '@/components/ui/checkbox';

export default function CourseDetail() {
  const params = useParams();
  const [data, { refetch }] = createResource<CourseDetail>(() => api.courseDetail(params.slug ?? ''));

  const stats = () => {
    const items = data()?.items ?? [];
    const total = items.length;
    const done = items.filter((i) => i.status === 'completed').length;
    const minutesTotal = items.reduce((s, i) => s + (i.estimatedMinutes ?? 0), 0);
    const minutesDone = items
      .filter((i) => i.status === 'completed')
      .reduce((s, i) => s + (i.estimatedMinutes ?? 0), 0);
    return { total, done, minutesTotal, minutesDone, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  return (
    <div class="space-y-8">
      <header class="flex items-start gap-5">
        <Show when={data()?.course.imageUrl}>
          <img src={fileUrl(data()!.course.imageUrl) ?? ''} alt="" class="h-24 w-24 rounded-lg border border-fog object-cover" />
        </Show>
        <div class="flex-1">
          <div class="eyebrow">{data()?.course.courseNumber}</div>
          <h1 class="font-serif text-heading font-bold text-true-black">{data()?.course.title}</h1>
          <Show when={data()?.course.term}>
            <div class="mt-1 text-body-sm text-stone">{data()!.course.term} {data()!.course.year}</div>
          </Show>
          <Show when={data()?.course.description}>
            <p class="mt-3 max-w-2xl text-body-sm text-stone">{data()!.course.description}</p>
          </Show>
          <div class="tabular mt-3 text-xs text-stone">
            {stats().done}/{stats().total} items · {stats().minutesDone}m / {stats().minutesTotal}m
          </div>
          <div class="mt-2 h-1.5 max-w-md overflow-hidden rounded-pill bg-fog">
            <div class="h-full bg-moss" style={{ width: `${stats().pct}%` }} />
          </div>
        </div>
      </header>

      <section>
        <h2 class="mb-3 font-serif text-heading-sm font-bold text-true-black">Items</h2>
        <ul class="divide-y divide-fog rounded-lg border border-fog bg-pure-white">
          <For each={data()?.items}>
            {(item) => (
              <li class="flex items-center gap-4 px-5 py-3">
                <Checkbox
                  aria-label={`Mark ${item.title} ${item.status === 'completed' ? 'incomplete' : 'complete'}`}
                  checked={item.status === 'completed'}
                  onChange={async (checked) => {
                    await api.markItemComplete(item.id, checked ? 'completed' : 'not_started');
                    refetch();
                  }}
                />
                <div class="min-w-0 flex-1">
                  <A href={`/courses/${params.slug}/items/${item.id}`} class="font-medium text-true-black hover:text-moss">
                    {item.title}
                  </A>
                  <div class="mt-0.5 flex items-center gap-2 text-xs text-stone">
                    <span class="uppercase tracking-[0.05em]">{item.type}</span>
                    <Show when={item.estimatedMinutes != null}>
                      <span>· {item.estimatedMinutes}m</span>
                    </Show>
                    <Show when={item.youtubeKey}>
                      <span class="text-moss">· ▶ video</span>
                    </Show>
                    <Show when={item.pdfPath}>
                      <span>· 📄 pdf</span>
                    </Show>
                  </div>
                </div>
                <span class="text-xs uppercase text-ash">{item.status.replace('_', ' ')}</span>
              </li>
            )}
          </For>
        </ul>
      </section>
    </div>
  );
}

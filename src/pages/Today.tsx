import { createResource, For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { api, fileUrl, type TodayView } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function Today() {
  const [data, { refetch }] = createResource<TodayView>(api.todayGet);

  // ponytail: swap for real empty-state copy if error states become common
  const errMsg = () => (data.error ? String(data.error) : null);

  async function complete(itemId: string) {
    await api.markItemComplete(itemId, 'completed');
    refetch();
  }

  const dateStr = () =>
    data() &&
    new Date(data()!.plan.date + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });

  return (
    <div class="space-y-10">
      <Show when={errMsg()}>
        <div class="rounded-lg border-[1.5px] border-ember-coral bg-coral-whisper p-4 font-mono text-body-sm text-midnight-ink">
          backend error: {errMsg()}
        </div>
      </Show>
      <section>
        <div class="mb-1 flex items-baseline justify-between">
          <div>
            <span class="eyebrow">Daily plan</span>
            <span class="eyebrow-wave" />
          </div>
          <div class="tabular text-body-sm text-stone">{dateStr()}</div>
        </div>
        <h1 class="font-serif text-heading font-bold text-true-black">Today</h1>
        <div class="mb-4 text-body-sm text-stone">
          <Show
            when={data()?.plan.lines.length}
            fallback={
              <>
                Nothing scheduled. Import a course folder in{' '}
                <A href="/admin" class="text-moss underline">admin</A>.
              </>
            }
          >
            <span>
              <span class="font-medium text-moss">{data()!.plan.scheduledMinutes}min</span> planned of{' '}
              <span class="tabular">{data()!.plan.budgetMinutes}min</span> budget
              <Show when={data()!.plan.overdueCount > 0}>
                <span class="text-ember-coral"> · {data()!.plan.overdueCount} overdue</span>
              </Show>
            </span>
          </Show>
        </div>

        <Show when={data()?.plan.lines.length}>
          <ul class="divide-y divide-fog rounded-lg border border-fog bg-pure-white">
            <For each={data()!.plan.lines}>
              {(line, i) => (
                <li class="flex items-start gap-3 px-5 py-3">
                  <span class="tabular mt-1 w-6 text-xs text-ash">{String(i() + 1).padStart(2, '0')}</span>
                  <div class="min-w-0 flex-1">
                    <div class="mb-1 flex items-center gap-2 text-xs text-stone">
                      <span class="font-medium uppercase tracking-[0.05em]">{line.type}</span>
                      <span>·</span>
                      <A href={`/courses/${line.courseSlug}`} class="hover:text-moss">{line.courseTitle}</A>
                      <Show when={line.estimatedMinutes > 0}>
                        <><span>·</span><span class="tabular">{line.estimatedMinutes}m</span></>
                      </Show>
                    </div>
                    <A
                      href={`/courses/${line.courseSlug}/items/${line.itemId}`}
                      class="font-medium text-true-black hover:text-moss"
                    >
                      {line.title}
                    </A>
                    <div class="mt-1 flex gap-3 text-xs">
                      <Show when={line.youtubeKey}>
                        <A href={`/courses/${line.courseSlug}/items/${line.itemId}`} class="text-moss hover:underline">
                          ▶ video
                        </A>
                      </Show>
                      <Show when={line.pdfPath}>
                        <A href={`/courses/${line.courseSlug}/items/${line.itemId}`} class="text-stone hover:underline">
                          📄 pdf
                        </A>
                      </Show>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => complete(line.itemId)} title="Mark complete">
                    done
                  </Button>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </section>

      <section class="grid grid-cols-3 gap-4">
        <Stat label="Streak" value={data()?.streak ?? 0} sub={data()?.streak === 1 ? 'day' : 'days'} />
        <Stat label="Active courses" value={data()?.progress.length ?? 0} />
        <Stat label="Budget" value={data()?.plan.budgetMinutes ?? 0} sub="min / day" />
      </section>

      <section>
        <h2 class="mb-3 font-serif text-heading-sm font-bold text-true-black">Courses</h2>
        <Show
          when={data()?.progress.length}
          fallback={
            <div class="rounded-lg border border-dashed border-ash bg-pure-white/50 p-8 text-center text-stone">
              No courses imported. Visit <A href="/admin" class="text-moss underline">admin</A> to import.
            </div>
          }
        >
          <ul class="space-y-3">
            <For each={data()!.progress}>
              {({ course, total, done, minutesTotal, minutesDone }) => {
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <li class="flex items-center gap-5 rounded-lg border border-fog bg-pure-white p-5">
                    <Show when={course.imageUrl}>
                      <img src={fileUrl(course.imageUrl) ?? ''} alt="" class="h-16 w-16 rounded-lg border border-fog object-cover" />
                    </Show>
                    <div class="min-w-0 flex-1">
                      <A href={`/courses/${course.slug}`} class="font-medium text-true-black hover:text-moss">
                        {course.courseNumber ? `${course.courseNumber} — ` : ''}{course.title}
                      </A>
                      <div class="tabular mt-0.5 text-xs text-stone">
                        {done}/{total} items · {minutesDone}m / {minutesTotal}m
                      </div>
                      <div class="mt-2 h-1.5 overflow-hidden rounded-pill bg-fog">
                        <div class="h-full bg-moss" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div class="tabular font-serif text-2xl text-midnight-ink">{pct}%</div>
                  </li>
                );
              }}
            </For>
          </ul>
        </Show>
      </section>
    </div>
  );
}

function Stat(props: { label: string; value: number; sub?: string }) {
  return (
    <Card>
      <div class="eyebrow">{props.label}</div>
      <div class="tabular mt-1 font-serif text-3xl text-true-black">{props.value}</div>
      <Show when={props.sub}>
        <div class="text-xs text-stone">{props.sub}</div>
      </Show>
    </Card>
  );
}

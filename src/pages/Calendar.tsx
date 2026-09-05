import { createResource, For, Show } from 'solid-js';
import { api, type CalendarView } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function Calendar() {
  const [data] = createResource<CalendarView>(api.calendarGet);

  const intensity = (m: number) =>
    m === 0 ? 'bg-fog' : m < 30 ? 'bg-moss/30' : m < 60 ? 'bg-moss/60' : 'bg-moss';

  return (
    <div class="space-y-8">
      <div>
        <span class="eyebrow">Activity log</span>
        <span class="eyebrow-wave" />
      </div>
      <h1 class="font-serif text-heading font-bold text-true-black">Calendar</h1>

      <Card class="space-y-3">
        <div class="text-body-sm text-stone">last 8 weeks · minutes logged</div>
        <div class="grid grid-cols-8 gap-1">
          <For each={[0, 1, 2, 3, 4, 5, 6]}>
            {(row) => (
              <For each={[0, 1, 2, 3, 4, 5, 6, 7]}>
                {(col) => {
                  const cell = () => data()?.days[col * 7 + row];
                  return (
                    <Show when={cell()} fallback={<div />}>
                      <div
                        title={`${cell()!.date} · ${cell()!.minutes}m`}
                        class={cn(
                          'aspect-square rounded-[2px] border border-fog/60',
                          cell()!.future ? 'bg-fog/30' : intensity(cell()!.minutes),
                        )}
                      />
                    </Show>
                  );
                }}
              </For>
            )}
          </For>
        </div>
        <div class="flex items-center gap-2 text-xs text-stone">
          less
          <span class="h-3 w-3 rounded-[2px] bg-fog" />
          <span class="h-3 w-3 rounded-[2px] bg-moss/30" />
          <span class="h-3 w-3 rounded-[2px] bg-moss/60" />
          <span class="h-3 w-3 rounded-[2px] bg-moss" />
          more
        </div>
      </Card>

      <section>
        <h2 class="mb-3 font-serif text-heading-sm font-bold text-true-black">Recent sessions</h2>
        <Show
          when={data()?.recent.length}
          fallback={<p class="text-body-sm text-stone">No activity yet. Mark items as complete to populate this.</p>}
        >
          <ul class="divide-y divide-fog rounded-lg border border-fog bg-pure-white">
            <For each={data()!.recent}>
              {(r) => (
                <li class="tabular flex items-baseline gap-4 px-5 py-2.5 text-body-sm">
                  <span class="w-28 text-midnight-ink">{r.date}</span>
                  <span class="text-true-black">{r.minutes}m</span>
                  <span class="text-stone">{r.items} item{r.items === 1 ? '' : 's'}</span>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </section>
    </div>
  );
}

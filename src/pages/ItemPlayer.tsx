import { createResource, Match, Show, Switch } from 'solid-js';
import { A, useParams } from '@solidjs/router';
import { api, fileUrl, type Item } from '@/lib/api';
import { VideoPlayer, type PlayerHandle } from '@/components/VideoPlayer';
import NoteStream from '@/components/NoteStream';
import NoteEditor from '@/components/NoteEditor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function ItemPlayer() {
  const params = useParams();
  const [item, { refetch }] = createResource<Item>(() => api.itemDetail(params.id ?? ''));
  const [course] = createResource(
    () => params.slug ?? '',
    (slug) => api.courseDetail(slug).then((d) => d.course),
  );

  let player: PlayerHandle | undefined;
  const onPlayerReady = (h: PlayerHandle) => {
    player = h;
  };

  return (
    <div class="space-y-5">
      <div class="text-body-sm text-stone">
        <A href={`/courses/${params.slug}`} class="hover:text-moss">{course()?.title ?? params.slug}</A>
        <span class="mx-1">/</span>
        <span class="uppercase tracking-[0.05em]">{item()?.type}</span>
      </div>
      <h1 class="font-serif text-heading-sm font-bold text-true-black">{item()?.title}</h1>
      <Show when={item()?.description}>
        <p class="text-body-sm text-stone">{item()!.description}</p>
      </Show>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Left: media — coral product frame is the one allowed shadow */}
        <div class="space-y-3">
          <Show when={item()} fallback={<div class="text-stone">Loading…</div>}>
            <PlayerMedia item={item()!} onReady={onPlayerReady} onToggle={() => refetch()} />
          </Show>
        </div>

        {/* Right: timestamped notes */}
        <Card class="flex max-h-[640px] min-h-[400px] flex-col">
          <Show when={item()}>
            <NoteStream itemId={item()!.id} player={() => player} hasVideo={!!item()!.youtubeKey} />
          </Show>
        </Card>
      </div>

      {/* Long-form markdown notes (Obsidian-compatible) */}
      <section class="border-t border-fog pt-4">
        <Show when={item()}>
          <NoteEditor
            courseSlug={params.slug ?? ''}
            kind={item()!.type === 'assignment' ? 'assignment' : 'lecture'}
            order={item()!.orderIndex}
            titleSlug={item()!.title}
          />
        </Show>
      </section>
    </div>
  );
}

function PlayerMedia(props: { item: Item; onReady: (h: PlayerHandle) => void; onToggle: () => void }) {
  return (
    <>
      <Switch>
        <Match when={props.item.youtubeKey}>
          {/* Coral product frame around the player */}
          <div class="frame-coral overflow-hidden">
            <VideoPlayer videoId={props.item.youtubeKey!} onReady={props.onReady} />
          </div>
        </Match>
        <Match when={props.item.pdfPath}>
          <div class="frame-coral aspect-[4/5] overflow-hidden bg-pure-white">
            <iframe src={fileUrl(props.item.pdfPath) ?? ''} title="pdf" class="h-full w-full" />
          </div>
        </Match>
        <Match when={props.item.externalUrl}>
          <A href={props.item.externalUrl!} target="_blank" rel="noreferrer" class="text-moss underline">
            Open external resource ↗
          </A>
        </Match>
        <Match when={true}>
          <div class="rounded-lg border border-dashed border-ash bg-pure-white/50 p-8 text-center text-body-sm text-stone">
            No media attached to this item.
          </div>
        </Match>
      </Switch>

      {/* Status controls */}
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await api.markItemComplete(
              props.item.id,
              props.item.status === 'completed' ? 'not_started' : 'completed',
            );
            props.onToggle();
          }}
        >
          {props.item.status === 'completed' ? '✓ completed' : 'mark complete'}
        </Button>
        <Show when={props.item.transcriptPath}>
          <a
            href={fileUrl(props.item.transcriptPath) ?? ''}
            target="_blank"
            rel="noreferrer"
            class="inline-flex h-7 items-center rounded-lg border-[1.5px] border-midnight-ink px-3 text-xs text-midnight-ink hover:bg-midnight-ink hover:text-cream-paper"
          >
            transcript
          </a>
        </Show>
        <span class="tabular ml-auto text-xs text-stone">{props.item.estimatedMinutes ?? '?'}m est.</span>
      </div>
    </>
  );
}

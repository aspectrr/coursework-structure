import { createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { api, fmtTime, type VideoNote } from '@/lib/api';
import type { PlayerHandle } from './VideoPlayer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Props = {
  itemId: string;
  player: () => PlayerHandle | undefined;
  hasVideo: boolean;
};

export default function NoteStream(props: Props) {
  const [notes, setNotes] = createSignal<VideoNote[]>([]);
  const [draft, setDraft] = createSignal('');
  const [editing, setEditing] = createSignal<string | null>(null);
  const [editValue, setEditValue] = createSignal('');

  let pauseTimer: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => {
    if (pauseTimer) clearTimeout(pauseTimer);
  });

  onMount(async () => {
    try {
      setNotes(await api.videoNotesList(props.itemId));
    } catch (e) {
      console.error(e);
    }
  });

  function pauseWhileTyping() {
    props.player()?.pause?.();
    if (pauseTimer) clearTimeout(pauseTimer);
    pauseTimer = setTimeout(() => props.player()?.play?.(), 1500);
  }

  async function create() {
    const trimmed = draft().trim();
    if (!trimmed) return;
    const t = props.hasVideo ? props.player()?.getCurrentTime?.() ?? null : null;
    const secs = t != null ? Math.floor(t) : null;
    const created = await api.videoNotesCreate(props.itemId, trimmed, secs);
    setNotes((prev) => insertSorted(prev, created));
    setDraft('');
  }

  async function saveEdit(id: string) {
    const v = editValue().trim();
    if (!v) return;
    await api.videoNotesUpdate(id, v);
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content: v } : n)));
    setEditing(null);
    setEditValue('');
  }

  async function remove(id: string) {
    await api.videoNotesDelete(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div class="flex h-full flex-col">
      <div class="mb-2 flex items-baseline justify-between">
        <h3 class="font-serif text-lg font-bold text-true-black">Timestamped notes</h3>
        <span class="tabular text-xs text-stone">{notes().length}</span>
      </div>

      <div class="flex-1 space-y-2 overflow-y-auto pr-1">
        <Show when={notes().length} fallback={
          <p class="py-4 text-body-sm italic text-stone">
            {props.hasVideo
              ? 'Press Enter to drop a note — it captures the current video time.'
              : 'Notes for this item.'}
          </p>
        }>
          <For each={notes()}>
            {(n) => (
              <div class="rounded-lg border border-fog bg-pure-white p-3 text-body-sm">
                <div class="mb-1 flex items-baseline gap-2">
                  <Show
                    when={n.videoTimeSeconds != null}
                    fallback={<span class="font-mono text-xs text-ash">no-time</span>}
                  >
                    <button
                      onClick={() => props.hasVideo && props.player()?.seekTo(n.videoTimeSeconds!)}
                      class="tabular font-mono text-xs text-moss hover:underline"
                      title="Seek to this moment"
                    >
                      ▶ {fmtTime(n.videoTimeSeconds)}
                    </button>
                  </Show>
                  <span class="ml-auto text-xs text-ash">{new Date(n.createdAt).toLocaleString()}</span>
                </div>
                <Show
                  when={editing() === n.id}
                  fallback={
                    <>
                      <p class="whitespace-pre-wrap font-mono leading-relaxed text-midnight-ink">{n.content}</p>
                      <div class="mt-1 flex gap-2 text-xs">
                        <button
                          onClick={() => {
                            setEditing(n.id);
                            setEditValue(n.content);
                          }}
                          class="text-stone hover:text-moss"
                        >
                          edit
                        </button>
                        <button onClick={() => remove(n.id)} class="text-stone hover:text-ember-coral">
                          delete
                        </button>
                      </div>
                    </>
                  }
                >
                  <div class="space-y-2">
                    <Textarea value={editValue()} onInput={(e) => setEditValue(e.currentTarget.value)} rows={3} />
                    <div class="flex gap-2">
                      <Button size="sm" onClick={() => saveEdit(n.id)}>save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>cancel</Button>
                    </div>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </Show>
      </div>

      <div class="mt-3 border-t border-fog pt-3">
        <Textarea
          value={draft()}
          onInput={(e) => {
            setDraft(e.currentTarget.value);
            if (props.hasVideo) pauseWhileTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              create();
            }
          }}
          placeholder={
            props.hasVideo
              ? 'Type a note — Enter (⌘/Ctrl) to capture at current video time'
              : 'Type a note — Enter (⌘/Ctrl) to save'
          }
          rows={3}
          class="resize-none"
        />
        <div class="tabular mt-2 flex items-center justify-between text-xs text-stone">
          <span>{props.hasVideo ? `t = ${fmtTime(props.player()?.getCurrentTime?.() ?? null)}` : ''}</span>
          <Button size="sm" onClick={create} disabled={!draft().trim()}>
            add note
          </Button>
        </div>
      </div>
    </div>
  );
}

function insertSorted(notes: VideoNote[], n: VideoNote): VideoNote[] {
  const next = [...notes, n];
  next.sort((a, b) => {
    const at = a.videoTimeSeconds ?? Number.MAX_SAFE_INTEGER;
    const bt = b.videoTimeSeconds ?? Number.MAX_SAFE_INTEGER;
    if (at !== bt) return at - bt;
    return a.createdAt.localeCompare(b.createdAt);
  });
  return next;
}

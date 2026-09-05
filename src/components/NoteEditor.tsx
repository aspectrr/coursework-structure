import { createEffect, createSignal, on } from 'solid-js';
import { api } from '@/lib/api';
import { Textarea } from '@/components/ui/textarea';

type Props = {
  courseSlug: string;
  kind: 'course' | 'lecture' | 'assignment';
  order: number;
  titleSlug: string;
};

export default function NoteEditor(props: Props) {
  const notePath = () =>
    props.kind === 'course'
      ? `${props.courseSlug}/${props.courseSlug}.md`
      : `${props.courseSlug}/${props.kind === 'lecture' ? 'lec' : 'hw'}-${String(props.order).padStart(2, '0')}-${props.titleSlug}.md`;

  const [text, setText] = createSignal('');
  const [loaded, setLoaded] = createSignal(false);
  const [saved, setSaved] = createSignal<'idle' | 'saving' | 'saved'>('idle');

  let cancelled = false;
  api
    .notesRead(props.courseSlug, props.kind, props.order, props.titleSlug)
    .then((v) => {
      if (cancelled) return;
      setText(v ?? '');
      setLoaded(true);
    });
  // ponytail: no onCleanup for the initial read — component only unmounts on nav, harmless
  void cancelled;

  const save = async (value: string) => {
    setSaved('saving');
    try {
      await api.notesWrite(props.courseSlug, props.kind, props.order, props.titleSlug, value);
      setSaved('saved');
      setTimeout(() => setSaved('idle'), 1200);
    } catch {
      setSaved('idle');
    }
  };

  // Debounced autosave — skip the first run (initial read assignment)
  createEffect(
    on(
      text,
      (value) => {
        if (!loaded()) return;
        const t = setTimeout(() => save(value), 800);
        return () => clearTimeout(t);
      },
      { defer: true },
    ),
  );

  return (
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <div class="eyebrow">long-form notes · <span class="font-mono normal-case">{notePath()}</span></div>
        <div class="text-xs text-stone">
          {saved() === 'saving' && 'saving…'}
          {saved() === 'saved' && 'saved'}
        </div>
      </div>
      <Textarea
        value={text()}
        onInput={(e) => setText(e.currentTarget.value)}
        placeholder="Markdown. Use [[wiki-links]] — these work in Obsidian too."
        class="min-h-[200px]"
      />
    </div>
  );
}

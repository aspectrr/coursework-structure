import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

type Props = {
  courseSlug: string;
  kind: 'course' | 'lecture' | 'assignment';
  order: number;
  titleSlug: string;
};

export default function NoteEditor({ courseSlug, kind, order, titleSlug }: Props) {
  const notePath = kind === 'course'
    ? `${courseSlug}/${courseSlug}.md`
    : `${courseSlug}/${kind === 'lecture' ? 'lec' : 'hw'}-${String(order).padStart(2, '0')}-${titleSlug}.md`;

  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    let cancelled = false;
    api.notesRead(courseSlug, kind, order, titleSlug).then((v) => {
      if (cancelled) return;
      setText(v ?? '');
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [courseSlug, kind, order, titleSlug]);

  const save = useCallback(async (value: string) => {
    setSaved('saving');
    try {
      await api.notesWrite(courseSlug, kind, order, titleSlug, value);
      setSaved('saved');
      setTimeout(() => setSaved('idle'), 1200);
    } catch {
      setSaved('idle');
    }
  }, [courseSlug, kind, order, titleSlug]);

  // Debounced autosave
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => save(text), 800);
    return () => clearTimeout(t);
  }, [text, loaded, save]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-ink-500">long-form notes · {notePath}</div>
        <div className="text-xs text-ink-500">
          {saved === 'saving' && 'saving…'}
          {saved === 'saved' && 'saved'}
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Markdown. Use [[wiki-links]] — these work in Obsidian too."
        className="w-full min-h-[200px] font-mono text-sm leading-relaxed p-4 border border-ink-200 rounded-lg bg-white focus:outline-none focus:border-accent resize-y"
      />
    </div>
  );
}

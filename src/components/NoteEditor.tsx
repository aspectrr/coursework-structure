'use client';

import { useState, useEffect, useCallback } from 'react';

type Props = {
  courseSlug: string;
  initialNote: string;
  notePath: string;
  titleSlug: string;
  type: 'course' | 'lecture' | 'assignment';
  order: number | null;
};

export default function NoteEditor({ courseSlug, initialNote, notePath, titleSlug, type, order }: Props) {
  const [text, setText] = useState(initialNote);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (value: string) => {
      setSaved('saving');
      try {
        await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseSlug, type, order, titleSlug, content: value }),
        });
        setSaved('saved');
        setTimeout(() => setSaved('idle'), 1200);
      } catch (e) {
        setSaved('idle');
      }
    },
    [courseSlug, type, order, titleSlug],
  );

  // Debounced autosave
  useEffect(() => {
    if (text === initialNote) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    const t = setTimeout(() => save(text), 800);
    setDebounceTimer(t);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-ink-500">notes · {notePath}</div>
        <div className="text-xs text-ink-500">
          {saved === 'saving' && 'saving…'}
          {saved === 'saved' && 'saved'}
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write markdown here. Use [[links]] to other notes — these work in Obsidian too."
        className="w-full min-h-[400px] font-mono text-sm leading-relaxed p-4 border border-ink-200 rounded-lg bg-white focus:outline-none focus:border-accent resize-y"
      />
      <div className="text-xs text-ink-500">
        Stored as <code className="bg-ink-100 px-1 rounded">{notePath}</code> — open in Obsidian to view graph.
      </div>
    </div>
  );
}

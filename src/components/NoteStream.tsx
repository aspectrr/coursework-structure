import { useEffect, useRef, useState } from 'react';
import { api, fmtTime, type VideoNote } from '@/lib/api';
import type { PlayerHandle } from './VideoPlayer';

type Props = {
  itemId: string;
  playerRef: React.RefObject<PlayerHandle | null>;
  hasVideo: boolean;
};

export default function NoteStream({ itemId, playerRef, hasVideo }: Props) {
  const [notes, setNotes] = useState<VideoNote[]>([]);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  async function load() {
    try { setNotes(await api.videoNotesList(itemId)); }
    catch (e) { console.error(e); }
  }
  useEffect(() => { load(); }, [itemId]);

  function pauseWhileTyping() {
    playerRef.current?.pause?.();
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    pauseTimer.current = setTimeout(() => playerRef.current?.play?.(), 1500);
  }

  async function create() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const t = hasVideo ? playerRef.current?.getCurrentTime?.() ?? null : null;
    const secs = t != null ? Math.floor(t) : null;
    const created = await api.videoNotesCreate(itemId, trimmed, secs);
    setNotes((prev) => insertSorted(prev, created));
    setDraft('');
  }

  async function saveEdit(id: string) {
    const v = editValue.trim();
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
    <div className="flex flex-col h-full">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-serif text-lg">Timestamped notes</h3>
        <span className="text-xs text-ink-500">{notes.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {notes.length === 0 && (
          <p className="text-sm text-ink-500 italic py-4">
            {hasVideo ? 'Press Enter to drop a note — it captures the current video time.' : 'Notes for this item.'}
          </p>
        )}
        {notes.map((n) => (
          <div key={n.id} className="bg-white border border-ink-200 rounded-md p-3 text-sm">
            <div className="flex items-baseline gap-2 mb-1">
              {n.videoTimeSeconds != null ? (
                <button
                  onClick={() => hasVideo && playerRef.current?.seekTo(n.videoTimeSeconds!)}
                  className="text-xs font-mono text-accent hover:underline"
                  title="Seek to this moment"
                >
                  ▶ {fmtTime(n.videoTimeSeconds)}
                </button>
              ) : (
                <span className="text-xs text-ink-400 font-mono">no-time</span>
              )}
              <span className="text-xs text-ink-400 ml-auto">
                {new Date(n.createdAt).toLocaleString()}
              </span>
            </div>
            {editing === n.id ? (
              <div className="space-y-2">
                <textarea
                  ref={taRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full font-mono text-sm border border-ink-200 rounded p-2"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(n.id)} className="text-xs px-2 py-1 bg-accent text-white rounded">save</button>
                  <button onClick={() => setEditing(null)} className="text-xs px-2 py-1 border border-ink-300 rounded">cancel</button>
                </div>
              </div>
            ) : (
              <>
                <p className="whitespace-pre-wrap font-mono leading-relaxed">{n.content}</p>
                <div className="flex gap-2 mt-1 text-xs">
                  <button onClick={() => { setEditing(n.id); setEditValue(n.content); }} className="text-ink-500 hover:text-accent">edit</button>
                  <button onClick={() => remove(n.id)} className="text-ink-500 hover:text-red-700">delete</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-ink-200 mt-3">
        <textarea
          value={draft}
          onChange={(e) => { setDraft(e.target.value); hasVideo && pauseWhileTyping(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); create(); }
          }}
          placeholder={hasVideo ? 'Type a note — Enter (⌘/Ctrl) to capture at current video time' : 'Type a note — Enter (⌘/Ctrl) to save'}
          className="w-full font-mono text-sm p-3 border border-ink-200 rounded-md bg-white focus:outline-none focus:border-accent resize-none"
          rows={3}
        />
        <div className="flex items-center justify-between mt-2 text-xs text-ink-500">
          <span>{hasVideo ? `t = ${fmtTime(playerRef.current?.getCurrentTime?.() ?? null)}` : ''}</span>
          <button
            onClick={create}
            disabled={!draft.trim()}
            className="px-3 py-1 bg-accent text-white rounded disabled:opacity-50"
          >
            add note
          </button>
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

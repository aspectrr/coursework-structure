import { useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fileUrl, type Item, type Course } from '@/lib/api';
import { VideoPlayer, type PlayerHandle } from '@/components/VideoPlayer';
import NoteStream from '@/components/NoteStream';
import NoteEditor from '@/components/NoteEditor';

export default function ItemPlayer() {
  const { slug = '', id = '' } = useParams();
  const [item, setItem] = useState<Item | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const playerRef = useRef<PlayerHandle>(null);

  useEffect(() => {
    api.itemDetail(id).then(setItem).catch(console.error);
    api.courseDetail(slug).then((d) => setCourse(d.course)).catch(console.error);
  }, [id, slug]);

  if (!item) return <div className="text-ink-500">Loading…</div>;

  const hasVideo = !!item.youtubeKey;
  const titleSlug = item.title;

  return (
    <div className="space-y-5">
      <div className="text-xs text-ink-500">
        <Link to={`/courses/${slug}`} className="hover:text-accent">{course?.title ?? slug}</Link>
        <span className="mx-1">/</span>
        <span className="uppercase tracking-wide">{item.type}</span>
      </div>
      <h1 className="font-serif text-2xl">{item.title}</h1>
      {item.description && <p className="text-sm text-ink-600 -mt-2">{item.description}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: media */}
        <div className="space-y-3">
          {hasVideo ? (
            <VideoPlayer ref={playerRef} videoId={item.youtubeKey!} />
          ) : item.pdfPath ? (
            <div className="aspect-[4/5] bg-white border border-ink-200 rounded-lg overflow-hidden">
              <iframe src={fileUrl(item.pdfPath) ?? ''} title="pdf" className="w-full h-full" />
            </div>
          ) : item.externalUrl ? (
            <a href={item.externalUrl} target="_blank" rel="noreferrer" className="text-accent underline">
              Open external resource ↗
            </a>
          ) : (
            <div className="bg-white border border-dashed border-ink-300 rounded-lg p-8 text-center text-ink-500 text-sm">
              No media attached to this item.
            </div>
          )}

          {/* Status controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await api.markItemComplete(item.id, item.status === 'completed' ? 'not_started' : 'completed');
                setItem(await api.itemDetail(id));
              }}
              className="text-xs px-3 py-1.5 border border-ink-300 rounded-md hover:bg-ink-50"
            >
              {item.status === 'completed' ? '✓ completed' : 'mark complete'}
            </button>
            {item.transcriptPath && (
              <a href={fileUrl(item.transcriptPath) ?? ''} target="_blank" rel="noreferrer"
                 className="text-xs px-3 py-1.5 border border-ink-300 rounded-md hover:bg-ink-50">
                transcript
              </a>
            )}
            <span className="ml-auto text-xs text-ink-500">{item.estimatedMinutes ?? '?'}m est.</span>
          </div>
        </div>

        {/* Right: timestamped notes */}
        <div className="bg-ink-50 border border-ink-200 rounded-lg p-4 min-h-[400px] max-h-[640px] flex flex-col">
          <NoteStream itemId={item.id} playerRef={playerRef} hasVideo={hasVideo} />
        </div>
      </div>

      {/* Long-form markdown notes (Obsidian-compatible) */}
      <section className="pt-4 border-t border-ink-200">
        <NoteEditor
          courseSlug={slug}
          kind={item.type === 'assignment' ? 'assignment' : 'lecture'}
          order={item.orderIndex}
          titleSlug={titleSlug}
        />
      </section>
    </div>
  );
}

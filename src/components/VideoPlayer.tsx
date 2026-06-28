import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';

// Minimal YouTube IFrame API typings
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface PlayerHandle {
  seekTo: (sec: number) => void;
  getCurrentTime: () => number | null;
  pause: () => void;
  play: () => void;
}

type Props = { videoId: string };

let apiPromise: Promise<void> | null = null;
function loadApi(): Promise<void> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    if (window.YT && window.YT.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
  });
  return apiPromise;
}

export const VideoPlayer = forwardRef<PlayerHandle, Props>(function VideoPlayer({ videoId }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    seekTo: (sec: number) => playerRef.current?.seekTo(sec, true),
    getCurrentTime: () => playerRef.current?.getCurrentTime?.() ?? null,
    pause: () => playerRef.current?.pauseVideo?.(),
    play: () => playerRef.current?.playVideo?.(),
  }));

  useEffect(() => {
    let cancelled = false;
    loadApi().then(() => {
      if (cancelled || !containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        height: '100%',
        width: '100%',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: { onReady: () => setReady(true) },
      });
    });
    return () => {
      cancelled = true;
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [videoId]);

  return (
    <div className="aspect-video bg-black rounded-lg overflow-hidden">
      <div ref={containerRef} />
      {!ready && (
        <div className="text-white/60 text-xs p-4 -mt-1">Loading player…</div>
      )}
    </div>
  );
});

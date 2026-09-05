import { createEffect, onCleanup } from 'solid-js';

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

let apiPromise: Promise<void> | null = null;
function loadApi(): Promise<void> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    if (window.YT && window.YT.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
  });
  return apiPromise;
}

export function VideoPlayer(props: { videoId: string; onReady?: (h: PlayerHandle) => void }) {
  let wrapper!: HTMLDivElement;
  let yt: any;

  // Stable handle — reads the current player through closure, safe across reloads
  const handle: PlayerHandle = {
    seekTo: (sec) => yt?.seekTo(sec, true),
    getCurrentTime: () => yt?.getCurrentTime?.() ?? null,
    pause: () => yt?.pauseVideo?.(),
    play: () => yt?.playVideo?.(),
  };

  // YT.Player replaces the element you give it with an iframe, so mount a
  // throwaway inner div per instance instead of handing over the wrapper.
  createEffect(() => {
    const videoId = props.videoId;
    let cancelled = false;
    let created: any;
    loadApi().then(() => {
      if (cancelled) return;
      const el = document.createElement('div');
      wrapper.appendChild(el);
      created = new window.YT.Player(el, {
        videoId,
        height: '100%',
        width: '100%',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            yt = created;
            props.onReady?.(handle);
          },
        },
      });
    });
    onCleanup(() => {
      cancelled = true;
      created?.destroy?.();
      yt = undefined;
      wrapper.innerHTML = '';
    });
  });

  return (
    <div class="aspect-video bg-true-black">
      <div ref={wrapper} class="h-full w-full" />
    </div>
  );
}

"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { VideoSource } from "@/lib/media/video-source";

/**
 * One imperative surface over two very different players.
 *
 * The sync layer above only ever calls play / pause / seekTo / getTime, so it
 * doesn't care whether the media is a YouTube embed or a plain <video>.
 * Volume is intentionally *not* part of this interface — it stays local to
 * each device.
 */
export interface VideoHandle {
  play(): void;
  pause(): void;
  seekTo(seconds: number): void;
  getTime(): number;
  getDuration(): number;
  isPlaying(): boolean;
  setRate(rate: number): void;
}

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setPlaybackRate(rate: number): void;
  destroy(): void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement | string, options: Record<string, unknown>) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Loads YouTube's official iframe API once per page. */
let ytReady: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (ytReady) return ytReady;

  ytReady = new Promise<void>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });
  return ytReady;
}

export const VideoSurface = forwardRef<
  VideoHandle,
  {
    source: VideoSource;
    /** Fired on local user-driven play/pause so the room can be told. */
    onLocalPlay?: (time: number) => void;
    onLocalPause?: (time: number) => void;
    onReady?: () => void;
    className?: string;
  }
>(function VideoSurface({ source, onLocalPlay, onLocalPause, onReady, className }, ref) {
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytRef = useRef<YTPlayer | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const callbacks = useRef({ onLocalPlay, onLocalPause, onReady });
  callbacks.current = { onLocalPlay, onLocalPause, onReady };

  // --- YouTube -------------------------------------------------------------
  useEffect(() => {
    if (source.kind !== "youtube") return;
    let cancelled = false;

    void loadYouTubeApi().then(() => {
      if (cancelled || !mountRef.current || !window.YT) return;
      const player = new window.YT.Player(mountRef.current, {
        videoId: source.ref,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          controls: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            setStatus("ready");
            callbacks.current.onReady?.();
          },
          onStateChange: (event: { data: number }) => {
            const state = window.YT?.PlayerState;
            if (!state) return;
            const time = player.getCurrentTime();
            if (event.data === state.PLAYING) callbacks.current.onLocalPlay?.(time);
            if (event.data === state.PAUSED) callbacks.current.onLocalPause?.(time);
          },
          onError: () => setStatus("error"),
        },
      });
      ytRef.current = player;
    });

    return () => {
      cancelled = true;
      try {
        ytRef.current?.destroy();
      } catch {
        /* already gone */
      }
      ytRef.current = null;
    };
  }, [source.kind, source.ref]);

  // --- imperative surface --------------------------------------------------
  useImperativeHandle(
    ref,
    (): VideoHandle => ({
      play() {
        if (source.kind === "youtube") ytRef.current?.playVideo();
        else void videoRef.current?.play().catch(() => undefined);
      },
      pause() {
        if (source.kind === "youtube") ytRef.current?.pauseVideo();
        else videoRef.current?.pause();
      },
      seekTo(seconds) {
        if (source.kind === "youtube") ytRef.current?.seekTo(seconds, true);
        else if (videoRef.current) videoRef.current.currentTime = seconds;
      },
      getTime() {
        if (source.kind === "youtube") return ytRef.current?.getCurrentTime() ?? 0;
        return videoRef.current?.currentTime ?? 0;
      },
      getDuration() {
        if (source.kind === "youtube") return ytRef.current?.getDuration() ?? 0;
        return videoRef.current?.duration ?? 0;
      },
      isPlaying() {
        if (source.kind === "youtube") {
          return ytRef.current?.getPlayerState() === window.YT?.PlayerState.PLAYING;
        }
        const el = videoRef.current;
        return Boolean(el && !el.paused && !el.ended);
      },
      /** Used for gentle drift correction rather than hard seeking. */
      setRate(rate) {
        if (source.kind === "youtube") ytRef.current?.setPlaybackRate(rate);
        else if (videoRef.current) videoRef.current.playbackRate = rate;
      },
    }),
    [source.kind],
  );

  const handleReady = useCallback(() => {
    setStatus("ready");
    callbacks.current.onReady?.();
  }, []);

  return (
    <div className={className}>
      <div className="relative aspect-video w-full overflow-hidden rounded-[24px] bg-[#0f0e12] ring-1 ring-inset ring-line">
        {source.kind === "youtube" ? (
          <div ref={mountRef} className="absolute inset-0 h-full w-full" />
        ) : (
          <video
            ref={videoRef}
            src={source.ref}
            controls
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full bg-black"
            onCanPlay={handleReady}
            onError={() => setStatus("error")}
            onPlay={(e) => callbacks.current.onLocalPlay?.(e.currentTarget.currentTime)}
            onPause={(e) => callbacks.current.onLocalPause?.(e.currentTarget.currentTime)}
          />
        )}

        {status !== "ready" && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <p className="text-[13.5px] font-semibold text-white/70">
              {status === "error" ? "This video can't be played here." : "Loading the player…"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

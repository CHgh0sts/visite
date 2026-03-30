"use client";

import {
  Maximize,
  Minimize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { parseVideoUrl } from "@/lib/videoEmbeds";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function NativeVideoControls({
  src,
  autoplay,
  onPlaybackChange,
}: {
  src: string;
  autoplay: boolean;
  /** true = lecture en cours — utilisé pour suspendre le minuteur d’inactivité. */
  onPlaybackChange?: (playing: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  /** Avec autoplay, masqués par défaut (sinon ils restent visibles tant que la souris n’a pas bougé). */
  const [controlsVisible, setControlsVisible] = useState(() => !autoplay);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sync = () => {
      const el = containerRef.current;
      if (!el) return;
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
      };
      setIsFullscreen(
        document.fullscreenElement === el || doc.webkitFullscreenElement === el,
      );
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener(
        "webkitfullscreenchange",
        sync as EventListener,
      );
    };
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideRef.current) clearTimeout(hideRef.current);
    hideRef.current = setTimeout(() => {
      if (playing) setControlsVisible(false);
    }, 2800);
  }, [playing]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => {
      setPlaying(true);
      setControlsVisible(false);
      onPlaybackChange?.(true);
    };
    const onPause = () => {
      setPlaying(false);
      setControlsVisible(true);
      onPlaybackChange?.(false);
    };
    const onEnded = () => {
      setPlaying(false);
      setControlsVisible(true);
      onPlaybackChange?.(false);
    };
    const onLoaded = () => setDuration(v.duration || 0);
    const onTime = () => setCurrent(v.currentTime);
    const onVol = () => {
      setVolume(v.volume);
      setMuted(v.muted);
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("durationchange", onLoaded);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("volumechange", onVol);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("durationchange", onLoaded);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("volumechange", onVol);
    };
  }, [src, onPlaybackChange]);

  useEffect(() => {
    return () => {
      onPlaybackChange?.(false);
    };
  }, [onPlaybackChange]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    return () => {
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !autoplay) return;
    void v.play().catch(() => {});
  }, [src, autoplay]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  const onSeek = (pct: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = (pct / 100) * duration;
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  };

  const onVolumeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const vol = parseFloat(e.target.value);
    v.volume = vol;
    if (vol === 0) v.muted = true;
    else v.muted = false;
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void>;
    };
    const inFs =
      document.fullscreenElement === el || doc.webkitFullscreenElement === el;
    if (inFs) {
      if (document.exitFullscreen) void document.exitFullscreen();
      else if (doc.webkitExitFullscreen) void doc.webkitExitFullscreen();
      return;
    }
    if (el.requestFullscreen) void el.requestFullscreen();
    else {
      const wk = (
        el as HTMLElement & { webkitRequestFullscreen?: () => void }
      ).webkitRequestFullscreen;
      if (wk) wk.call(el);
    }
  };

  const progressPct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={`site-video-player group relative w-full min-w-0 max-w-full overflow-hidden rounded-lg bg-black ${
        isFullscreen
          ? "flex h-full min-h-0 w-full max-w-none flex-col rounded-none"
          : ""
      }`}
      onMouseEnter={() => {
        setControlsVisible(true);
        scheduleHide();
      }}
      onMouseMove={() => {
        setControlsVisible(true);
        scheduleHide();
      }}
      onMouseLeave={() => {
        if (playing) setControlsVisible(false);
      }}
    >
      <video
        ref={videoRef}
        src={src}
        className={`block w-full max-w-full cursor-pointer object-contain ${
          isFullscreen
            ? "min-h-0 flex-1 max-h-none"
            : "max-h-[min(50vh,480px)]"
        }`}
        playsInline
        preload="metadata"
        autoPlay={autoplay}
        onClick={togglePlay}
      />
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-3 pt-10 transition-opacity duration-200 ${
          controlsVisible ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <input
          type="range"
          min={0}
          max={100}
          step={0.25}
          value={progressPct}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="site-video-player__seek mb-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-sky-500"
          aria-label="Position dans la vidéo"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
            aria-label={playing ? "Pause" : "Lecture"}
          >
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <span className="min-w-[4.5rem] font-mono text-xs text-white/90 tabular-nums">
            {formatTime(current)} / {formatTime(duration)}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
              aria-label={muted ? "Activer le son" : "Couper le son"}
            >
              {muted || volume === 0 ? (
                <VolumeX className="size-5" />
              ) : (
                <Volume2 className="size-5" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={onVolumeInput}
              className="hidden w-20 cursor-pointer sm:block"
              aria-label="Volume"
            />
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
              aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
            >
              {isFullscreen ? (
                <Minimize2 className="size-5" />
              ) : (
                <Maximize className="size-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function embedUrlWithAutoplay(embedUrl: string, autoplay: boolean): string {
  if (!autoplay) return embedUrl;
  try {
    const u = new URL(embedUrl);
    u.searchParams.set("autoplay", "1");
    return u.toString();
  } catch {
    return embedUrl;
  }
}

function EmbedFrame({
  title,
  embedUrl,
  autoplay,
  onPlaybackChange,
}: {
  title: string;
  embedUrl: string;
  autoplay: boolean;
  /** Lecteur intégré : on bloque l’inactivité tant que l’iframe est affichée (pas d’événement « fin » fiable). */
  onPlaybackChange?: (playing: boolean) => void;
}) {
  const src = embedUrlWithAutoplay(embedUrl, autoplay);

  useEffect(() => {
    onPlaybackChange?.(true);
    return () => {
      onPlaybackChange?.(false);
    };
  }, [onPlaybackChange]);

  return (
    <div className="relative aspect-video w-full min-w-0 max-w-full overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
      <iframe
        title={title}
        src={src}
        className="absolute inset-0 size-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
      />
    </div>
  );
}

/**
 * Lecteur vidéo unifié : contrôles custom pour fichiers directs, iframes pour YouTube / Vimeo.
 * @param autoplay Si `false`, la lecture ne démarre pas automatiquement (défaut : true).
 */
export function SiteVideoPlayer({
  url,
  autoplay = true,
  onPlaybackChange,
}: {
  url: string;
  autoplay?: boolean;
  /** true = lecture en cours (fichier) ou iframe affichée (YouTube/Vimeo). */
  onPlaybackChange?: (playing: boolean) => void;
}) {
  const parsed = parseVideoUrl(url);

  if (parsed.kind === "youtube") {
    return (
      <div className="w-full min-w-0 max-w-full">
        <EmbedFrame
          title="Vidéo YouTube"
          embedUrl={parsed.embedUrl}
          autoplay={autoplay}
          onPlaybackChange={onPlaybackChange}
        />
      </div>
    );
  }
  if (parsed.kind === "vimeo") {
    return (
      <div className="w-full min-w-0 max-w-full">
        <EmbedFrame
          title="Vidéo Vimeo"
          embedUrl={parsed.embedUrl}
          autoplay={autoplay}
          onPlaybackChange={onPlaybackChange}
        />
      </div>
    );
  }
  if (parsed.kind === "file") {
    return (
      <div className="w-full min-w-0 max-w-full">
        <NativeVideoControls
          key={parsed.src}
          src={parsed.src}
          autoplay={autoplay}
          onPlaybackChange={onPlaybackChange}
        />
      </div>
    );
  }

  return (
    <p className="w-full min-w-0 max-w-full rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
      URL vidéo non reconnue (utilisez YouTube, Vimeo ou un fichier .mp4 / .webm
      direct).{" "}
      <a
        href={parsed.originalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sky-400 underline"
      >
        Ouvrir le lien
      </a>
    </p>
  );
}

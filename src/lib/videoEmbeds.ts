/** Détection et URLs d’intégration pour le lecteur vidéo du site. */

export function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace(/^\//, "");
      if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube-nocookie.com/embed/${v}`;
      const m = u.pathname.match(/\/embed\/([^/]+)/);
      if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
    }
  } catch {
    return null;
  }
  return null;
}

export function vimeoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (!u.hostname.includes("vimeo.com")) return null;
    const m = u.pathname.match(/\/(?:video\/)?(\d+)/);
    if (m) return `https://player.vimeo.com/video/${m[1]}`;
  } catch {
    return null;
  }
  return null;
}

export function isDirectVideoFile(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?|#|$)/i.test(url.trim());
}

export type ParsedVideoUrl =
  | { kind: "youtube"; embedUrl: string }
  | { kind: "vimeo"; embedUrl: string }
  | { kind: "file"; src: string }
  | { kind: "unknown"; originalUrl: string };

export function parseVideoUrl(url: string): ParsedVideoUrl {
  const trimmed = url.trim();
  const yt = youtubeEmbedUrl(trimmed);
  if (yt) return { kind: "youtube", embedUrl: yt };
  const vm = vimeoEmbedUrl(trimmed);
  if (vm) return { kind: "vimeo", embedUrl: vm };
  if (isDirectVideoFile(trimmed)) return { kind: "file", src: trimmed };
  return { kind: "unknown", originalUrl: trimmed };
}

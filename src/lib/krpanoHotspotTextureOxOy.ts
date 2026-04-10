/**
 * krpano `ox` / `oy` : décalage du hotspot en pixels.
 * - **`edge="center"`** : le point (ath,atv) est le centre visuel — utiliser **`ox=0`, `oy=0`**.
 *   (Des valeurs type largeur/2 décalent l’image en bas à droite par rapport au curseur.)
 * - Autres `edge` : souvent moitié largeur / hauteur pour ancrer la texture selon le fichier.
 */

/** Dimensions connues (fichiers dans `public/`, chemins relatifs au tour). */
const KNOWN_TEXTURE_SIZE_PX: Record<string, { w: number; h: number }> = {
  "krpano-patches/micronique-cross.svg": { w: 56, h: 56 },
  "krpano-patches/micronique-arrow.svg": { w: 56, h: 56 },
  "krpano-patches/micronique-play.svg": { w: 56, h: 56 },
  "krpano-patches/hotspot.svg": { w: 56, h: 56 },
};

function normalizeTexturePath(url: string): string {
  return url.trim().replace(/^\/+/, "");
}

export function hotspotOxOyFromSizePx(w: number, h: number): {
  ox: number;
  oy: number;
} {
  const ww = Math.max(1, Math.round(w));
  const hh = Math.max(1, Math.round(h));
  return { ox: ww / 2, oy: hh / 2 };
}

/**
 * Si l’URL correspond à une texture embarquée connue, retourne ox/oy sans chargement réseau.
 */
export function tryHotspotOxOyFromKnownTexture(
  url: string | undefined,
): { ox: number; oy: number } | null {
  const u = url?.trim();
  if (!u) return null;
  if (u.startsWith("data:image/svg+xml")) {
    return hotspotOxOyFromSizePx(56, 56);
  }
  const key = normalizeTexturePath(u);
  const s = KNOWN_TEXTURE_SIZE_PX[key];
  if (!s) return null;
  return hotspotOxOyFromSizePx(s.w, s.h);
}

function absoluteUrlForImageLoad(relativeOrAbsolute: string): string {
  const u = relativeOrAbsolute.trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  const path = u.startsWith("/") ? u : `/${u}`;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }
  return path;
}

const oxOyByUrlPromise = new Map<string, Promise<{ ox: number; oy: number }>>();

/**
 * Charge la texture (navigateur) pour lire les dimensions, puis calcule ox/oy.
 * Textures connues : synchrone via {@link tryHotspotOxOyFromKnownTexture}.
 */
/**
 * `ox` / `oy` selon `edge` : pour `center`, toujours (0,0) — cohérent avec un clic / fantôme centrés.
 */
export async function resolveHotspotOxOyFromUrlAndEdge(
  url: string,
  edge: string | undefined,
): Promise<{ ox: number; oy: number }> {
  if (edge?.trim().toLowerCase() === "center") {
    return { ox: 0, oy: 0 };
  }
  return resolveHotspotOxOyFromUrl(url);
}

export function resolveHotspotOxOyFromUrl(
  url: string,
): Promise<{ ox: number; oy: number }> {
  const trimmed = url.trim();
  if (!trimmed) {
    return Promise.resolve(hotspotOxOyFromSizePx(56, 56));
  }
  const known = tryHotspotOxOyFromKnownTexture(trimmed);
  if (known) return Promise.resolve(known);

  const cacheKey = normalizeTexturePath(trimmed);
  const existing = oxOyByUrlPromise.get(cacheKey);
  if (existing) return existing;

  const p = new Promise<{ ox: number; oy: number }>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.naturalWidth || 56;
      const h = img.naturalHeight || 56;
      resolve(hotspotOxOyFromSizePx(w, h));
    };
    img.onerror = () => resolve(hotspotOxOyFromSizePx(56, 56));
    img.src = absoluteUrlForImageLoad(trimmed);
  });
  oxOyByUrlPromise.set(cacheKey, p);
  return p;
}

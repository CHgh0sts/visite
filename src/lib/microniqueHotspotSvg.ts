import { KRPANO_XML_HOTSPOT_PRESET_URLS } from "@/lib/krpanoXmlHotspotPresets";
import type { KrpanoXmlHotspotOverride } from "@/types/interactions";

export type MicroniquePresetId = "arrow" | "cross" | "play";

const PRESET_BY_URL = new Map<string, MicroniquePresetId>([
  [KRPANO_XML_HOTSPOT_PRESET_URLS.arrow, "arrow"],
  [KRPANO_XML_HOTSPOT_PRESET_URLS.cross, "cross"],
  [KRPANO_XML_HOTSPOT_PRESET_URLS.microniquePlay, "play"],
]);

function normalizePath(url: string): string {
  return url.trim().replace(/^\/+/, "");
}

/** Indique si l’URL correspond à une texture Micronique (fichier statique du tour). */
export function getMicroniquePresetFromUrl(
  url: string | undefined,
): MicroniquePresetId | null {
  const u = url?.trim();
  if (!u) return null;
  const key = normalizePath(u);
  return PRESET_BY_URL.get(key) ?? null;
}

export function isMicroniquePresetUrl(url: string | undefined): boolean {
  return getMicroniquePresetFromUrl(url) != null;
}

function hex0xToRgb(hex: string): { r: number; g: number; b: number } | null {
  const t = hex.trim().toLowerCase();
  if (!/^0x[0-9a-f]{6}$/.test(t)) return null;
  const n = parseInt(t.slice(2), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbaFromHex0x(hex: string, alpha: number): string | null {
  const rgb = hex0xToRgb(hex);
  if (!rgb) return null;
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
}

function hex0xToSvgHex(hex: string): string | null {
  const rgb = hex0xToRgb(hex);
  if (!rgb) return null;
  const n = (rgb.r << 16) | (rgb.g << 8) | rgb.b;
  return `#${n.toString(16).padStart(6, "0")}`;
}

function buildSvg(preset: MicroniquePresetId, bg0x: string, fg0x: string): string {
  const bgRgba = rgbaFromHex0x(bg0x, 0.92);
  const fgSvg = hex0xToSvgHex(fg0x);
  if (!bgRgba || !fgSvg) return "";

  if (preset === "arrow") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
  <defs>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/>
    </filter>
  </defs>
  <circle cx="28" cy="28" r="22" fill="${bgRgba}" stroke="${fgSvg}" stroke-width="2" filter="url(#s)"/>
  <path fill="none" stroke="${fgSvg}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M20 28h16m-6-7 7 7-7 7"/>
</svg>`;
  }
  if (preset === "cross") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
  <defs>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/>
    </filter>
  </defs>
  <circle cx="28" cy="28" r="22" fill="${bgRgba}" stroke="${fgSvg}" stroke-width="2" filter="url(#s)"/>
  <path fill="none" stroke="${fgSvg}" stroke-width="2.4" stroke-linecap="round" d="M20 20l16 16M36 20L20 36"/>
</svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
  <defs>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/>
    </filter>
  </defs>
  <circle cx="28" cy="28" r="22" fill="${bgRgba}" stroke="${fgSvg}" stroke-width="2" filter="url(#s)"/>
  <path fill="${fgSvg}" d="M22 18l14 10-14 10z"/>
</svg>`;
}

/**
 * Data URL SVG avec fond + pictogramme indépendants (presets Micronique uniquement).
 */
export function buildMicroniqueHotspotDataUrl(
  preset: MicroniquePresetId,
  iconBgColor0x: string,
  iconFgColor0x: string,
): string {
  const svg = buildSvg(preset, iconBgColor0x, iconFgColor0x);
  if (!svg) return "";
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * URL effective pour krpano : soit le fichier statique + teinte {@link KrpanoXmlHotspotOverride.colorize},
 * soit un data URL si fond + pictogramme Micronique sont tous deux définis.
 */
export function resolveEffectiveHotspotTextureUrl(
  o: KrpanoXmlHotspotOverride,
): string {
  const base = o.url?.trim() ?? "";
  const preset = getMicroniquePresetFromUrl(base);
  const bg = o.iconBgColor?.trim();
  const fg = o.iconFgColor?.trim();
  if (
    preset &&
    bg &&
    fg &&
    /^0x[0-9a-f]{6}$/i.test(bg) &&
    /^0x[0-9a-f]{6}$/i.test(fg)
  ) {
    const data = buildMicroniqueHotspotDataUrl(preset, bg.toLowerCase(), fg.toLowerCase());
    if (data) return data;
  }
  return base;
}

export function usesMicroniqueDualColors(o: KrpanoXmlHotspotOverride): boolean {
  const base = o.url?.trim() ?? "";
  const preset = getMicroniquePresetFromUrl(base);
  const bg = o.iconBgColor?.trim();
  const fg = o.iconFgColor?.trim();
  return (
    !!preset &&
    !!bg &&
    !!fg &&
    /^0x[0-9a-f]{6}$/i.test(bg) &&
    /^0x[0-9a-f]{6}$/i.test(fg)
  );
}

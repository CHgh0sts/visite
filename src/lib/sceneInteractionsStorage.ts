import defaultInteractionsJson from "@/data/scene-interactions-default.json";
import {
  hasModalContent,
  type InteractionHoverHintPlacement,
  type InteractionModalContent,
  type KrpanoNavigationHotspotStyle,
  type KrpanoXmlHotspotOverride,
  type KrpanoXmlHotspotOverridesByScene,
  type SceneInteractionButton,
  type SceneInteractionsMap,
} from "@/types/interactions";

/**
 * Carte des boutons d’interaction (sans localStorage).
 *
 * 1) `src/data/scene-interactions-default.json` — embarqué dans le build (fallback).
 * 2) Base PostgreSQL via `GET /api/scene-interactions` — fusionné au chargement.
 *
 * Fusion : défauts puis base : pour un même `id` de bouton, la base remplace le défaut.
 */

const RESERVED_PAYLOAD_KEYS = new Set([
  "map",
  "krpanoNavigationHotspotStyle",
  "krpanoXmlHotspotOverrides",
]);

function rawMapFromPayload(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return {};
  const o = parsed as Record<string, unknown>;
  if (o.map && typeof o.map === "object" && !Array.isArray(o.map)) {
    return o.map;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (!RESERVED_PAYLOAD_KEYS.has(k)) out[k] = v;
  }
  return out;
}

export function parseKrpanoNavigationHotspotStyle(
  raw: unknown,
): KrpanoNavigationHotspotStyle | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const out: KrpanoNavigationHotspotStyle = {};
  if (typeof o.url === "string" && o.url.trim()) out.url = o.url.trim();
  if (typeof o.scale === "number" && Number.isFinite(o.scale)) out.scale = o.scale;
  if (typeof o.oy === "number" && Number.isFinite(o.oy)) out.oy = o.oy;
  if (typeof o.edge === "string" && o.edge.trim()) out.edge = o.edge.trim();
  if (typeof o.zorder === "number" && Number.isFinite(o.zorder)) out.zorder = o.zorder;
  return Object.keys(out).length > 0 ? out : undefined;
}

export function mergeKrpanoNavigationHotspotStyle(
  base: KrpanoNavigationHotspotStyle | undefined,
  overlay: KrpanoNavigationHotspotStyle | undefined,
): KrpanoNavigationHotspotStyle | undefined {
  if (!overlay || Object.keys(overlay).length === 0) return base;
  if (!base || Object.keys(base).length === 0) return overlay;
  return { ...base, ...overlay };
}

function parseOneHotspotOverrideFields(
  o: Record<string, unknown>,
): KrpanoXmlHotspotOverride {
  const out: KrpanoXmlHotspotOverride = {};
  if (o.hotspotMode === "interaction" || o.hotspotMode === "navigation") {
    out.hotspotMode = o.hotspotMode;
  }
  if (
    typeof o.navigationTargetSceneId === "string" &&
    o.navigationTargetSceneId.trim()
  ) {
    out.navigationTargetSceneId = o.navigationTargetSceneId.trim();
  }
  if (typeof o.url === "string" && o.url.trim()) out.url = o.url.trim();
  for (const key of ["iconBgColor", "iconFgColor"] as const) {
    const v = o[key];
    if (typeof v === "string" && v.trim()) {
      const c = v.trim();
      if (/^0x[0-9A-Fa-f]{6}$/i.test(c)) out[key] = c.toLowerCase();
    }
  }
  if (typeof o.colorize === "string" && o.colorize.trim()) {
    const c = o.colorize.trim();
    if (/^0x[0-9A-Fa-f]{6}$/i.test(c)) out.colorize = c.toLowerCase();
  }
  if (typeof o.edge === "string" && o.edge.trim()) out.edge = o.edge.trim();
  if (typeof o.onover === "string") out.onover = o.onover;
  if (typeof o.onout === "string") out.onout = o.onout;
  if (typeof o.onclick === "string") out.onclick = o.onclick;
  const n = (x: unknown) =>
    typeof x === "number" && Number.isFinite(x) ? x : undefined;
  const sc = n(o.scale);
  if (sc !== undefined) out.scale = sc;
  const ox = n(o.ox);
  if (ox !== undefined) out.ox = ox;
  const oy = n(o.oy);
  if (oy !== undefined) out.oy = oy;
  const zo = n(o.zorder);
  if (zo !== undefined) out.zorder = zo;
  const rd = n(o.rotateDeg);
  if (rd !== undefined) out.rotateDeg = rd;
  for (const key of ["rxDeg", "ryDeg", "rzDeg"] as const) {
    const v = n(o[key]);
    if (v !== undefined) out[key] = v;
  }
  const ath = n(o.ath);
  if (ath !== undefined) out.ath = ath;
  const atv = n(o.atv);
  if (atv !== undefined) out.atv = atv;
  return out;
}

function migrateHotspotOverride(raw: unknown): KrpanoXmlHotspotOverride {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const n = parseOneHotspotOverrideFields(o);
  return { ...o, ...n } as KrpanoXmlHotspotOverride;
}

export function parseKrpanoXmlHotspotOverrides(
  parsed: unknown,
): KrpanoXmlHotspotOverridesByScene {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: KrpanoXmlHotspotOverridesByScene = {};
  for (const [sceneId, hmap] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    if (!hmap || typeof hmap !== "object" || Array.isArray(hmap)) continue;
    const hm: Record<string, KrpanoXmlHotspotOverride> = {};
    for (const [hn, raw] of Object.entries(hmap)) {
      hm[hn] = migrateHotspotOverride(raw);
    }
    if (Object.keys(hm).length > 0) out[sceneId] = hm;
  }
  return out;
}

export function mergeKrpanoXmlHotspotOverrides(
  base: KrpanoXmlHotspotOverridesByScene | undefined,
  overlay: KrpanoXmlHotspotOverridesByScene | undefined,
): KrpanoXmlHotspotOverridesByScene {
  if (!overlay || Object.keys(overlay).length === 0) {
    return base ? { ...base } : {};
  }
  if (!base || Object.keys(base).length === 0) {
    return { ...overlay };
  }
  const out: KrpanoXmlHotspotOverridesByScene = { ...base };
  for (const [sceneId, hmap] of Object.entries(overlay)) {
    out[sceneId] = { ...(base[sceneId] ?? {}) };
    for (const [hn, o] of Object.entries(hmap)) {
      out[sceneId][hn] = {
        ...(base[sceneId]?.[hn] ?? {}),
        ...o,
      };
    }
  }
  return out;
}

const COLOR_KEYS = [
  "bgColor",
  "fgColor",
  "hoverBgColor",
  "hoverFgColor",
] as const;

function readColors(
  o: Record<string, unknown>,
): Partial<Record<(typeof COLOR_KEYS)[number], string>> {
  const out: Partial<Record<(typeof COLOR_KEYS)[number], string>> = {};
  for (const k of COLOR_KEYS) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

function readPos(o: Record<string, unknown>): {
  ath?: number;
  atv?: number;
  topPct: number;
  leftPct: number;
} {
  const ath =
    typeof o.ath === "number" && !Number.isNaN(o.ath) ? o.ath : undefined;
  const atv =
    typeof o.atv === "number" && !Number.isNaN(o.atv) ? o.atv : undefined;
  const hasSphere = ath !== undefined && atv !== undefined;
  const topPct = Number(o.topPct);
  const leftPct = Number(o.leftPct);
  return {
    ath: hasSphere ? ath : undefined,
    atv: hasSphere ? atv : undefined,
    topPct: Number.isFinite(topPct) ? topPct : 0,
    leftPct: Number.isFinite(leftPct) ? leftPct : 0,
  };
}

function readModal(o: Record<string, unknown>): InteractionModalContent | undefined {
  const raw = o.modal;
  if (!raw || typeof raw !== "object") return undefined;
  const m = raw as Record<string, unknown>;
  const modal: InteractionModalContent = {};
  if (typeof m.title === "string") modal.title = m.title;
  if (typeof m.body === "string") modal.body = m.body;
  if (typeof m.videoUrl === "string") modal.videoUrl = m.videoUrl;
  if (typeof m.bgColor === "string" && m.bgColor.trim())
    modal.bgColor = m.bgColor.trim();
  if (typeof m.textColor === "string" && m.textColor.trim())
    modal.textColor = m.textColor.trim();
  if (typeof m.borderColor === "string" && m.borderColor.trim())
    modal.borderColor = m.borderColor.trim();
  if (typeof m.backdropColor === "string" && m.backdropColor.trim())
    modal.backdropColor = m.backdropColor.trim();
  if (typeof m.maxWidth === "string" && m.maxWidth.trim())
    modal.maxWidth = m.maxWidth.trim();
  if (typeof m.closeOnBackdropClick === "boolean")
    modal.closeOnBackdropClick = m.closeOnBackdropClick;
  if (typeof m.closeOnEscape === "boolean")
    modal.closeOnEscape = m.closeOnEscape;
  if (typeof m.showCloseButton === "boolean")
    modal.showCloseButton = m.showCloseButton;
  if (typeof m.showTitleBar === "boolean")
    modal.showTitleBar = m.showTitleBar;
  if (typeof m.centerViewForModal === "boolean")
    modal.centerViewForModal = m.centerViewForModal;
  if (typeof m.videoAutoplay === "boolean")
    modal.videoAutoplay = m.videoAutoplay;
  return hasModalContent(modal) ? modal : undefined;
}

/** Conserve toute clé JSON dans `modal` (futurs champs) tout en appliquant la lecture typée par-dessus. */
function mergeModalPreserve(o: Record<string, unknown>): InteractionModalContent | undefined {
  const raw = o.modal;
  const parsed = readModal(o);
  if (!raw || typeof raw !== "object") return parsed;
  const m = raw as Record<string, unknown>;
  const merged = { ...m, ...(parsed ?? {}) } as InteractionModalContent;
  if (Object.keys(merged as object).length === 0) return undefined;
  return merged;
}

function readIsEquipment(o: Record<string, unknown>): { isEquipment?: boolean } {
  if (typeof o.isEquipment === "boolean") return { isEquipment: o.isEquipment };
  return {};
}

function readHoverHintFields(o: Record<string, unknown>): {
  hoverHint?: string;
  hoverHintPlacement?: InteractionHoverHintPlacement;
} {
  const out: {
    hoverHint?: string;
    hoverHintPlacement?: InteractionHoverHintPlacement;
  } = {};
  if (typeof o.hoverHint === "string" && o.hoverHint.trim()) {
    out.hoverHint = o.hoverHint.trim();
  }
  const pl = o.hoverHintPlacement;
  if (pl === "top" || pl === "right" || pl === "bottom" || pl === "left") {
    out.hoverHintPlacement = pl;
  }
  return out;
}

function readTargetSceneId(o: Record<string, unknown>): {
  targetSceneId?: string;
} {
  if (typeof o.targetSceneId === "string" && o.targetSceneId.trim()) {
    return { targetSceneId: o.targetSceneId.trim() };
  }
  return {};
}

function readPreserveCurrentViewOnSceneChange(o: Record<string, unknown>): {
  preserveCurrentViewOnSceneChange?: boolean;
} {
  if (typeof o.preserveCurrentViewOnSceneChange === "boolean") {
    return { preserveCurrentViewOnSceneChange: o.preserveCurrentViewOnSceneChange };
  }
  return {};
}

function readTargetSceneLookAt(o: Record<string, unknown>): {
  targetSceneLookAt?: {
    hlookat: number;
    vlookat: number;
    fov?: number;
  };
} {
  const raw = o.targetSceneLookAt;
  if (!raw || typeof raw !== "object") return {};
  const t = raw as Record<string, unknown>;
  const h = t.hlookat;
  const v = t.vlookat;
  if (typeof h !== "number" || !Number.isFinite(h)) return {};
  if (typeof v !== "number" || !Number.isFinite(v)) return {};
  const out: { hlookat: number; vlookat: number; fov?: number } = {
    hlookat: h,
    vlookat: v,
  };
  const f = t.fov;
  if (typeof f === "number" && Number.isFinite(f)) out.fov = f;
  return { targetSceneLookAt: out };
}

/** Conserve les clés supplémentaires dans `targetSceneLookAt` tout en normalisant h/v/fov. */
function mergeTargetSceneLookAtPreserve(
  o: Record<string, unknown>,
): SceneInteractionButton["targetSceneLookAt"] | undefined {
  const raw = o.targetSceneLookAt;
  const parsed = readTargetSceneLookAt(o).targetSceneLookAt;
  if (!raw || typeof raw !== "object") return parsed;
  const t = raw as Record<string, unknown>;
  if (parsed) {
    return { ...t, ...parsed } as NonNullable<
      SceneInteractionButton["targetSceneLookAt"]
    >;
  }
  if (Object.keys(t).length > 0) {
    return t as NonNullable<SceneInteractionButton["targetSceneLookAt"]>;
  }
  return undefined;
}

function readSceneBtnFields(o: Record<string, unknown>): {
  sceneBtnScale?: number;
  sceneBtnRotateXDeg?: number;
  sceneBtnRotateYDeg?: number;
  sceneBtnRotateZDeg?: number;
  sceneBtnBorderRadius?: string;
  sceneBtnBorderWidthPx?: number;
  sceneBtnBorderColor?: string;
} {
  const out: {
    sceneBtnScale?: number;
    sceneBtnRotateXDeg?: number;
    sceneBtnRotateYDeg?: number;
    sceneBtnRotateZDeg?: number;
    sceneBtnBorderRadius?: string;
    sceneBtnBorderWidthPx?: number;
    sceneBtnBorderColor?: string;
  } = {};
  const sc = o.sceneBtnScale;
  if (typeof sc === "number" && Number.isFinite(sc) && sc > 0) {
    out.sceneBtnScale = sc;
  }
  const rx = o.sceneBtnRotateXDeg;
  if (typeof rx === "number" && Number.isFinite(rx)) out.sceneBtnRotateXDeg = rx;
  const ry = o.sceneBtnRotateYDeg;
  if (typeof ry === "number" && Number.isFinite(ry)) out.sceneBtnRotateYDeg = ry;
  const rz = o.sceneBtnRotateZDeg;
  if (typeof rz === "number" && Number.isFinite(rz)) out.sceneBtnRotateZDeg = rz;
  const br = o.sceneBtnBorderRadius;
  if (typeof br === "string" && br.trim()) out.sceneBtnBorderRadius = br.trim();
  const bw = o.sceneBtnBorderWidthPx;
  if (typeof bw === "number" && Number.isFinite(bw) && bw >= 0) {
    out.sceneBtnBorderWidthPx = bw;
  }
  const bc = o.sceneBtnBorderColor;
  if (typeof bc === "string" && bc.trim()) out.sceneBtnBorderColor = bc.trim();
  return out;
}

function readIconRotation(
  o: Record<string, unknown>,
): {
  iconRotationDeg?: number;
  iconHoverRotationDeg?: number;
  iconRotationDurationMs?: number;
  iconRotationDelayMs?: number;
} {
  const out: {
    iconRotationDeg?: number;
    iconHoverRotationDeg?: number;
    iconRotationDurationMs?: number;
    iconRotationDelayMs?: number;
  } = {};
  const r = o.iconRotationDeg;
  if (typeof r === "number" && !Number.isNaN(r)) out.iconRotationDeg = r;
  const h = o.iconHoverRotationDeg;
  if (typeof h === "number" && !Number.isNaN(h)) out.iconHoverRotationDeg = h;
  const dur = o.iconRotationDurationMs;
  if (typeof dur === "number" && !Number.isNaN(dur) && dur >= 0) {
    out.iconRotationDurationMs = dur;
  }
  const del = o.iconRotationDelayMs;
  if (typeof del === "number" && !Number.isNaN(del) && del >= 0) {
    out.iconRotationDelayMs = del;
  }
  return out;
}

function migrateButton(raw: unknown): SceneInteractionButton {
  if (!raw || typeof raw !== "object") {
    return {
      id: "invalid",
      label: "?",
      topPct: 0,
      leftPct: 0,
      contentType: "text",
    };
  }
  const o = raw as Record<string, unknown>;
  const pos = readPos(o);
  const modalMerged = mergeModalPreserve(o);
  const modalField = modalMerged ? { modal: modalMerged } : {};
  const colorFields = readColors(o);
  const rotationFields = readIconRotation(o);
  const hoverFields = readHoverHintFields(o);
  const targetLookAt = mergeTargetSceneLookAtPreserve(o);
  const targetSceneFields = {
    ...readTargetSceneId(o),
    ...(targetLookAt ? { targetSceneLookAt: targetLookAt } : {}),
    ...readPreserveCurrentViewOnSceneChange(o),
  };
  const sceneBtnFields = readSceneBtnFields(o);
  const equipmentField = readIsEquipment(o);

  let normalized: SceneInteractionButton;

  if (o.contentType === "lucide" && typeof o.lucideIcon === "string") {
    normalized = {
      id: String(o.id),
      contentType: "lucide",
      lucideIcon: o.lucideIcon,
      label: typeof o.label === "string" ? o.label : undefined,
      url: typeof o.url === "string" ? o.url : undefined,
      ...modalField,
      ...colorFields,
      ...rotationFields,
      ...hoverFields,
      ...targetSceneFields,
      ...sceneBtnFields,
      ...equipmentField,
      ...(pos.ath !== undefined
        ? { ath: pos.ath, atv: pos.atv! }
        : { topPct: pos.topPct, leftPct: pos.leftPct }),
    };
  } else if (o.contentType === "image" && typeof o.imageSrc === "string") {
    normalized = {
      id: String(o.id),
      contentType: "image",
      imageSrc: o.imageSrc,
      imageAlt: typeof o.imageAlt === "string" ? o.imageAlt : undefined,
      url: typeof o.url === "string" ? o.url : undefined,
      ...modalField,
      ...colorFields,
      ...rotationFields,
      ...hoverFields,
      ...targetSceneFields,
      ...sceneBtnFields,
      ...equipmentField,
      ...(pos.ath !== undefined
        ? { ath: pos.ath, atv: pos.atv! }
        : { topPct: pos.topPct, leftPct: pos.leftPct }),
    };
  } else if (o.contentType === "svg") {
    const svgId =
      o.svgId === "arrow" ||
      o.svgId === "microniquePlay" ||
      o.svgId === "cross"
        ? o.svgId
        : "cross";
    normalized = {
      id: String(o.id),
      contentType: "svg",
      svgId,
      label: typeof o.label === "string" ? o.label : undefined,
      url: typeof o.url === "string" ? o.url : undefined,
      ...modalField,
      ...colorFields,
      ...rotationFields,
      ...hoverFields,
      ...targetSceneFields,
      ...sceneBtnFields,
      ...equipmentField,
      ...(pos.ath !== undefined
        ? { ath: pos.ath, atv: pos.atv! }
        : { topPct: pos.topPct, leftPct: pos.leftPct }),
    };
  } else {
    normalized = {
      id: String(o.id),
      label: typeof o.label === "string" ? o.label : "Bouton",
      url: typeof o.url === "string" ? o.url : undefined,
      contentType: "text",
      ...modalField,
      ...colorFields,
      ...rotationFields,
      ...hoverFields,
      ...targetSceneFields,
      ...sceneBtnFields,
      ...equipmentField,
      ...(pos.ath !== undefined
        ? { ath: pos.ath, atv: pos.atv! }
        : { topPct: pos.topPct, leftPct: pos.leftPct }),
    };
  }

  /** JSON brut d’abord, champs normalisés ensuite (icône, rotations, modal fusionné, etc.). */
  return { ...o, ...normalized } as SceneInteractionButton;
}

export function parseSceneInteractionsPayload(parsed: unknown): SceneInteractionsMap {
  return migrateMap(rawMapFromPayload(parsed));
}

/** Payload complet API / base : `map` + optionnel `krpanoNavigationHotspotStyle`. */
export function parseSceneInteractionsDocument(parsed: unknown): {
  map: SceneInteractionsMap;
  krpanoNavigationHotspotStyle?: KrpanoNavigationHotspotStyle;
  krpanoXmlHotspotOverrides?: KrpanoXmlHotspotOverridesByScene;
} {
  const map = migrateMap(rawMapFromPayload(parsed));
  let krpanoNavigationHotspotStyle: KrpanoNavigationHotspotStyle | undefined;
  let krpanoXmlHotspotOverrides: KrpanoXmlHotspotOverridesByScene | undefined;
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    const rawStyle = o.krpanoNavigationHotspotStyle;
    const parsedStyle = parseKrpanoNavigationHotspotStyle(rawStyle);
    if (rawStyle && typeof rawStyle === "object" && !Array.isArray(rawStyle)) {
      const merged = {
        ...(rawStyle as Record<string, unknown>),
        ...(parsedStyle ?? {}),
      };
      if (Object.keys(merged).length > 0) {
        krpanoNavigationHotspotStyle = merged as KrpanoNavigationHotspotStyle;
      }
    } else if (parsedStyle && Object.keys(parsedStyle).length > 0) {
      krpanoNavigationHotspotStyle = parsedStyle;
    }
    const rawOv = o.krpanoXmlHotspotOverrides;
    if (rawOv !== undefined && rawOv !== null && typeof rawOv === "object" && !Array.isArray(rawOv)) {
      krpanoXmlHotspotOverrides = parseKrpanoXmlHotspotOverrides(rawOv);
    }
  }
  return {
    map,
    ...(krpanoNavigationHotspotStyle
      ? { krpanoNavigationHotspotStyle }
      : {}),
    ...(krpanoXmlHotspotOverrides !== undefined
      ? { krpanoXmlHotspotOverrides }
      : {}),
  };
}

function migrateMap(parsed: unknown): SceneInteractionsMap {
  if (!parsed || typeof parsed !== "object") return {};
  const out: SceneInteractionsMap = {};
  for (const [scene, list] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    if (!Array.isArray(list)) continue;
    out[scene] = list.map(migrateButton);
  }
  return out;
}

/**
 * Fusion : pour chaque scène, les boutons du même `id` dans `overlay` remplacent ceux de `base`.
 */
export function mergeInteractionMaps(
  base: SceneInteractionsMap,
  overlay: SceneInteractionsMap,
): SceneInteractionsMap {
  const sceneIds = new Set([
    ...Object.keys(base),
    ...Object.keys(overlay),
  ]);
  const out: SceneInteractionsMap = {};
  for (const sid of sceneIds) {
    const baseList = base[sid] ?? [];
    const overList = overlay[sid] ?? [];
    const byId = new Map<string, SceneInteractionButton>();
    for (const b of baseList) byId.set(b.id, b);
    for (const b of overList) byId.set(b.id, b);
    const merged = [...byId.values()];
    if (merged.length > 0) out[sid] = merged;
  }
  return out;
}

/** Données par défaut embarquées dans le build (fichier JSON). */
export function getDefaultInteractions(): SceneInteractionsMap {
  return parseSceneInteractionsDocument(defaultInteractionsJson as unknown).map;
}

export function getDefaultKrpanoNavigationHotspotStyle():
  | KrpanoNavigationHotspotStyle
  | undefined {
  return parseSceneInteractionsDocument(defaultInteractionsJson as unknown)
    .krpanoNavigationHotspotStyle;
}

export function getDefaultKrpanoXmlHotspotOverrides(): KrpanoXmlHotspotOverridesByScene {
  return (
    parseSceneInteractionsDocument(defaultInteractionsJson as unknown)
      .krpanoXmlHotspotOverrides ?? {}
  );
}

/**
 * Charge défauts + carte en base (API). Côté serveur sans `fetch` : défauts seuls.
 */
export async function loadSiteInteractionsDocument(): Promise<{
  map: SceneInteractionsMap;
  krpanoNavigationHotspotStyle?: KrpanoNavigationHotspotStyle;
  krpanoXmlHotspotOverrides?: KrpanoXmlHotspotOverridesByScene;
  /** true si l’API PostgreSQL est injoignable (503, réseau, etc.). */
  dbUnavailable?: boolean;
}> {
  const def = parseSceneInteractionsDocument(defaultInteractionsJson as unknown);
  const defReturn = {
    map: def.map,
    ...("krpanoNavigationHotspotStyle" in def &&
    def.krpanoNavigationHotspotStyle
      ? { krpanoNavigationHotspotStyle: def.krpanoNavigationHotspotStyle }
      : {}),
    ...(def.krpanoXmlHotspotOverrides !== undefined
      ? { krpanoXmlHotspotOverrides: def.krpanoXmlHotspotOverrides }
      : {}),
  };
  if (typeof window === "undefined") {
    return defReturn;
  }
  try {
    const res = await fetch("/api/scene-interactions", { cache: "no-store" });
    if (!res.ok) {
      return { ...defReturn, dbUnavailable: true };
    }
    const data = (await res.json()) as {
      map?: unknown;
      krpanoNavigationHotspotStyle?: unknown;
      krpanoXmlHotspotOverrides?: unknown;
      error?: string;
    };
    if (data.error) {
      return { ...defReturn, dbUnavailable: true };
    }
    const fromDb = parseSceneInteractionsDocument({
      map: data.map ?? {},
      krpanoNavigationHotspotStyle: data.krpanoNavigationHotspotStyle,
      krpanoXmlHotspotOverrides: data.krpanoXmlHotspotOverrides,
    });
    const mergedStyle = mergeKrpanoNavigationHotspotStyle(
      def.krpanoNavigationHotspotStyle,
      fromDb.krpanoNavigationHotspotStyle,
    );
    /** API : surcharges hotspots = uniquement la base (HotspotInteraction), pas le JSON embarqué. */
    const hotspotOv = fromDb.krpanoXmlHotspotOverrides ?? {};
    return {
      map: mergeInteractionMaps(def.map, fromDb.map),
      ...(mergedStyle ? { krpanoNavigationHotspotStyle: mergedStyle } : {}),
      krpanoXmlHotspotOverrides: hotspotOv,
      dbUnavailable: false,
    };
  } catch {
    return { ...defReturn, dbUnavailable: true };
  }
}

/** @deprecated Préférer `loadSiteInteractionsDocument` pour le style hotspots XML. */
export async function loadSiteInteractions(): Promise<SceneInteractionsMap> {
  const d = await loadSiteInteractionsDocument();
  return d.map;
}

export function exportInteractionsJson(map: SceneInteractionsMap): string {
  return JSON.stringify(map, null, 2);
}

export function exportInteractionsDocumentJson(
  map: SceneInteractionsMap,
  krpanoNavigationHotspotStyle?: KrpanoNavigationHotspotStyle,
  krpanoXmlHotspotOverrides?: KrpanoXmlHotspotOverridesByScene,
): string {
  const o: Record<string, unknown> = { map };
  if (
    krpanoNavigationHotspotStyle &&
    Object.keys(krpanoNavigationHotspotStyle).length > 0
  ) {
    o.krpanoNavigationHotspotStyle = krpanoNavigationHotspotStyle;
  }
  if (
    krpanoXmlHotspotOverrides &&
    Object.keys(krpanoXmlHotspotOverrides).length > 0
  ) {
    o.krpanoXmlHotspotOverrides = krpanoXmlHotspotOverrides;
  }
  return JSON.stringify(o, null, 2);
}

import defaultInteractionsJson from "@/data/scene-interactions-default.json";
import {
  hasModalContent,
  type InteractionHoverHintPlacement,
  type InteractionModalContent,
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

function readIsEquipment(o: Record<string, unknown>): { isEquipment?: boolean } {
  if (o.isEquipment === true) return { isEquipment: true };
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
  const modal = readModal(o);
  const modalField = modal ? { modal } : {};
  const colorFields = readColors(o);
  const rotationFields = readIconRotation(o);
  const hoverFields = readHoverHintFields(o);
  const targetSceneFields = {
    ...readTargetSceneId(o),
    ...readTargetSceneLookAt(o),
  };
  const sceneBtnFields = readSceneBtnFields(o);
  const equipmentField = readIsEquipment(o);

  if (o.contentType === "lucide" && typeof o.lucideIcon === "string") {
    return {
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
  }
  if (o.contentType === "image" && typeof o.imageSrc === "string") {
    return {
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
  }
  if (o.contentType === "svg") {
    const svgId =
      o.svgId === "arrow" || o.svgId === "microniquePlay"
        ? o.svgId
        : "cross";
    return {
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
  }
  return {
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

export function parseSceneInteractionsPayload(parsed: unknown): SceneInteractionsMap {
  return migrateMap(parsed);
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
  return migrateMap(defaultInteractionsJson as unknown);
}

/**
 * Charge défauts + carte en base (API). Côté serveur sans `fetch` : défauts seuls.
 */
export async function loadSiteInteractions(): Promise<SceneInteractionsMap> {
  const defaults = getDefaultInteractions();
  if (typeof window === "undefined") return defaults;
  try {
    const res = await fetch("/api/scene-interactions", { cache: "no-store" });
    if (!res.ok) return defaults;
    const data = (await res.json()) as { map?: unknown };
    const fromDb = data.map
      ? parseSceneInteractionsPayload(data.map)
      : {};
    return mergeInteractionMaps(defaults, fromDb);
  } catch {
    return defaults;
  }
}

export function exportInteractionsJson(map: SceneInteractionsMap): string {
  return JSON.stringify(map, null, 2);
}

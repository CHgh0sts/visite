import type {
  KrpanoNavigationHotspotStyle,
  KrpanoXmlHotspotOverride,
  KrpanoXmlHotspotOverridesByScene,
} from "@/types/interactions";
import type { KrpanoViewer } from "@/types/krpanoViewer";

const KRPANO_NAV_HOTSPOT_STYLE_XML = "hotspot_custom_style";

/** Échappe une chaîne pour une action krpano entre guillemets simples. */
export function escapeKrpanoSingleQuoted(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Applique les paramètres persistés (JSON / base) au style XML `hotspot_custom_style` du tour.
 */
export function applyKrpanoNavigationHotspotStyle(
  krpano: KrpanoViewer,
  style: KrpanoNavigationHotspotStyle | undefined | null,
): void {
  if (!style || Object.keys(style).length === 0) return;
  const g = krpano.get;
  if (!g) return;
  try {
    const pref = `style[${KRPANO_NAV_HOTSPOT_STYLE_XML}]`;
    if (style.url?.trim()) {
      const u = escapeKrpanoSingleQuoted(style.url.trim());
      krpano.call(`set(${pref}.url, '${u}');`);
    }
    if (typeof style.oy === "number" && Number.isFinite(style.oy)) {
      krpano.call(`set(${pref}.oy, ${style.oy});`);
    }
    if (typeof style.scale === "number" && Number.isFinite(style.scale)) {
      krpano.call(`set(${pref}.scale, ${style.scale});`);
    }
    if (style.edge?.trim()) {
      const e = escapeKrpanoSingleQuoted(style.edge.trim());
      krpano.call(`set(${pref}.edge, '${e}');`);
    }
    if (typeof style.zorder === "number" && Number.isFinite(style.zorder)) {
      krpano.call(`set(${pref}.zorder, ${style.zorder});`);
    }
  } catch (e) {
    console.warn("[krpano] applyKrpanoNavigationHotspotStyle", e);
  }
}

function applyOneXmlHotspotOverride(
  krpano: KrpanoViewer,
  name: string,
  o: KrpanoXmlHotspotOverride,
): void {
  if (!o || Object.keys(o).length === 0) return;
  const hn = escapeKrpanoSingleQuoted(name.trim());
  const pref = `hotspot['${hn}']`;
  try {
    if (o.url?.trim()) {
      const u = escapeKrpanoSingleQuoted(o.url.trim());
      krpano.call(`set(${pref}.url, '${u}');`);
    }
    if (typeof o.scale === "number" && Number.isFinite(o.scale)) {
      krpano.call(`set(${pref}.scale, ${o.scale});`);
    }
    if (typeof o.ox === "number" && Number.isFinite(o.ox)) {
      krpano.call(`set(${pref}.ox, ${o.ox});`);
    }
    if (typeof o.oy === "number" && Number.isFinite(o.oy)) {
      krpano.call(`set(${pref}.oy, ${o.oy});`);
    }
    if (o.edge?.trim()) {
      krpano.call(
        `set(${pref}.edge, '${escapeKrpanoSingleQuoted(o.edge.trim())}');`,
      );
    }
    if (typeof o.zorder === "number" && Number.isFinite(o.zorder)) {
      krpano.call(`set(${pref}.zorder, ${o.zorder});`);
    }
    if (typeof o.rotateDeg === "number" && Number.isFinite(o.rotateDeg)) {
      krpano.call(`set(${pref}.rotate, ${o.rotateDeg});`);
    }
    if (typeof o.ath === "number" && Number.isFinite(o.ath)) {
      krpano.call(`set(${pref}.ath, ${o.ath});`);
    }
    if (typeof o.atv === "number" && Number.isFinite(o.atv)) {
      krpano.call(`set(${pref}.atv, ${o.atv});`);
    }
    if (o.onover != null && String(o.onover).length > 0) {
      krpano.call(
        `set(${pref}.onover, '${escapeKrpanoSingleQuoted(String(o.onover))}');`,
      );
    }
    if (o.onout != null && String(o.onout).length > 0) {
      krpano.call(
        `set(${pref}.onout, '${escapeKrpanoSingleQuoted(String(o.onout))}');`,
      );
    }
    if (o.onclick != null && String(o.onclick).length > 0) {
      krpano.call(
        `set(${pref}.onclick, '${escapeKrpanoSingleQuoted(String(o.onclick))}');`,
      );
    }
  } catch (e) {
    console.warn("[krpano] applyOneXmlHotspotOverride", name, e);
  }
}

/**
 * Applique les surcharges JSON par hotspot pour la scène affichée (noms = tour XML).
 */
export function applyKrpanoXmlHotspotOverrides(
  krpano: KrpanoViewer,
  sceneId: string,
  byScene: KrpanoXmlHotspotOverridesByScene | undefined | null,
): void {
  if (!byScene || !sceneId?.trim()) return;
  const sceneOverrides = byScene[sceneId.trim()];
  if (!sceneOverrides || Object.keys(sceneOverrides).length === 0) return;
  const g = krpano.get;
  if (!g) return;
  for (const [rawName, o] of Object.entries(sceneOverrides)) {
    applyOneXmlHotspotOverride(krpano, rawName, o);
  }
}

export type KrpanoSceneLookAt = {
  hlookat: number;
  vlookat: number;
  fov?: number;
};

type PendingReactLookAt = {
  /** Doit correspondre à `get(xml.scene)` / `onSceneChange` pour ignorer les `onloadcomplete` tardifs ou d’une autre scène. */
  sceneId: string;
  h: number;
  v: number;
  /** `null` = utiliser `get(view.fov)` à l’application */
  fov: number | null;
};

let pendingReactLookAt: PendingReactLookAt | null = null;

let krpanoViewerRefForLoadComplete: KrpanoViewer | null = null;

/** Après chaque `onloadcomplete` du panorama : réappliquer style + surcharges DB (hotspots XML). */
let krpanoAfterPanoLoadCallback: (() => void) | null = null;

export function setKrpanoAfterPanoLoadCallback(fn: (() => void) | null): void {
  krpanoAfterPanoLoadCallback = fn;
}

/** Référence au viewer pour `onloadcomplete` (jscall depuis tour.xml). */
export function setKrpanoViewerForLoadComplete(k: KrpanoViewer | null): void {
  krpanoViewerRefForLoadComplete = k;
}

/** Viewer krpano courant — entrée/sortie WebXR (`reactKrpano.onEnterVR` / `onExitVR`). */
export function getKrpanoViewerForTour(): KrpanoViewer | null {
  return krpanoViewerRefForLoadComplete;
}

/** N’applique que si `sceneName` est la scène attendue — évite de vider le pending sur un `onloadcomplete` obsolète. */
function applyPendingIfSceneMatches(
  krpano: KrpanoViewer,
  sceneName: string,
): void {
  const p = pendingReactLookAt;
  if (!p) return;
  const expected = p.sceneId.trim();
  const current = sceneName.trim();
  if (current !== expected) return;
  pendingReactLookAt = null;
  try {
    if (p.fov != null && Number.isFinite(p.fov)) {
      krpano.call(`lookat(${p.h}, ${p.v}, ${p.fov});`);
    } else {
      krpano.call(`lookat(${p.h}, ${p.v}, get(view.fov));`);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Fin de fondu (`onblendcomplete`) : repli si `onloadcomplete` n’a pas pu appliquer (ex. `get` indisponible).
 */
export function tryApplyPendingLookAtForScene(sceneName: string): void {
  if (!krpanoViewerRefForLoadComplete) return;
  applyPendingIfSceneMatches(krpanoViewerRefForLoadComplete, sceneName);
}

/** Branché depuis tour.xml `onloadcomplete` — même logique que le repli blend, avec la scène courante lue côté viewer. */
export function onReactPanoLoadComplete(): void {
  if (!krpanoViewerRefForLoadComplete) return;
  const k = krpanoViewerRefForLoadComplete;
  const scene = k.get?.("xml.scene");
  if (typeof scene !== "string") return;
  applyPendingIfSceneMatches(k, scene);
  try {
    krpanoAfterPanoLoadCallback?.();
  } catch (e) {
    console.warn("[krpano] krpanoAfterPanoLoadCallback", e);
  }
}

function setPendingReactLookAt(next: PendingReactLookAt | null): void {
  pendingReactLookAt = next;
}

/**
 * Vue à appliquer après `loadscene` : soit celle du bouton, soit la vue actuelle si
 * `preserveCurrentViewOnSceneChange` est activé.
 */
export function lookAtForSceneNavigationButton(
  krpano: KrpanoViewer,
  b: {
    preserveCurrentViewOnSceneChange?: boolean;
    targetSceneLookAt?: KrpanoSceneLookAt;
  },
): KrpanoSceneLookAt | undefined {
  if (b.preserveCurrentViewOnSceneChange) {
    const snap = getKrpanoViewSnapshot(krpano);
    if (snap) {
      return {
        hlookat: snap.hlookat,
        vlookat: snap.vlookat,
        fov: snap.fov,
      };
    }
  }
  return b.targetSceneLookAt;
}

/**
 * Charge une scène du tour (même logique que les hotspots `loadscene` du XML).
 * Avec `lookAt` : orientation appliquée sur `onloadcomplete` (voir tour.xml + `onReactPanoLoadComplete`),
 * comme le skin après `skin_loadscene`, et non après un délai arbitraire (évite un saut visible après le blend).
 */
export function loadKrpanoScene(
  krpano: KrpanoViewer,
  sceneId: string,
  lookAt?: KrpanoSceneLookAt,
): void {
  const id = escapeKrpanoSingleQuoted(sceneId.trim());
  if (!id) return;
  const blend = 0.5;
  if (
    lookAt &&
    Number.isFinite(lookAt.hlookat) &&
    Number.isFinite(lookAt.vlookat)
  ) {
    const fovExplicit =
      lookAt.fov != null && Number.isFinite(lookAt.fov) ? lookAt.fov : null;
    setPendingReactLookAt({
      sceneId: sceneId.trim(),
      h: lookAt.hlookat,
      v: lookAt.vlookat,
      fov: fovExplicit,
    });
    krpano.call(`loadscene('${id}', null, MERGE, BLEND(${blend}));`);
    return;
  }
  setPendingReactLookAt(null);
  krpano.call(`loadscene('${id}', null, MERGE, BLEND(${blend}));`);
}

/** À démonter le viewer (ex. démontage KrpanoTour) — pending uniquement. */
export function clearPendingReactLookAt(): void {
  pendingReactLookAt = null;
}

function parseKrpanoBool(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1";
  }
  return false;
}

/**
 * Rendu double image côte à côte (`display.stereo`, ex. paysage + gyro / VR mobile).
 * Utilisé pour l’overlay HTML : les coords `spheretoscreen` sont ramenées sur la moitié gauche.
 */
export function getKrpanoDisplayStereo(krpano: KrpanoViewer): boolean {
  const g = krpano.get;
  if (typeof g !== "function") return false;
  try {
    return parseKrpanoBool(g("display.stereo"));
  } catch {
    return false;
  }
}

/**
 * Met à l’échelle le point `spheretoscreen(ath,atv)` du **repère stage** krpano vers les
 * pixels du conteneur viewer (même origine que `screentosphere(x,y)` au clic dans
 * PlacementLayer : coin haut-gauche du div `#krpano-target-*`).
 *
 * **Ne pas** modifier `p.x` / `p.y` (ex. ×0,5 en stéréo) : krpano calcule déjà la projection
 * cohérente avec `screentosphere` ; une correction manuelle casse le suivi quand la vue tourne
 * (VR / SBS / mono).
 */
export function krpanoSpheretoscreenToOverlayLocalPx(
  krpano: KrpanoViewer,
  p: { x: number; y: number },
  containerWidthPx: number,
  containerHeightPx: number,
): { x: number; y: number } {
  const g = krpano.get;
  const sw =
    (typeof g === "function" ? parseKrpanoNumber(g("stagewidth")) : null) ??
    containerWidthPx;
  const sh =
    (typeof g === "function" ? parseKrpanoNumber(g("stageheight")) : null) ??
    containerHeightPx;
  const swSafe = Math.max(1, sw);
  const shSafe = Math.max(1, sh);
  return {
    x: (p.x / swSafe) * containerWidthPx,
    y: (p.y / shSafe) * containerHeightPx,
  };
}

/**
 * Masque toute la barre / skin krpano (vtourskin).
 * `skin_startup` remet `skin_layer` visible après `onready` — un second passage en différé supprime la bande grise + le strip « réafficher ».
 */
export function hideKrpanoTourChrome(krpano: KrpanoViewer): void {
  try {
    krpano.call("skin_hideskin(instant);");
    /* Flèches gauche/droite « mode skin caché » (vtourskin) — forcer l’absence. */
    krpano.call(
      "set(layer[skin_btn_prev_fs].visible,false); set(layer[skin_btn_next_fs].visible,false); set(layer[skin_btn_prev_fs].enabled,false); set(layer[skin_btn_next_fs].enabled,false); set(layer[skin_btn_prev_fs].alpha,0); set(layer[skin_btn_next_fs].alpha,0);",
    );
    krpano.call(
      "delayedcall(0.85, skin_hideskin(instant); set(layer[skin_layer].visible, false); set(layer[skin_btn_show].visible, false); set(layer[skin_btn_show].alpha, 0); set(layer[skin_btn_prev_fs].visible,false); set(layer[skin_btn_next_fs].visible,false); set(layer[skin_btn_prev_fs].enabled,false); set(layer[skin_btn_next_fs].enabled,false););",
    );
  } catch {
    /* ignore */
  }
}

export function showKrpanoTourChrome(krpano: KrpanoViewer): void {
  try {
    krpano.call("skin_showskin();");
  } catch {
    /* ignore */
  }
}

/** Durée du pivot caméra pour centrer la boîte modale (secondes). */
export const MODAL_CENTER_VIEW_TWEEN_SEC = 0.65;

/** krpano peut renvoyer des nombres ou des chaînes selon le chemin. */
function parseKrpanoNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type KrpanoViewSnapshot = {
  hlookat: number;
  vlookat: number;
  fov: number;
};

/** Lit l’orientation courante du panorama (pour sauvegarde / restauration). */
export function getKrpanoViewSnapshot(
  krpano: KrpanoViewer,
): KrpanoViewSnapshot | null {
  const g = krpano.get;
  if (!g) return null;
  const h = parseKrpanoNumber(g("view.hlookat"));
  const v = parseKrpanoNumber(g("view.vlookat"));
  const fov = parseKrpanoNumber(g("view.fov"));
  if (h === null || v === null) return null;
  return {
    hlookat: h,
    vlookat: v,
    fov: fov ?? 120,
  };
}

/**
 * FOV horizontal (°) à partir du FOV vertical krpano (MFOV) et du ratio d’aspect.
 */
export function horizontalFovDegFromVertical(
  verticalFovDeg: number,
  viewportWidthPx: number,
  viewportHeightPx: number,
): number {
  const h = Math.max(1, viewportHeightPx);
  const w = Math.max(1, viewportWidthPx);
  const aspect = w / h;
  const fv = (verticalFovDeg * Math.PI) / 180;
  if (!Number.isFinite(fv) || fv <= 0 || fv >= Math.PI) return verticalFovDeg;
  const tanHalf = Math.tan(fv / 2);
  return (2 * Math.atan(tanHalf * aspect) * 180) / Math.PI;
}

/**
 * Compense le fait que la modale est à droite du point du bouton (`sceneButtonAnchorOffsetPx`).
 * Sans ça, `lookat(ath, atv)` centre le bouton mais pas la boîte.
 * Utilise le FOV **horizontal** (paysage) pour l’échelle ° / pixel.
 */
export function adjustedAthAtvToCenterModalBesideButton(
  ath: number,
  atv: number,
  options: {
    viewportWidthPx: number;
    viewportHeightPx: number;
    sceneBtnOffsetPx: number;
    modalWidthPx: number;
    fovDeg: number;
  },
): { ath: number; atv: number } {
  const w = options.viewportWidthPx;
  const h = Math.max(1, options.viewportHeightPx);
  if (!Number.isFinite(w) || w <= 0) return { ath, atv };
  const deltaPx = options.sceneBtnOffsetPx + options.modalWidthPx / 2;
  const fov = options.fovDeg;
  if (!Number.isFinite(fov) || fov <= 0) return { ath, atv };
  const hFov = horizontalFovDegFromVertical(fov, w, h);
  /** Ramener le centre de la modale au milieu : point du bouton un peu à gauche de l’axe → augmente ath. */
  const deltaH = (deltaPx / w) * hFov;
  return { ath: ath + deltaH, atv };
}

/** hlookat cible en tournant du côté le plus court (±180°). */
export function shortestHLookatTarget(
  currentH: number,
  targetAth: number,
): number {
  let d = targetAth - currentH;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return currentH + d;
}

/**
 * Anime la vue vers le point sphère (ath/atv) — même référentiel que les hotspots.
 * easeOutQuad : réactif sans être brutal.
 */
export function tweenKrpanoViewToAnchor(
  krpano: KrpanoViewer,
  ath: number,
  atv: number,
  durationSec: number = MODAL_CENTER_VIEW_TWEEN_SEC,
): void {
  const snap = getKrpanoViewSnapshot(krpano);
  if (!snap) {
    try {
      krpano.call(`lookat(${ath}, ${atv}, get(view.fov));`);
    } catch {
      /* ignore */
    }
    return;
  }
  const h1 = shortestHLookatTarget(snap.hlookat, ath);
  const d = Math.max(0.22, durationSec);
  try {
    krpano.call(
      `stoptween(view.hlookat); stoptween(view.vlookat); tween(view.hlookat, ${h1}, ${d}, easeOutQuad); tween(view.vlookat, ${atv}, ${d}, easeOutQuad);`,
    );
  } catch {
    try {
      krpano.call(`lookat(${ath}, ${atv}, get(view.fov));`);
    } catch {
      /* ignore */
    }
  }
}

/** Restaure une vue sauvegardée avec le même lissage. */
export function tweenKrpanoViewToSnapshot(
  krpano: KrpanoViewer,
  target: KrpanoViewSnapshot,
  durationSec: number = MODAL_CENTER_VIEW_TWEEN_SEC,
): void {
  const snap = getKrpanoViewSnapshot(krpano);
  if (!snap) {
    try {
      krpano.call(
        `lookat(${target.hlookat}, ${target.vlookat}, ${target.fov});`,
      );
    } catch {
      /* ignore */
    }
    return;
  }
  const h1 = shortestHLookatTarget(snap.hlookat, target.hlookat);
  const d = Math.max(0.22, durationSec);
  try {
    krpano.call(
      `stoptween(view.hlookat); stoptween(view.vlookat); stoptween(view.fov); tween(view.hlookat, ${h1}, ${d}, easeOutQuad); tween(view.vlookat, ${target.vlookat}, ${d}, easeOutQuad); tween(view.fov, ${target.fov}, ${d}, easeOutQuad);`,
    );
  } catch {
    try {
      krpano.call(
        `lookat(${target.hlookat}, ${target.vlookat}, ${target.fov});`,
      );
    } catch {
      /* ignore */
    }
  }
}

/** Affiche / masque la barre VR krpano (`tour.xml` → `react_vr_navbar_set_visibility`). */
export function setKrpanoVrNavbarVisibility(
  krpano: KrpanoViewer,
  visible: boolean,
): void {
  try {
    krpano.call(`react_vr_navbar_set_visibility(${visible ? 1 : 0});`);
  } catch {
    /* ignore */
  }
}

let lastVrNavbarSyncedToWebVr: boolean | null = null;

export function syncKrpanoVrNavbarVisibility(krpano: KrpanoViewer): void {
  const on = getKrpanoWebVrEnabled(krpano);
  if (lastVrNavbarSyncedToWebVr === on) return;
  lastVrNavbarSyncedToWebVr = on;
  setKrpanoVrNavbarVisibility(krpano, on);
}

export function resetKrpanoVrNavbarVisibilitySyncCache(): void {
  lastVrNavbarSyncedToWebVr = null;
}

export function syncKrpanoVrFollowBar(krpano: KrpanoViewer): void {
  try {
    krpano.call("react_vr_followbar_sync();");
  } catch {
    /* ignore */
  }
}

/** Session WebXR active (plugin `webvr`). */
export function getKrpanoWebVrEnabled(krpano: KrpanoViewer): boolean {
  const g = krpano.get;
  if (typeof g !== "function") return false;
  try {
    return parseKrpanoBool(g("webvr.isenabled"));
  } catch {
    return false;
  }
}

/** WebXR utilisable sur cet appareil / navigateur. */
export function getKrpanoWebVrAvailable(krpano: KrpanoViewer): boolean {
  const g = krpano.get;
  if (typeof g !== "function") return false;
  try {
    return parseKrpanoBool(g("webvr.isavailable"));
  } catch {
    return false;
  }
}

export function enterKrpanoWebVr(krpano: KrpanoViewer): void {
  try {
    krpano.call("webvr.enterVR();");
  } catch {
    /* ignore */
  }
}

export function exitKrpanoWebVr(krpano: KrpanoViewer): void {
  try {
    krpano.call("webvr.exitVR();");
  } catch {
    /* ignore */
  }
}

export function toggleKrpanoWebVr(krpano: KrpanoViewer): void {
  if (getKrpanoWebVrEnabled(krpano)) exitKrpanoWebVr(krpano);
  else enterKrpanoWebVr(krpano);
}

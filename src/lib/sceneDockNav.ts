import sceneNavRaw from "@/data/scene-nav.json";
import type { SceneNavConfig, SceneNavItem } from "@/types/scene-nav";

function filterNavItems(config: SceneNavConfig): SceneNavItem[] {
  return (config.items ?? []).filter(
    (i) =>
      i.sceneId?.trim() &&
      i.label?.trim() &&
      typeof i.iconUrl === "string" &&
      i.iconUrl.trim().length > 0,
  );
}

/**
 * Indice du dock actif pour la scène courante (sceneId ou alias otherSceneIds).
 */
export function dockIndexForScene(
  currentSceneId: string,
  config: SceneNavConfig = sceneNavRaw as SceneNavConfig,
): number {
  const items = filterNavItems(config);
  if (items.length === 0) return -1;
  const cur = currentSceneId.trim();
  const idx = items.findIndex((item) => {
    if (item.sceneId.trim() === cur) return true;
    const aliases = [...(item.otherSceneId ?? []), ...(item.otherSceneIds ?? [])]
      .map((x) => String(x).trim())
      .filter(Boolean);
    return aliases.includes(cur);
  });
  if (idx >= 0) return idx;
  return 0;
}

/**
 * `sceneId` principal du volet dock précédent / suivant (ordre scene-nav.json).
 */
export function dockNavSceneIdAfterDelta(
  currentSceneId: string,
  delta: -1 | 1,
  config: SceneNavConfig = sceneNavRaw as SceneNavConfig,
): string | null {
  const items = filterNavItems(config);
  if (items.length === 0) return null;
  const idx = dockIndexForScene(currentSceneId, config);
  const start = idx >= 0 ? idx : 0;
  const len = items.length;
  const nextIdx = (start + delta + len * 16) % len;
  const id = items[nextIdx]?.sceneId?.trim();
  return id || null;
}

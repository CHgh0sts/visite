import { catalogZoneDisplay } from "@/lib/catalogDisplayLabels";
import { TOUR_SCENES } from "@/lib/tourScenes";
import type { SceneInteractionButton, SceneInteractionsMap } from "@/types/interactions";

const CATALOG_ZONE_LABEL = "sceneTitle" as const;

export type MergedEquipmentZone = {
  /** Libellé affiché (identique pour les scènes fusionnées). */
  displayLabel: string;
  sceneIds: string[];
  /** Chaque équipement garde sa scène d’origine pour la navigation. */
  items: { sceneId: string; button: SceneInteractionButton }[];
};

/**
 * Zones avec équipements, puis fusion par libellé affiché (après remplacements JSON).
 * Même logique que le catalogue équipements (`EquipmentCatalogPanel`).
 */
export function mergeEquipmentCatalogZones(
  map: SceneInteractionsMap,
): MergedEquipmentZone[] {
  type RawZone = {
    sceneId: string;
    title: string;
    items: SceneInteractionButton[];
  };
  const raw: RawZone[] = [];
  for (const s of TOUR_SCENES) {
    const list = map[s.id] ?? [];
    const items = list.filter((b) => b.isEquipment === true);
    if (items.length === 0) continue;
    raw.push({
      sceneId: s.id,
      title: s.title,
      items,
    });
  }

  const merged: MergedEquipmentZone[] = [];
  const displayLabelToIndex = new Map<string, number>();

  for (const z of raw) {
    const displayLabel = catalogZoneDisplay(z.sceneId, CATALOG_ZONE_LABEL);
    const wrapped = z.items.map((button) => ({ sceneId: z.sceneId, button }));
    const idx = displayLabelToIndex.get(displayLabel);
    if (idx === undefined) {
      displayLabelToIndex.set(displayLabel, merged.length);
      merged.push({
        displayLabel,
        sceneIds: [z.sceneId],
        items: wrapped,
      });
    } else {
      merged[idx].sceneIds.push(z.sceneId);
      merged[idx].items.push(...wrapped);
    }
  }

  return merged;
}

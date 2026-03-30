import equipmentMenuReplacementsRaw from "@/data/equipment-menu-replacements.json";
import { catalogEquipmentRowDisplay } from "@/lib/catalogDisplayLabels";
import {
  mergeEquipmentCatalogZones,
  type MergedEquipmentZone,
} from "@/lib/mergedEquipmentZones";
import { TOUR_SCENES } from "@/lib/tourScenes";
import type { SceneInteractionsMap } from "@/types/interactions";
import type {
  EquipmentMenuReplacementEntry,
  EquipmentMenuReplacementsConfig,
} from "@/types/equipment-menu-replacements";

const CATALOG_ITEM_LABEL = "equipment" as const;

const equipmentMenuConfig =
  equipmentMenuReplacementsRaw as EquipmentMenuReplacementsConfig;

export type EquipmentCatalogSearchMatch =
  | { kind: "zone"; sceneId: string; label: string }
  | { kind: "equipment"; sceneId: string; buttonId: string; label: string };

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function textMatchesQuery(text: string, q: string): boolean {
  const qn = norm(q);
  if (!qn) return false;
  return norm(text).includes(qn);
}

/**
 * Plus petit indice dans `equipment-menu-replacements.json` qui « explique » le libellé
 * (sous-chaîne `to` ou `from` présente dans le libellé affiché).
 */
function minReplacementIndexForLabel(
  label: string,
  replacements: EquipmentMenuReplacementEntry[],
): number {
  const L = norm(label);
  let best = replacements.length;
  for (let i = 0; i < replacements.length; i++) {
    const to = norm(replacements[i].to ?? "");
    const from = norm(replacements[i].from ?? "");
    if (to && L.includes(to)) best = Math.min(best, i);
    if (from && L.includes(from)) best = Math.min(best, i);
  }
  return best;
}

/**
 * Scène cible pour une zone fusionnée : première entrée du JSON dont `from` est le titre
 * d’une scène du groupe (ex. « Micronique 19 » avant « Micronique 8 » si 19 est listé en premier).
 */
function sceneIdForMergedZoneFirstInReplacementsJson(
  zone: MergedEquipmentZone,
): string {
  const replacements = equipmentMenuConfig.replacements ?? [];
  for (const r of replacements) {
    const from = r.from?.trim();
    if (!from) continue;
    const sid = TOUR_SCENES.find(
      (s) =>
        zone.sceneIds.includes(s.id) && s.title.trim() === from,
    )?.id;
    if (sid) return sid;
  }
  return zone.sceneIds[0] ?? "";
}

function zoneMatchesQuery(zone: MergedEquipmentZone, q: string): boolean {
  if (textMatchesQuery(zone.displayLabel, q)) return true;
  for (const sid of zone.sceneIds) {
    const t = TOUR_SCENES.find((s) => s.id === sid)?.title ?? "";
    if (textMatchesQuery(t, q)) return true;
  }
  return false;
}

type Candidate = {
  match: EquipmentCatalogSearchMatch;
  sortKey: number;
};

/**
 * Un seul résultat : le meilleur candidat selon l’ordre du fichier
 * `equipment-menu-replacements.json`, puis zone avant équipement en cas d’égalité.
 */
export function findBestEquipmentCatalogSearchMatch(
  query: string,
  map: SceneInteractionsMap,
): EquipmentCatalogSearchMatch | null {
  const q = query.trim();
  if (!q) return null;

  const replacements = equipmentMenuConfig.replacements ?? [];
  const merged = mergeEquipmentCatalogZones(map);
  const candidates: Candidate[] = [];

  for (const z of merged) {
    if (!zoneMatchesQuery(z, q)) continue;
    const sceneId = sceneIdForMergedZoneFirstInReplacementsJson(z);
    if (!sceneId) continue;
    const sortKey = minReplacementIndexForLabel(z.displayLabel, replacements);
    candidates.push({
      match: { kind: "zone", sceneId, label: z.displayLabel },
      sortKey,
    });
  }

  for (const z of merged) {
    for (const { sceneId, button } of z.items) {
      const rowLabel = catalogEquipmentRowDisplay(
        button,
        z.displayLabel,
        CATALOG_ITEM_LABEL,
      );
      if (!textMatchesQuery(rowLabel, q)) continue;
      const sortKey = minReplacementIndexForLabel(rowLabel, replacements);
      candidates.push({
        match: {
          kind: "equipment",
          sceneId,
          buttonId: button.id,
          label: rowLabel,
        },
        sortKey,
      });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    if (a.match.kind !== b.match.kind) {
      return a.match.kind === "zone" ? -1 : 1;
    }
    return 0;
  });

  return candidates[0].match;
}

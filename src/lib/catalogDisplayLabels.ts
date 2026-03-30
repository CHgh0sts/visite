import catalogLabelsRaw from "@/data/catalog-labels.json";
import equipmentMenuReplacementsRaw from "@/data/equipment-menu-replacements.json";
import sceneNavRaw from "@/data/scene-nav.json";
import { TOUR_SCENES } from "@/lib/tourScenes";
import {
  buttonMenuLabel,
  type EquipmentCatalogItemLabelMode,
  type EquipmentCatalogZoneLabelMode,
  type SceneInteractionButton,
} from "@/types/interactions";
import type { CatalogLabelsConfig } from "@/types/catalog-labels";
import type { EquipmentMenuReplacementsConfig } from "@/types/equipment-menu-replacements";
import type { SceneNavConfig } from "@/types/scene-nav";

const config = catalogLabelsRaw as CatalogLabelsConfig;
const equipmentMenuConfig =
  equipmentMenuReplacementsRaw as EquipmentMenuReplacementsConfig;

const sceneNavLabelBySceneId = (() => {
  const nav = sceneNavRaw as SceneNavConfig;
  const m = new Map<string, string>();
  for (const item of nav.items ?? []) {
    const id = item.sceneId?.trim();
    if (!id) continue;
    const lab = item.label?.trim();
    if (!lab) continue;
    if (!m.has(id)) m.set(id, lab);
  }
  return m;
})();

function applyTextReplacements(s: string): string {
  let out = s;
  for (const r of config.textReplacements ?? []) {
    const from = r.from;
    if (from == null || from === "") continue;
    out = out.split(from).join(r.to ?? "");
  }
  return out;
}

/** Échappe pour une RegExp littérale (remplacements insensibles à la casse). */
function escapeRegExpChars(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Dictionnaire du menu équipements : zones + lignes machines (`equipment-menu-replacements.json`). */
function applyEquipmentMenuReplacements(s: string): string {
  let out = s;
  const raw = equipmentMenuConfig.replacements ?? [];
  const list = [...raw].sort(
    (a, b) => (b.from?.length ?? 0) - (a.from?.length ?? 0),
  );
  for (const r of list) {
    const from = r.from;
    if (from == null || from === "") continue;
    const to = r.to ?? "";
    if (r.exact === true) {
      if (out.trim().toLowerCase() === from.trim().toLowerCase()) out = to;
    } else {
      const re = new RegExp(escapeRegExpChars(from), "gi");
      out = out.replace(re, to);
    }
  }
  return out;
}

/** Chaîne finale affichée dans le menu catalogue (catalog-labels puis dictionnaire menu). */
function finalizeEquipmentMenuDisplay(s: string): string {
  return applyEquipmentMenuReplacements(applyTextReplacements(s));
}

/**
 * Libellé « humain » pour une scène dans le catalogue (barre zones, mode titre).
 * Ordre : `catalog-labels.json` → `scene-nav.json` → titre du tour → id.
 */
export function sceneDisplayNameForCatalog(sceneId: string): string {
  const sid = sceneId.trim();
  const fromFile = config.sceneLabels?.[sid]?.trim();
  if (fromFile) return finalizeEquipmentMenuDisplay(fromFile);
  const fromNav = sceneNavLabelBySceneId.get(sid);
  if (fromNav) return finalizeEquipmentMenuDisplay(fromNav);
  const tour = TOUR_SCENES.find((s) => s.id === sid);
  if (tour?.title?.trim()) return finalizeEquipmentMenuDisplay(tour.title.trim());
  return finalizeEquipmentMenuDisplay(sid);
}

function buttonOverrideLabel(buttonId: string): string | null {
  const v = config.buttonLabels?.[buttonId]?.trim();
  return v ? v : null;
}

/**
 * Texte affiché pour une ligne du catalogue selon les préférences (équipement / scène).
 * Mode équipement : nom du bouton sur la scène (`buttonMenuLabel`), pas le titre de modale.
 */
export function catalogEquipmentRowDisplay(
  b: SceneInteractionButton,
  zoneDisplayName: string,
  itemMode: EquipmentCatalogItemLabelMode,
): string {
  if (itemMode === "scene") return zoneDisplayName;
  const over = buttonOverrideLabel(b.id);
  const raw = over ?? buttonMenuLabel(b);
  return finalizeEquipmentMenuDisplay(raw);
}

/**
 * Libellé zone dans le catalogue (titre de scène ou identifiant technique).
 */
export function catalogZoneDisplay(
  sceneId: string,
  zoneMode: EquipmentCatalogZoneLabelMode,
): string {
  if (zoneMode === "sceneId") return finalizeEquipmentMenuDisplay(sceneId.trim());
  return sceneDisplayNameForCatalog(sceneId);
}

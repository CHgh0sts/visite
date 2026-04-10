import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { parseKrpanoXmlHotspotOverrides } from "@/lib/sceneInteractionsStorage";
import type { KrpanoXmlHotspotOverridesByScene } from "@/types/interactions";

/** JSON sérialisable pour Prisma (supprime undefined, NaN, etc.). */
export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

type SceneWithInteractions = {
  name: string;
  interactions: Array<{ hotspotId: string; settings: unknown }>;
};

/**
 * Construit la même structure que `krpanoXmlHotspotOverrides` (appliquée côté viewer via JS,
 * équivalent « XML » runtime par scène) à partir des lignes relationnelles.
 */
export function buildHotspotOverridesFromDb(
  scenes: SceneWithInteractions[],
): KrpanoXmlHotspotOverridesByScene {
  const raw: Record<string, Record<string, unknown>> = {};
  for (const s of scenes) {
    if (!s.interactions?.length) continue;
    raw[s.name] = {};
    for (const hi of s.interactions) {
      raw[s.name][hi.hotspotId] = hi.settings as Record<string, unknown>;
    }
  }
  return parseKrpanoXmlHotspotOverrides(raw);
}

/**
 * Upsert chaque paire (scène krpano, nom hotspot) à partir du document client.
 * Les scènes sont créées si absentes (`Scene.name` = id scène krpano).
 */
export async function syncHotspotInteractionsFromPayload(
  overrides: KrpanoXmlHotspotOverridesByScene,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = tx ?? prisma;
  for (const [sceneName, hmap] of Object.entries(overrides)) {
    if (!sceneName.trim() || !hmap || typeof hmap !== "object") continue;
    const scene = await db.scene.upsert({
      where: { name: sceneName.trim() },
      create: { name: sceneName.trim() },
      update: {},
    });
    for (const [hotspotId, settings] of Object.entries(hmap)) {
      if (!hotspotId.trim()) continue;
      if (!settings || typeof settings !== "object" || Array.isArray(settings)) continue;
      if (Object.keys(settings as object).length === 0) continue;
      await db.hotspotInteraction.upsert({
        where: {
          sceneId_hotspotId: { sceneId: scene.id, hotspotId: hotspotId.trim() },
        },
        create: {
          sceneId: scene.id,
          hotspotId: hotspotId.trim(),
          settings: toPrismaJson(settings),
        },
        update: { settings: toPrismaJson(settings) },
      });
    }
  }
}

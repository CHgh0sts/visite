import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * Supprime une ligne HotspotInteraction (ex. réinitialisation des surcharges côté client).
 * GET query : ?sceneName=scene_micronique_1&hotspotId=MonSpot
 */
export async function DELETE(req: Request) {
  try {
    const u = new URL(req.url);
    const sceneName = u.searchParams.get("sceneName")?.trim();
    const hotspotId = u.searchParams.get("hotspotId")?.trim();
    if (!sceneName || !hotspotId) {
      return NextResponse.json(
        { error: "Paramètres requis : sceneName, hotspotId" },
        { status: 400 },
      );
    }
    const scene = await prisma.scene.findUnique({
      where: { name: sceneName },
    });
    if (!scene) {
      return NextResponse.json({ ok: true, deleted: 0 });
    }
    const r = await prisma.hotspotInteraction.deleteMany({
      where: { sceneId: scene.id, hotspotId },
    });
    return NextResponse.json({ ok: true, deleted: r.count });
  } catch (e) {
    console.error("[hotspot-interactions DELETE]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "base_indisponible", details: msg },
      { status: 503 },
    );
  }
}

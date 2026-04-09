import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  parseKrpanoNavigationHotspotStyle,
  parseKrpanoXmlHotspotOverrides,
  parseSceneInteractionsDocument,
  parseSceneInteractionsPayload,
} from "@/lib/sceneInteractionsStorage";

/** JSON 100 % sérialisable pour la colonne Prisma (supprime undefined, NaN, etc.). */
function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const SNAPSHOT_ID = "default";

export async function GET() {
  try {
    const row = await prisma.sceneInteractionsSnapshot.findUnique({
      where: { id: SNAPSHOT_ID },
    });
    const doc = row?.payload
      ? parseSceneInteractionsDocument(row.payload)
      : { map: {} };
    return NextResponse.json({
      map: doc.map,
      krpanoNavigationHotspotStyle: doc.krpanoNavigationHotspotStyle ?? null,
      krpanoXmlHotspotOverrides: doc.krpanoXmlHotspotOverrides ?? null,
    });
  } catch (e) {
    console.error("[scene-interactions GET]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        map: {},
        krpanoNavigationHotspotStyle: null,
        krpanoXmlHotspotOverrides: null,
        error: "base_indisponible",
        details: msg,
      },
      { status: 503 },
    );
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const mapRaw = b.map;
  if (mapRaw == null || typeof mapRaw !== "object") {
    return NextResponse.json(
      { error: "Corps attendu : { map : { [sceneId]: boutons[] }, krpanoNavigationHotspotStyle? }" },
      { status: 400 },
    );
  }

  const map = parseSceneInteractionsPayload(mapRaw);
  const styleRaw = b.krpanoNavigationHotspotStyle;
  const parsedStyle = parseKrpanoNavigationHotspotStyle(styleRaw);
  const styleMerged =
    styleRaw && typeof styleRaw === "object" && !Array.isArray(styleRaw)
      ? ({
          ...(styleRaw as Record<string, unknown>),
          ...(parsedStyle ?? {}),
        } as Record<string, unknown>)
      : parsedStyle ?? {};
  const overridesRaw = b.krpanoXmlHotspotOverrides;
  const krpanoXmlHotspotOverrides =
    overridesRaw !== undefined &&
    overridesRaw !== null &&
    typeof overridesRaw === "object" &&
    !Array.isArray(overridesRaw)
      ? parseKrpanoXmlHotspotOverrides(overridesRaw)
      : {};

  const payload = toPrismaJson({
    map,
    krpanoNavigationHotspotStyle: styleMerged,
    krpanoXmlHotspotOverrides,
  });

  try {
    const row = await prisma.sceneInteractionsSnapshot.upsert({
      where: { id: SNAPSHOT_ID },
      create: {
        id: SNAPSHOT_ID,
        payload,
      },
      update: {
        payload,
      },
    });
    return NextResponse.json({
      ok: true,
      id: row.id,
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (e) {
    console.error("[scene-interactions POST]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: "Erreur base de données",
        details: msg,
      },
      { status: 503 },
    );
  }
}

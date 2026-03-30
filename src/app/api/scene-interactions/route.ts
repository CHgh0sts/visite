import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { parseSceneInteractionsPayload } from "@/lib/sceneInteractionsStorage";

const SNAPSHOT_ID = "default";

export async function GET() {
  try {
    const row = await prisma.sceneInteractionsSnapshot.findUnique({
      where: { id: SNAPSHOT_ID },
    });
    const map = row?.payload
      ? parseSceneInteractionsPayload(row.payload)
      : {};
    return NextResponse.json({ map });
  } catch (e) {
    console.error("[scene-interactions GET]", e);
    return NextResponse.json(
      { map: {}, error: "base_indisponible" },
      { status: 200 },
    );
  }
}

export async function POST(req: Request) {
  const secret = process.env.SCENE_INTERACTIONS_WRITE_SECRET;
  if (!secret?.trim()) {
    return NextResponse.json(
      { error: "Écriture non configurée (SCENE_INTERACTIONS_WRITE_SECRET)" },
      { status: 503 },
    );
  }
  const headerSecret = req.headers.get("x-scene-interactions-secret")?.trim();
  if (!headerSecret || headerSecret !== secret) {
    return NextResponse.json({ error: "Secret invalide" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const raw =
    body &&
    typeof body === "object" &&
    "map" in body &&
    (body as { map: unknown }).map != null
      ? (body as { map: unknown }).map
      : null;

  if (!raw || typeof raw !== "object") {
    return NextResponse.json(
      { error: "Corps attendu : { map : { [sceneId]: boutons[] } }" },
      { status: 400 },
    );
  }

  const map = parseSceneInteractionsPayload(raw);

  try {
    await prisma.sceneInteractionsSnapshot.upsert({
      where: { id: SNAPSHOT_ID },
      create: {
        id: SNAPSHOT_ID,
        payload: map as object,
      },
      update: {
        payload: map as object,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[scene-interactions POST]", e);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }
}

import type {
  KrpanoNavigationHotspotStyle,
  KrpanoXmlHotspotOverridesByScene,
  SceneInteractionsMap,
} from "@/types/interactions";

export async function postSceneInteractionsToServer(
  map: SceneInteractionsMap,
  krpanoNavigationHotspotStyle?: KrpanoNavigationHotspotStyle,
  krpanoXmlHotspotOverrides?: KrpanoXmlHotspotOverridesByScene,
): Promise<
  | { ok: true; updatedAt?: string }
  | { ok: false; error: string; details?: string }
> {
  /** Document complet à chaque envoi — évite d’effacer des clés côté API. */
  const body: Record<string, unknown> = {
    map,
    krpanoNavigationHotspotStyle: krpanoNavigationHotspotStyle ?? {},
    krpanoXmlHotspotOverrides: krpanoXmlHotspotOverrides ?? {},
  };
  const res = await fetch("/api/scene-interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    details?: string;
    updatedAt?: string;
  };
  if (!res.ok) {
    return {
      ok: false,
      error: data.error ?? `HTTP ${res.status}`,
      details: data.details,
    };
  }
  return { ok: true, updatedAt: data.updatedAt };
}

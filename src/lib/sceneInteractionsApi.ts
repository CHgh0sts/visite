import type { SceneInteractionsMap } from "@/types/interactions";

export async function postSceneInteractionsToServer(
  map: SceneInteractionsMap,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/scene-interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ map }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: data.error ?? `HTTP ${res.status}` };
  }
  return { ok: true };
}

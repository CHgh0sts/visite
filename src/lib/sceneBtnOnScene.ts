import type { SceneInteractionButton } from "@/types/interactions";

/**
 * Décalage horizontal (px) entre le centre du bouton et le bord de la boîte modale :
 * demi-largeur visuelle × échelle + marge.
 */
export function sceneButtonAnchorOffsetPx(b: SceneInteractionButton): number {
  const half = b.contentType === "image" ? 28 : 22.5;
  const s =
    typeof b.sceneBtnScale === "number" &&
    Number.isFinite(b.sceneBtnScale) &&
    b.sceneBtnScale > 0
      ? b.sceneBtnScale
      : 1;
  return half * s + 12;
}

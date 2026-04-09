import type { CSSProperties } from "react";

import type { SceneInteractionButton } from "@/types/interactions";

const DEFAULT_BG = "#ffffff";
const DEFAULT_FG = "#0e203d";
const DEFAULT_HOVER_BG = "#0e203d";
const DEFAULT_HOVER_FG = "#ffffff";

/** Classes Tailwind du bouton par défaut (sans couleurs custom) — style Micronique aligné sur la dock / SceneNavBar. */
export const interactionBtnDefaultClass =
  "border border-white/65 bg-white/[0.88] text-[#0e203d] shadow-[0_4px_18px_rgba(15,23,42,0.12)] backdrop-blur-md transition hover:border-[#0e203d]/35 hover:bg-[#0e203d] hover:text-white hover:shadow-[0_6px_22px_rgba(15,23,42,0.2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0e203d]/35";

export function hasCustomInteractionColors(b: SceneInteractionButton): boolean {
  return !!(
    b.bgColor?.trim() ||
    b.fgColor?.trim() ||
    b.hoverBgColor?.trim() ||
    b.hoverFgColor?.trim()
  );
}

/**
 * Styles pour bouton avec couleurs personnalisées (variables CSS + classe .ix-interaction-btn).
 */
export function interactionButtonCustomStyle(
  b: SceneInteractionButton,
): CSSProperties {
  const bg = b.bgColor?.trim() || DEFAULT_BG;
  const fg = b.fgColor?.trim() || DEFAULT_FG;
  const hbg = b.hoverBgColor?.trim() || DEFAULT_HOVER_BG;
  const hfg = b.hoverFgColor?.trim() || DEFAULT_HOVER_FG;
  return {
    ["--ix-bg" as string]: bg,
    ["--ix-fg" as string]: fg,
    ["--ix-bg-hover" as string]: hbg,
    ["--ix-fg-hover" as string]: hfg,
  };
}

export const interactionBtnCustomClass =
  "ix-interaction-btn border border-black/[0.08] shadow-[0_4px_16px_rgba(15,23,42,0.1)] backdrop-blur-md transition hover:border-[#0e203d]/25 hover:shadow-[0_6px_20px_rgba(15,23,42,0.15)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0e203d]/40";

const DEFAULT_BTN_BORDER_RGBA = "rgba(14, 32, 61, 0.2)";

/** Bordure inline pour le bouton sur scène (surcharge les classes Tailwind par défaut). */
export function sceneButtonBorderStyle(
  b: SceneInteractionButton,
): CSSProperties | undefined {
  const w = b.sceneBtnBorderWidthPx;
  const c = b.sceneBtnBorderColor?.trim();
  const explicitW = typeof w === "number" && Number.isFinite(w);
  if (explicitW && w === 0) {
    return {
      borderWidth: 0,
      borderStyle: "none",
      borderColor: "transparent",
    };
  }
  if (explicitW && w > 0) {
    return {
      borderWidth: `${w}px`,
      borderStyle: "solid",
      borderColor: c || DEFAULT_BTN_BORDER_RGBA,
    };
  }
  if (!explicitW && c) {
    return {
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: c,
    };
  }
  return undefined;
}

/**
 * Classes bordure par défaut (fine) — à omettre quand `sceneButtonBorderStyle` s’applique.
 * Bouton image : sans bordure fine par défaut (l’anneau `ring` suffit).
 */
export function sceneButtonBorderTailwindClass(
  b: SceneInteractionButton,
  isImageButton = false,
): string {
  const w = b.sceneBtnBorderWidthPx;
  const c = b.sceneBtnBorderColor?.trim();
  const explicitW = typeof w === "number" && Number.isFinite(w);
  if (explicitW && w === 0) return "border-0";
  if ((explicitW && w > 0) || (!explicitW && !!c)) return "border-0";
  if (isImageButton) return "border-0";
  /* Bordure portée par interactionBtnDefaultClass / interactionBtnCustomClass (verre Micronique). */
  return "";
}

/** Pour les boutons image : anneau par défaut ou désactivé si bordure personnalisée. */
export function sceneButtonImageRingClass(
  b: SceneInteractionButton,
): string {
  const w = b.sceneBtnBorderWidthPx;
  const c = b.sceneBtnBorderColor?.trim();
  const explicitW = typeof w === "number" && Number.isFinite(w);
  const customBorder =
    explicitW || (!explicitW && !!c);
  if (customBorder) return "ring-0";
  return "ring-2";
}

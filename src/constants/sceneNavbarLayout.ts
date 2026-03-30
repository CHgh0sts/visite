/**
 * Hauteur réservée en bas d’écran par `SceneNavBar` (Dock) :
 * `pt-6` + `h-14` + `pb` (safe area) — doit rester aligné avec `SceneNavBar.tsx`.
 * À utiliser pour les éléments flottants au-dessus de la barre.
 */
export const SCENE_NAVBAR_BOTTOM_RESERVE =
  "calc(1.5rem + 3.5rem + max(0.5rem, env(safe-area-inset-bottom)))";

/**
 * Même `calc` en classe Tailwind (`padding-bottom`) pour éviter les styles inline.
 */
export const sceneNavbarBottomReservePaddingClass =
  "pb-[calc(1.5rem+3.5rem+max(0.5rem,env(safe-area-inset-bottom)))]";

/**
 * Bas d’un élément `position: fixed` aligné sur le même repère que le panneau « Interactions » (au-dessus du dock).
 */
export const sceneNavbarBottomAlignClass =
  "bottom-[calc(1.5rem+3.5rem+max(0.5rem,env(safe-area-inset-bottom)))]";

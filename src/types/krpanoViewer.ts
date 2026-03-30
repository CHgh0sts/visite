/**
 * Sous-ensemble de l’interface JS krpano utilisée pour l’ancrage des boutons.
 * @see https://krpano.com/docu/js/
 */
export type KrpanoViewer = {
  call: (action: string) => void;
  get?: (path: string) => unknown;
  /** Écran (x,y) → sphère ; le résultat utilise x = h (ath), y = v (atv). */
  screentosphere: (
    x: number,
    y: number,
  ) => { x: number; y: number } | null;
  /** Sphère (h,v) → écran (x,y) ; null si derrière la caméra / invalide. */
  spheretoscreen: (
    h: number,
    v: number,
  ) => { x: number; y: number } | null;
};

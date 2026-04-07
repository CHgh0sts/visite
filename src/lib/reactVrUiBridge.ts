/**
 * Pont krpano → React : les hotspots VR appellent `jscall(reactKrpano.vr*())`.
 * Les composants enregistrent leurs callbacks (merge partiel, nettoyage au démontage).
 */

export type ReactVrUiCallbacks = {
  /** Catalogue équipements (menu). */
  toggleCatalog: () => void;
  /** Recherche zone / équipement. */
  toggleSearch: () => void;
  /** Entrée / sortie WebXR (casque). */
  toggleVr: () => void;
  /** Dock : scène précédente (scene-nav.json). */
  dockPrev: () => void;
  /** Dock : scène suivante. */
  dockNext: () => void;
};

let callbacks: Partial<ReactVrUiCallbacks> = {};

export function setReactVrUiCallbacks(
  next: Partial<ReactVrUiCallbacks>,
): void {
  callbacks = { ...callbacks, ...next };
}

export function getReactVrUiCallbacks(): Partial<ReactVrUiCallbacks> {
  return callbacks;
}

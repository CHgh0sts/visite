/**
 * En session immersive-vr, le navigateur compose en général uniquement le WebGL dans le casque.
 * Sans DOM Overlay, tout le DOM (bottom bar, panneaux, etc.) est invisible.
 * Ce module patch `navigator.xr.requestSession` pour demander `dom-overlay` et un `domOverlay.root`
 * afin que l’UI HTML reste visible en VR quand le casque le supporte.
 *
 * Le type d’overlay (écran / flottant / « head-locked ») dépend du navigateur ; sur Quest Browser,
 * l’UI reste en général lisible devant vous. Si le support manque, on retombe sur l’appel d’origine.
 */

let installed = false;

function mergeDomOverlayInit(init?: XRSessionInit): XRSessionInit {
  const base: XRSessionInit = init ? { ...init } : {};
  const optional = [...(base.optionalFeatures ?? [])];
  if (!optional.includes("dom-overlay")) {
    optional.push("dom-overlay");
  }
  base.optionalFeatures = optional;
  if (!base.domOverlay?.root) {
    const root = document.body ?? document.documentElement;
    base.domOverlay = { root };
  }
  return base;
}

export function installWebXrDomOverlayPatch(): void {
  if (typeof window === "undefined" || installed) return;
  const xr = navigator.xr;
  if (!xr || typeof xr.requestSession !== "function") return;
  installed = true;

  const orig = xr.requestSession.bind(xr);

  xr.requestSession = async (mode, init) => {
    const withOverlay = mergeDomOverlayInit(init);
    try {
      return await orig(mode, withOverlay);
    } catch {
      return await orig(mode, init);
    }
  };
}

installWebXrDomOverlayPatch();

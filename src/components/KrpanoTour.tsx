"use client";

import "@/lib/webxrDomOverlayPatch";

import { useEffect, useId, useRef } from "react";

import { KRPANO_START_SCENE } from "@/constants/krpano";
import {
  clearPendingReactLookAt,
  hideKrpanoTourChrome,
  onReactPanoLoadComplete,
  resetKrpanoVrNavbarVisibilityCache,
  setKrpanoViewerForLoadComplete,
  syncKrpanoVrNavbarVisibility,
  tryApplyPendingLookAtForScene,
} from "@/lib/krpanoNavigation";
import { getReactVrUiCallbacks } from "@/lib/reactVrUiBridge";
import type { KrpanoViewer } from "@/types/krpanoViewer";

/**
 * Préfixe proxifié par Next (`next.config` rewrites → worker).
 * Obligatoire en local : krpano refuse le XML « externe » (External Access Denied).
 */
export const MICRONIQUE_PROXY_PREFIX = "/micronique-assets";

let krpanoScriptPromise: Promise<void> | null = null;

function loadKrpanoScript(assetBase: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("SSR"));
  }
  if (typeof window.embedpano === "function") {
    return Promise.resolve();
  }
  if (krpanoScriptPromise) {
    return krpanoScriptPromise;
  }
  const scriptUrl = `${assetBase}/krpano.js`;
  krpanoScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${scriptUrl}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("krpano.js")),
        { once: true },
      );
      return;
    }
    const s = document.createElement("script");
    s.src = scriptUrl;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Impossible de charger krpano.js"));
    document.body.appendChild(s);
  });
  return krpanoScriptPromise;
}

export type KrpanoViewerContextPayload = {
  krpano: KrpanoViewer;
  /** Élément cible d’`embedpano` — même repère que `screentosphere` / `spheretoscreen`. */
  containerId: string;
};

type KrpanoTourProps = {
  className?: string;
  /**
   * Début du chargement d’une nouvelle scène (`onnewscene` dans tour.xml) — masquer l’overlay
   * avant le blend pour éviter des boutons à la mauvaise position.
   */
  onSceneTransitionStart?: () => void;
  /** Appelé quand le fondu vers la nouvelle scène est terminé (`onblendcomplete` dans tour.xml). */
  onSceneChange?: (sceneName: string) => void;
  onStart?: () => void;
  /** Viewer prêt : conversions écran ↔ sphère pour les boutons ancrés dans le panorama. */
  onViewerReady?: (ctx: KrpanoViewerContextPayload) => void;
};

/**
 * Panorama krpano (même flux que micronique.juumo.fr) via le worker public.
 * Le tour.xml appelle reactKrpano.onStart / onSceneChange (fin du blend pano via onblendcomplete).
 */
export function KrpanoTour({
  className,
  onSceneTransitionStart,
  onSceneChange,
  onStart,
  onViewerReady,
}: KrpanoTourProps) {
  const reactId = useId();
  const targetId = `krpano-target-${reactId.replace(/:/g, "")}`;
  const viewerId = `krpano-viewer-${reactId.replace(/:/g, "")}`;
  const embeddedRef = useRef(false);
  const onSceneTransitionStartRef = useRef(onSceneTransitionStart);
  const onSceneChangeRef = useRef(onSceneChange);
  const onStartRef = useRef(onStart);
  const onViewerReadyRef = useRef(onViewerReady);
  onSceneTransitionStartRef.current = onSceneTransitionStart;
  onSceneChangeRef.current = onSceneChange;
  onStartRef.current = onStart;
  onViewerReadyRef.current = onViewerReady;

  useEffect(() => {
    let cancelled = false;
    const assetBase = `${window.location.origin}${MICRONIQUE_PROXY_PREFIX}`;

    window.reactKrpano = {
      onStart() {
        onStartRef.current?.();
      },
      onSceneTransitionStart() {
        try {
          onSceneTransitionStartRef.current?.();
        } catch (e) {
          console.error("[krpano] onSceneTransitionStart", e);
        }
      },
      onSceneChange(sceneName: string) {
        try {
          /* lookat avant le setState parent pour limiter un flash d’UI sur la mauvaise scène */
          tryApplyPendingLookAtForScene(sceneName);
          onSceneChangeRef.current?.(sceneName);
        } catch (e) {
          console.error("[krpano] onSceneChange", e);
        }
      },
      onPanoLoadComplete() {
        try {
          onReactPanoLoadComplete();
        } catch (e) {
          console.error("[krpano] onPanoLoadComplete", e);
        }
      },
      vrToggleMenu() {
        try {
          getReactVrUiCallbacks().toggleCatalog?.();
        } catch (e) {
          console.error("[krpano] vrToggleMenu", e);
        }
      },
      vrToggleSearch() {
        try {
          getReactVrUiCallbacks().toggleSearch?.();
        } catch (e) {
          console.error("[krpano] vrToggleSearch", e);
        }
      },
      vrToggleVr() {
        try {
          getReactVrUiCallbacks().toggleVr?.();
        } catch (e) {
          console.error("[krpano] vrToggleVr", e);
        }
      },
      vrNavigateToScene(sceneId: string) {
        try {
          getReactVrUiCallbacks().navigateToScene?.(sceneId);
        } catch (e) {
          console.error("[krpano] vrNavigateToScene", e);
        }
      },
    };

    loadKrpanoScript(assetBase)
      .then(() => {
        if (cancelled || embeddedRef.current) return;
        const embed = window.embedpano;
        if (typeof embed !== "function") {
          console.error("embedpano indisponible après chargement de krpano.js");
          return;
        }
        embed({
          xml: `${assetBase}/tour-visite.xml`,
          target: targetId,
          id: viewerId,
          html5: "only",
          /**
           * false : sinon les query params de la page peuvent vider / écraser `startscene`
           * → écran noir au rechargement tant qu’on ne clique pas une miniature.
           */
          passQueryParameters: false,
          initvars: { startscene: KRPANO_START_SCENE },
          /* Chemins %VIEWER% (plugins) + résolution cohérente si krpano.js est chargé dynamiquement */
          basepath: `${assetBase}/`,
          consolelog: process.env.NODE_ENV === "development",
          onready(krpano) {
            if (cancelled) return;
            const viewer = krpano as KrpanoViewer;
            setKrpanoViewerForLoadComplete(viewer);
            onViewerReadyRef.current?.({
              krpano: viewer,
              containerId: targetId,
            });
            /* Barre / miniatures krpano masquées — navigation gérée par `SceneNavBar` + JSON. */
            hideKrpanoTourChrome(viewer);
            syncKrpanoVrNavbarVisibility(viewer);
            /* Recharge fiable : loadscene explicite après init viewer + skin */
            krpano.call(
              `delayedcall(0, loadscene('${KRPANO_START_SCENE}', null, MERGE, BLEND(0)));`,
            );
          },
        });
        if (cancelled) {
          try {
            window.removepano?.(viewerId);
          } catch {
            /* ignore */
          }
          return;
        }
        embeddedRef.current = true;
      })
      .catch((err) => {
        console.error(err);
      });

    return () => {
      cancelled = true;
      resetKrpanoVrNavbarVisibilityCache();
      setKrpanoViewerForLoadComplete(null);
      clearPendingReactLookAt();
      if (embeddedRef.current && typeof window.removepano === "function") {
        try {
          window.removepano(viewerId);
        } catch {
          /* ignore */
        }
        embeddedRef.current = false;
      }
    };
  }, [targetId, viewerId]);

  return (
    <div
      className={
        className ??
        "fixed inset-0 z-0 h-dvh min-h-dvh w-full max-w-full bg-black"
      }
      id={targetId}
      aria-label="Visite virtuelle 360°"
    />
  );
}

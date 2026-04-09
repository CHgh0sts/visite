"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { HotspotXmlEditor } from "@/components/HotspotXmlEditor";
import { KrpanoTour } from "@/components/KrpanoTour";
import { KrpanoVrToggleButton } from "@/components/KrpanoVrToggleButton";
import { KrpanoViewHud } from "@/components/KrpanoViewHud";
import { SceneNavBar } from "@/components/SceneNavBar";
import { KRPANO_START_SCENE } from "@/constants/krpano";
import {
  applyKrpanoNavigationHotspotStyle,
  applyKrpanoXmlHotspotOverrides,
  getKrpanoViewerForTour,
  setKrpanoAfterPanoLoadCallback,
} from "@/lib/krpanoNavigation";
import { postSceneInteractionsToServer } from "@/lib/sceneInteractionsApi";
import {
  getDefaultInteractions,
  getDefaultKrpanoNavigationHotspotStyle,
  getDefaultKrpanoXmlHotspotOverrides,
  loadSiteInteractionsDocument,
} from "@/lib/sceneInteractionsStorage";
import { useIdleHomeRedirect } from "@/hooks/useIdleHomeRedirect";
import type { KrpanoViewer } from "@/types/krpanoViewer";
import type {
  KrpanoNavigationHotspotStyle,
  KrpanoXmlHotspotOverridesByScene,
  SceneInteractionsMap,
} from "@/types/interactions";

export function VisiteShell() {
  useIdleHomeRedirect(true, false);
  const [sceneName, setSceneName] = useState(KRPANO_START_SCENE);
  const hasCompletedFirstBlendRef = useRef(false);
  const [map, setMap] = useState<SceneInteractionsMap>(getDefaultInteractions);
  const [interactionsHydrated, setInteractionsHydrated] = useState(false);
  const [dbUnavailable, setDbUnavailable] = useState(false);
  const [krpano, setKrpano] = useState<KrpanoViewer | null>(null);
  const [viewerContainerId, setViewerContainerId] = useState<string | null>(
    null,
  );
  const [krpanoNavigationHotspotStyle, setKrpanoNavigationHotspotStyle] =
    useState<KrpanoNavigationHotspotStyle | undefined>(() =>
      getDefaultKrpanoNavigationHotspotStyle(),
    );
  const [krpanoXmlHotspotOverrides, setKrpanoXmlHotspotOverrides] =
    useState<KrpanoXmlHotspotOverridesByScene>(() =>
      getDefaultKrpanoXmlHotspotOverrides(),
    );

  const styleRef = useRef(krpanoNavigationHotspotStyle);
  const overridesRef = useRef(krpanoXmlHotspotOverrides);
  styleRef.current = krpanoNavigationHotspotStyle;
  overridesRef.current = krpanoXmlHotspotOverrides;

  /** Réapplique style global + surcharges hotspots après chaque chargement de pano (XML scène prêt). */
  useEffect(() => {
    setKrpanoAfterPanoLoadCallback(() => {
      const k = getKrpanoViewerForTour();
      if (!k) return;
      const scene = k.get?.("xml.scene");
      if (typeof scene !== "string") return;
      applyKrpanoNavigationHotspotStyle(k, styleRef.current);
      applyKrpanoXmlHotspotOverrides(k, scene, overridesRef.current);
    });
    return () => setKrpanoAfterPanoLoadCallback(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadSiteInteractionsDocument().then((d) => {
      if (cancelled) return;
      setMap(d.map);
      if (d.krpanoNavigationHotspotStyle) {
        setKrpanoNavigationHotspotStyle(d.krpanoNavigationHotspotStyle);
      }
      setKrpanoXmlHotspotOverrides(
        d.krpanoXmlHotspotOverrides ?? getDefaultKrpanoXmlHotspotOverrides(),
      );
      setDbUnavailable(d.dbUnavailable === true);
      setInteractionsHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!interactionsHydrated || dbUnavailable) return;
    const t = window.setTimeout(() => {
      void postSceneInteractionsToServer(
        map,
        krpanoNavigationHotspotStyle,
        krpanoXmlHotspotOverrides,
      ).then((r) => {
        if (!r.ok) {
          console.warn("[scene-interactions] auto-save:", r.error, r.details ?? "");
          setDbUnavailable(true);
        }
      });
    }, 400);
    return () => clearTimeout(t);
  }, [
    map,
    krpanoNavigationHotspotStyle,
    krpanoXmlHotspotOverrides,
    interactionsHydrated,
    dbUnavailable,
  ]);

  useEffect(() => {
    if (!krpano) return;
    applyKrpanoNavigationHotspotStyle(krpano, krpanoNavigationHotspotStyle);
    applyKrpanoXmlHotspotOverrides(krpano, sceneName, krpanoXmlHotspotOverrides);
  }, [krpano, krpanoNavigationHotspotStyle, sceneName, krpanoXmlHotspotOverrides]);

  const [shellPanelsVisible, setShellPanelsVisible] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        setShellPanelsVisible((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="fixed inset-0">
      <KrpanoTour
        className="absolute inset-0 z-0 h-dvh min-h-dvh w-full max-w-full bg-black"
        onSceneChange={(name) => {
          hasCompletedFirstBlendRef.current = true;
          setSceneName(name);
        }}
        onViewerReady={({ krpano: k, containerId }) => {
          setKrpano(k);
          setViewerContainerId(containerId);
        }}
      />
      <div className="visite-react-ui pointer-events-none absolute inset-0 z-[1]">
        {dbUnavailable ? (
          <div
            role="alert"
            className="pointer-events-auto fixed left-3 right-3 top-14 z-[88] max-w-none rounded-lg border border-amber-700/80 bg-amber-950/90 px-3 py-2 text-xs text-amber-100 shadow-lg sm:left-auto sm:right-4 sm:max-w-md"
          >
            PostgreSQL injoignable : les réglages ne sont pas sauvegardés. Vérifiez{" "}
            <code className="rounded bg-black/30 px-1">DATABASE_URL</code> et les logs du
            serveur Next.
          </div>
        ) : null}
        <Link
          href="/"
          className="pointer-events-auto fixed left-3 top-3 z-[85] block w-[min(48vw,9rem)] max-w-[10rem] outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/50 sm:left-4 sm:top-4 sm:w-[min(36vw,11rem)] sm:max-w-[11rem]"
          aria-label="Micronique — retour à l’accueil"
        >
          <img
            src="/images/global/micronique.webp"
            alt="Micronique"
            width={280}
            height={93}
            className="h-auto w-full object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]"
            decoding="async"
          />
        </Link>
        <div className="pointer-events-auto fixed right-4 top-4 z-[90]">
          <KrpanoVrToggleButton krpano={krpano} />
        </div>
        <KrpanoViewHud
          krpano={krpano}
          sceneName={sceneName}
          visible={shellPanelsVisible}
        />
        <SceneNavBar krpano={krpano} currentSceneId={sceneName} />
        <HotspotXmlEditor
          key={sceneName}
          sceneName={sceneName}
          map={map}
          onMapChange={setMap}
          krpano={krpano}
          viewerContainerId={viewerContainerId}
          krpanoNavigationHotspotStyle={krpanoNavigationHotspotStyle}
          onKrpanoNavigationHotspotStyleChange={setKrpanoNavigationHotspotStyle}
          krpanoXmlHotspotOverrides={krpanoXmlHotspotOverrides}
          onKrpanoXmlHotspotOverridesChange={setKrpanoXmlHotspotOverrides}
          shellPanelsVisible={shellPanelsVisible}
          dbUnavailable={dbUnavailable}
        />
      </div>
    </div>
  );
}

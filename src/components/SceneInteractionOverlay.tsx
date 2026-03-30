"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { InteractionButtonView } from "@/components/InteractionButtonView";
import { InteractionContentPanel } from "@/components/InteractionContentModal";
import {
  adjustedAthAtvToCenterModalBesideButton,
  getKrpanoViewSnapshot,
  hideKrpanoTourChrome,
  loadKrpanoScene,
  tweenKrpanoViewToAnchor,
  tweenKrpanoViewToSnapshot,
} from "@/lib/krpanoNavigation";
import { sceneButtonAnchorOffsetPx } from "@/lib/sceneBtnOnScene";
import type { KrpanoViewer } from "@/types/krpanoViewer";
import {
  hasModalContent,
  isSphereAnchored,
  type SceneInteractionButton,
  type SceneInteractionsMap,
} from "@/types/interactions";

function ScreenPercentButtons({
  buttons,
  onActivate,
  highlightButtonId,
}: {
  buttons: SceneInteractionButton[];
  onActivate: (b: SceneInteractionButton) => void;
  /** Synchronisé avec le survol de la liste dans l’éditeur. */
  highlightButtonId: string | null;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      {buttons.map((b) => {
        const hi = highlightButtonId === b.id;
        return (
          <div
            key={b.id}
            className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-150 ${
              hi ? "z-[70] scale-110" : ""
            }`}
            style={{
              top: `${b.topPct ?? 0}%`,
              left: `${b.leftPct ?? 0}%`,
            }}
          >
            <div
              className={
                hi
                  ? "rounded-full ring-[3px] ring-sky-400 ring-offset-[3px] ring-offset-black/50 shadow-[0_0_22px_rgba(56,189,248,0.65)]"
                  : undefined
              }
            >
              <InteractionButtonView b={b} onActivate={() => onActivate(b)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Boutons ancrés dans le panorama (ath/atv) : position mise à jour chaque frame via spheretoscreen.
 */
function SphereAnchoredButtons({
  krpano,
  buttons,
  onActivate,
  highlightButtonId,
}: {
  krpano: KrpanoViewer;
  buttons: SceneInteractionButton[];
  onActivate: (b: SceneInteractionButton) => void;
  highlightButtonId: string | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef(buttons);
  buttonsRef.current = buttons;
  const rafRef = useRef(0);

  useEffect(() => {
    const tick = () => {
      const wrap = wrapRef.current;
      const list = buttonsRef.current;
      if (wrap && list.length > 0) {
        for (const b of list) {
          const el = wrap.querySelector(
            `[data-ix-sphere="${b.id}"]`,
          ) as HTMLElement | null;
          if (!el || b.ath === undefined || b.atv === undefined) continue;

          const p = krpano.spheretoscreen(b.ath, b.atv);
          if (
            !p ||
            Number.isNaN(p.x) ||
            Number.isNaN(p.y) ||
            p.x === null ||
            p.y === null
          ) {
            el.style.visibility = "hidden";
            el.style.pointerEvents = "none";
          } else {
            el.style.visibility = "visible";
            el.style.pointerEvents = "auto";
            el.style.left = `${p.x}px`;
            el.style.top = `${p.y}px`;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [krpano]);

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none absolute inset-0 z-50 overflow-visible"
    >
      {buttons.map((b) => {
        const hi = highlightButtonId === b.id;
        return (
          <div
            key={b.id}
            data-ix-sphere={b.id}
            className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 will-change-[left,top] transition-transform duration-150 ${
              hi ? "z-[70] scale-110" : ""
            }`}
            style={{ left: 0, top: 0, visibility: "hidden" }}
          >
            <div
              className={
                hi
                  ? "rounded-full ring-[3px] ring-sky-400 ring-offset-[3px] ring-offset-black/50 shadow-[0_0_22px_rgba(56,189,248,0.65)]"
                  : undefined
              }
            >
              <InteractionButtonView b={b} onActivate={() => onActivate(b)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Boîte de contenu ancrée à côté du point du bouton (même logique que le bouton : sphère ou % écran).
 */
function AnchoredContentModal({
  button,
  krpano,
  onClose,
  onVideoPlaybackChange,
}: {
  button: SceneInteractionButton;
  krpano: KrpanoViewer | null;
  onClose: () => void;
  onVideoPlaybackChange?: (playing: boolean) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef(button);
  buttonRef.current = button;
  const rafRef = useRef(0);
  const modal = button.modal;
  const closeBackdrop = modal?.closeOnBackdropClick !== false;
  const closeEscape = modal?.closeOnEscape !== false;
  const backdropBg =
    modal?.backdropColor?.trim() || "rgba(0,0,0,0.5)";

  useEffect(() => {
    if (!closeEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeEscape, onClose]);

  useEffect(() => {
    if (!krpano) return;
    hideKrpanoTourChrome(krpano);
  }, [krpano]);

  /** Option modale : pivot caméra vers ath/atv ; la boîte suit toujours le bouton (spheretoscreen). */
  useEffect(() => {
    if (!krpano || !modal?.centerViewForModal) return;
    if (!isSphereAnchored(button)) return;
    const ath = button.ath;
    const atv = button.atv;
    if (ath === undefined || atv === undefined) return;

    const saved = getKrpanoViewSnapshot(krpano);
    const vw =
      typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh =
      typeof window !== "undefined" ? window.innerHeight : 800;
    const modalW = Math.min(420, Math.max(0, vw - 32));
    const fov = saved?.fov ?? 120;
    const off = sceneButtonAnchorOffsetPx(button);
    const { ath: athT, atv: atvT } = adjustedAthAtvToCenterModalBesideButton(
      ath,
      atv,
      {
        viewportWidthPx: vw,
        viewportHeightPx: vh,
        sceneBtnOffsetPx: off,
        modalWidthPx: modalW,
        fovDeg: fov,
      },
    );
    tweenKrpanoViewToAnchor(krpano, athT, atvT);

    return () => {
      if (saved) tweenKrpanoViewToSnapshot(krpano, saved);
    };
  }, [
    krpano,
    modal?.centerViewForModal,
    button.ath,
    button.atv,
    button.id,
  ]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const tickLegacy = () => {
      const b = buttonRef.current;
      const offsetPx = sceneButtonAnchorOffsetPx(b);
      el.style.visibility = "visible";
      el.style.left = `calc(${b.leftPct ?? 0}% + ${offsetPx}px)`;
      el.style.top = `${b.topPct ?? 0}%`;
      el.style.transform = "translate(0, -50%)";
    };

    const b = buttonRef.current;
    if (!isSphereAnchored(b)) {
      tickLegacy();
      return;
    }

    if (!krpano) {
      el.style.visibility = "hidden";
      return;
    }

    const tick = () => {
      const node = wrapRef.current;
      const btn = buttonRef.current;
      if (!node || !krpano) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (!isSphereAnchored(btn)) {
        tickLegacy();
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const off = sceneButtonAnchorOffsetPx(btn);
      const p = krpano.spheretoscreen(btn.ath!, btn.atv!);
      if (!p || Number.isNaN(p.x) || Number.isNaN(p.y)) {
        node.style.visibility = "hidden";
      } else {
        node.style.visibility = "visible";
        node.style.left = `${p.x + off}px`;
        node.style.top = `${p.y}px`;
        node.style.transform = "translate(0, -50%)";
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [krpano, button.id]);

  return (
    <>
      {closeBackdrop ? (
        <button
          type="button"
          className="fixed inset-0 z-[115] cursor-default border-0 p-0 backdrop-blur-[1px]"
          style={{ background: backdropBg }}
          aria-label="Fermer la boîte"
          onClick={onClose}
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 z-[120] overflow-visible">
        <div
          ref={wrapRef}
          className="pointer-events-auto absolute w-[min(420px,calc(100vw-2rem))] max-w-[calc(100vw-1.5rem)] shrink-0 will-change-[left,top]"
          style={{ visibility: "hidden", left: 0, top: 0 }}
        >
          <InteractionContentPanel
            button={button}
            onClose={onClose}
            onVideoPlaybackChange={onVideoPlaybackChange}
          />
        </div>
      </div>
    </>
  );
}

export function SceneInteractionOverlay({
  sceneName,
  map,
  krpano,
  scenePanoReady = true,
  highlightButtonId = null,
  pendingActivation = null,
  onPendingActivationConsumed,
  onVideoPlaybackChange,
}: {
  sceneName: string;
  map: SceneInteractionsMap;
  krpano: KrpanoViewer | null;
  /** false jusqu’au 1er onblendcomplete (ou équivalent) — évite les boutons avant l’image. */
  scenePanoReady?: boolean;
  /** Bouton mis en avant quand la ligne correspondante est survolée dans l’éditeur. */
  highlightButtonId?: string | null;
  /** Catalogue équipements : rejouer le clic après chargement de la bonne scène. */
  pendingActivation?: {
    sceneId: string;
    buttonId: string;
    nonce: number;
  } | null;
  onPendingActivationConsumed?: () => void;
  /** Lecture vidéo dans une modale : suspend la redirection d’inactivité vers l’accueil. */
  onVideoPlaybackChange?: (playing: boolean) => void;
}) {
  const [modalButton, setModalButton] = useState<SceneInteractionButton | null>(
    null,
  );
  const processedActivationNonce = useRef<number | null>(null);

  const list = useMemo(() => map[sceneName] ?? [], [map, sceneName]);
  const sphere = useMemo(() => list.filter(isSphereAnchored), [list]);
  const screen = useMemo(
    () => list.filter((b) => !isSphereAnchored(b)),
    [list],
  );

  const activate = useCallback(
    (b: SceneInteractionButton) => {
      const goScene = b.targetSceneId?.trim();
      if (goScene) {
        if (krpano) loadKrpanoScene(krpano, goScene, b.targetSceneLookAt);
        return;
      }
      if (hasModalContent(b.modal)) {
        setModalButton(b);
        return;
      }
      if (b.url?.trim()) {
        window.open(b.url, "_blank", "noopener,noreferrer");
      }
    },
    [krpano],
  );

  useEffect(() => {
    if (!pendingActivation || !scenePanoReady || !krpano) return;
    if (sceneName.trim() !== pendingActivation.sceneId.trim()) return;
    if (processedActivationNonce.current === pendingActivation.nonce) return;
    const btn = (map[sceneName] ?? []).find(
      (b) => b.id === pendingActivation.buttonId,
    );
    processedActivationNonce.current = pendingActivation.nonce;
    if (!btn) {
      onPendingActivationConsumed?.();
      return;
    }
    activate(btn);
    onPendingActivationConsumed?.();
  }, [
    pendingActivation,
    sceneName,
    scenePanoReady,
    map,
    krpano,
    activate,
    onPendingActivationConsumed,
  ]);

  useEffect(() => {
    if (!pendingActivation) processedActivationNonce.current = null;
  }, [pendingActivation]);

  return (
    <>
      {scenePanoReady && sphere.length > 0 && krpano && (
        <SphereAnchoredButtons
          krpano={krpano}
          buttons={sphere}
          onActivate={activate}
          highlightButtonId={highlightButtonId ?? null}
        />
      )}
      {scenePanoReady && screen.length > 0 && (
        <ScreenPercentButtons
          buttons={screen}
          onActivate={activate}
          highlightButtonId={highlightButtonId ?? null}
        />
      )}
      {modalButton && hasModalContent(modalButton.modal) && (
        <AnchoredContentModal
          button={modalButton}
          krpano={krpano}
          onClose={() => setModalButton(null)}
          onVideoPlaybackChange={onVideoPlaybackChange}
        />
      )}
    </>
  );
}

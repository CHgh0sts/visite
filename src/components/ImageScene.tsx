"use client";

import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { SceneConfig, SceneImage } from "@/types/scene";

/** degrés / pixel de déplacement */
const SENS = 0.22;
const MAX_TILT_X = 72;

type Props = {
  config: SceneConfig;
};

function toStyle(img: SceneImage): CSSProperties {
  return {
    position: "absolute",
    top: img.top,
    left: img.left,
    right: img.right,
    bottom: img.bottom,
    width: img.width,
    height: img.height,
    maxWidth: img.maxWidth,
    maxHeight: img.maxHeight,
    zIndex: img.zIndex ?? 0,
    objectFit: img.objectFit ?? "contain",
    transform: img.transform,
  };
}

export function ImageScene({ config }: Props) {
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const [rot, setRot] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });

  const bg = config.background ?? "#0f172a";

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    draggingRef.current = true;
    lastRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastRef.current.x;
    const dy = e.clientY - lastRef.current.y;
    lastRef.current = { x: e.clientX, y: e.clientY };
    setRot((r) => ({
      x: Math.max(
        -MAX_TILT_X,
        Math.min(MAX_TILT_X, r.x - dy * SENS),
      ),
      y: r.y + dx * SENS,
    }));
  }, []);

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div
      className="relative h-dvh w-full cursor-grab overflow-hidden touch-none active:cursor-grabbing"
      style={{
        background: bg,
        perspective: "min(1400px, 180vw)",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="absolute inset-0 h-full w-full"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
          transformOrigin: "center center",
          willChange: "transform",
        }}
      >
        {config.images.map((img) => (
          <figure
            key={img.id}
            className="pointer-events-none m-0"
            style={toStyle(img)}
          >
            {broken[img.id] ? (
              <div className="flex h-24 min-w-[120px] items-center justify-center rounded-lg border border-dashed border-white/30 bg-white/5 px-3 text-center text-xs text-white/70">
                Fichier introuvable : {img.src}
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- chemins locaux arbitraires (public/scene)
              <img
                src={img.src}
                alt={img.alt ?? ""}
                className="block max-h-[85vh] w-full select-none"
                style={{
                  objectFit: img.objectFit ?? "contain",
                  height: img.height ? "100%" : "auto",
                }}
                draggable={false}
                onError={() =>
                  setBroken((b) => ({ ...b, [img.id]: true }))
                }
              />
            )}
          </figure>
        ))}
      </div>

      {config.title ? (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center px-4 pt-4">
          <h1 className="rounded-full bg-black/50 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
            {config.title}
          </h1>
        </header>
      ) : null}

      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4">
        <p className="max-w-lg rounded-md bg-black/45 px-3 py-2 text-center text-[11px] leading-snug text-slate-300 backdrop-blur-sm">
          <span className="text-slate-200">Clic maintenu + glisser</span> pour
          faire tourner la vue. Éditez{" "}
          <code className="text-slate-100">src/data/scene.json</code> pour les
          images dans <code className="text-slate-100">public/scene/</code>.
        </p>
      </footer>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

import { sceneNavbarBottomAlignClass } from "@/constants/sceneNavbarLayout";
import type { KrpanoViewer } from "@/types/krpanoViewer";

function readViewNumber(krpano: KrpanoViewer, path: string): number | null {
  const g = krpano.get;
  if (typeof g !== "function") return null;
  const v = g(path);
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function fmt(n: number | null, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

type KrpanoViewHudProps = {
  krpano: KrpanoViewer | null;
  /** Nom de scène React (après blend) — affiché en complément du viewer. */
  sceneName: string;
  /** false = ne pas afficher la box (raccourci Ctrl+M). */
  visible?: boolean;
};

/**
 * Affichage en direct de l’orientation et du zoom (FOV) krpano — utile pour copier h/v/fov vers les boutons de navigation.
 */
export function KrpanoViewHud({
  krpano,
  sceneName,
  visible = true,
}: KrpanoViewHudProps) {
  const [h, setH] = useState<number | null>(null);
  const [v, setV] = useState<number | null>(null);
  const [fov, setFov] = useState<number | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!krpano) {
      setH(null);
      setV(null);
      setFov(null);
      return;
    }

    const tick = () => {
      setH(readViewNumber(krpano, "view.hlookat"));
      setV(readViewNumber(krpano, "view.vlookat"));
      setFov(readViewNumber(krpano, "view.fov"));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [krpano]);

  if (!krpano || !visible) return null;

  return (
    <div
      className={`fixed left-4 z-[95] max-w-[14rem] cursor-default select-text rounded-xl border border-white/12 bg-zinc-950/85 px-3 py-2.5 font-mono text-[11px] leading-snug text-zinc-200 shadow-lg backdrop-blur-md ${sceneNavbarBottomAlignClass}`}
      aria-live="polite"
    >
      <p className="mb-1.5 border-b border-white/10 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        Vue caméra
      </p>
      <dl className="space-y-1">
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">Scène</dt>
          <dd className="max-w-[9rem] truncate text-right text-sky-300/95" title={sceneName}>
            {sceneName || "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">hlookat</dt>
          <dd>{fmt(h)}°</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">vlookat</dt>
          <dd>{fmt(v)}°</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">FOV (zoom)</dt>
          <dd>{fmt(fov, 1)}°</dd>
        </div>
      </dl>
    </div>
  );
}

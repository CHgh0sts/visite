"use client";

import { Glasses } from "lucide-react";
import { useEffect, useState } from "react";

import {
  getKrpanoWebVrAvailable,
  getKrpanoWebVrEnabled,
  toggleKrpanoWebVr,
} from "@/lib/krpanoNavigation";
import type { KrpanoViewer } from "@/types/krpanoViewer";

type KrpanoVrToggleButtonProps = {
  krpano: KrpanoViewer | null;
};

/**
 * Bascule entrée / sortie WebXR (plugin krpano `webvr`).
 * Désactivé si `webvr.isavailable` est faux (navigateur sans WebXR).
 */
export function KrpanoVrToggleButton({ krpano }: KrpanoVrToggleButtonProps) {
  const [vrOn, setVrOn] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!krpano) {
      setVrOn(false);
      setAvailable(false);
      return;
    }
    let id = 0;
    const tick = () => {
      setVrOn(getKrpanoWebVrEnabled(krpano));
      setAvailable(getKrpanoWebVrAvailable(krpano));
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [krpano]);

  const disabled = !krpano || !available;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (krpano) toggleKrpanoWebVr(krpano);
      }}
      className={`flex size-11 items-center justify-center rounded-xl border shadow-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none ${
        vrOn
          ? "border-sky-500/70 bg-sky-600 text-white hover:bg-sky-500"
          : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
      aria-pressed={vrOn}
      title={
        disabled
          ? "WebXR indisponible sur ce navigateur"
          : vrOn
            ? "Quitter le mode VR"
            : "Passer en mode VR"
      }
      aria-label={
        disabled
          ? "Mode VR indisponible"
          : vrOn
            ? "Quitter le mode VR"
            : "Passer en mode VR"
      }
    >
      <Glasses strokeWidth={2} className="size-5" aria-hidden />
    </button>
  );
}

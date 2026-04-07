"use client";

import { useEffect, useState } from "react";

import { getKrpanoWebVrEnabled } from "@/lib/krpanoNavigation";
import type { KrpanoViewer } from "@/types/krpanoViewer";

/**
 * Suit `webvr.isenabled` (raf) pour basculer l’UI (ex. dock en mode VR).
 */
export function useKrpanoWebVrEnabled(krpano: KrpanoViewer | null): boolean {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!krpano) {
      setOn(false);
      return;
    }
    let last = getKrpanoWebVrEnabled(krpano);
    let first = true;
    let id = 0;
    const tick = () => {
      const next = getKrpanoWebVrEnabled(krpano);
      if (first || next !== last) {
        first = false;
        last = next;
        setOn(next);
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [krpano]);

  return krpano ? on : false;
}

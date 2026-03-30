"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const IDLE_MS = 30_000;

/** Événements considérés comme une activité sur la visite (scène, UI, clavier). */
const ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "mousemove",
  "touchstart",
  "wheel",
  "keydown",
  "scroll",
] as const;

/**
 * Après `IDLE_MS` sans interaction, redirige vers la page d’accueil.
 * Le minuteur est mis en pause quand l’onglet n’est pas visible.
 * Si `blockIdle` est vrai (ex. vidéo en lecture), aucune redirection tant que ce n’est pas repassé à faux
 * (fin de lecture, pause, fermeture du lecteur) — le délai de 30 s repart alors à zéro.
 */
export function useIdleHomeRedirect(enabled = true, blockIdle = false) {
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const clearTimer = () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const scheduleRedirect = () => {
      clearTimer();
      if (blockIdle) return;
      timeoutRef.current = setTimeout(() => {
        router.replace("/");
      }, IDLE_MS);
    };

    const onActivity = () => {
      if (document.hidden) return;
      scheduleRedirect();
    };

    scheduleRedirect();

    const opts: AddEventListenerOptions = { capture: true, passive: true };
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, opts);
    }

    const onVisibility = () => {
      if (document.hidden) {
        clearTimer();
      } else {
        scheduleRedirect();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearTimer();
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity, { capture: true });
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, router, blockIdle]);
}

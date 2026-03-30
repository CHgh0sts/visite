"use client";

import { useEffect } from "react";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return Boolean(el.closest("[contenteditable='true']"));
}

/**
 * Ctrl+F : bascule le plein écran sur tout le document (comme une vidéo).
 * Désactivé si le focus est dans un champ de saisie pour ne pas gêner la saisie.
 * Note : remplace le « Rechercher dans la page » du navigateur pour cette combinaison.
 */
export function GlobalFullscreenShortcut() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.key.toLowerCase() !== "f") return;
      if (isTypingTarget(e.target)) return;

      e.preventDefault();
      e.stopPropagation();

      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
        webkitExitFullscreen?: () => Promise<void>;
      };
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };

      const fsEl =
        document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;

      if (fsEl) {
        if (document.exitFullscreen) {
          void document.exitFullscreen().catch(() => {});
        } else if (doc.webkitExitFullscreen) {
          void doc.webkitExitFullscreen().catch(() => {});
        }
        return;
      }

      if (el.requestFullscreen) {
        void el.requestFullscreen().catch(() => {});
      } else if (el.webkitRequestFullscreen) {
        void el.webkitRequestFullscreen().catch(() => {});
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  return null;
}

"use client";

import type { CSSProperties } from "react";
import { useEffect } from "react";

import { SiteVideoPlayer } from "@/components/SiteVideoPlayer";
import type {
  InteractionModalContent,
  SceneInteractionButton,
} from "@/types/interactions";
import { hasModalContent } from "@/types/interactions";

type InteractionContentPanelProps = {
  button: SceneInteractionButton;
  onClose: () => void;
  /** Lecture vidéo : suspend le minuteur d’inactivité (visite). */
  onVideoPlaybackChange?: (playing: boolean) => void;
};

function panelSurfaceStyle(m: InteractionModalContent): CSSProperties {
  const s: CSSProperties = {};
  if (m.bgColor?.trim()) s.backgroundColor = m.bgColor.trim();
  if (m.textColor?.trim()) s.color = m.textColor.trim();
  if (m.borderColor?.trim()) s.borderColor = m.borderColor.trim();
  if (m.maxWidth?.trim()) s.maxWidth = m.maxWidth.trim();
  return s;
}

/**
 * Carte seule (texte, vidéo, lien) — positionnement géré par le parent.
 */
export function InteractionContentPanel({
  button,
  onClose,
  onVideoPlaybackChange,
}: InteractionContentPanelProps) {
  const modal = button.modal as InteractionModalContent;
  const title = modal.title?.trim();
  const body = modal.body?.trim();
  const videoUrl = modal.videoUrl?.trim();
  const link = button.url?.trim();
  const showClose = modal.showCloseButton !== false;
  const showTitleBar = modal.showTitleBar !== false;
  const surfaceStyle = panelSurfaceStyle(modal);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={
        showTitleBar && title ? "ix-modal-title" : undefined
      }
      aria-label={
        !showTitleBar
          ? title || "Contenu"
          : undefined
      }
      style={surfaceStyle}
      className={`flex min-h-0 min-w-0 max-h-[min(70vh,560px)] w-[min(420px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex-col overflow-hidden overflow-x-hidden rounded-2xl border shadow-2xl backdrop-blur-md ${
        modal.bgColor?.trim() ? "" : "bg-[#0e203d]"
      } ${modal.textColor?.trim() ? "" : "text-zinc-100"} ${
        modal.borderColor?.trim() ? "" : "border-white/15"
      }`}
    >
      {showTitleBar ? (
        <div
          className={`flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 ${
            modal.borderColor?.trim() ? "" : "border-white/10"
          }`}
          style={
            modal.borderColor?.trim()
              ? { borderBottomColor: modal.borderColor.trim() }
              : undefined
          }
        >
          {title ? (
            <h2
              id="ix-modal-title"
              className={`text-base font-semibold ${
                modal.textColor?.trim() ? "" : "text-white"
              }`}
            >
              {title}
            </h2>
          ) : (
            <span
              className={`text-base font-semibold ${
                modal.textColor?.trim() ? "" : "text-white"
              }`}
            >
              Information
            </span>
          )}
          {showClose ? (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              Fermer
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="min-h-0 min-w-0 space-y-3 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-3">
        {body ? (
          <div
            className={`whitespace-pre-wrap text-sm leading-relaxed ${
              modal.textColor?.trim() ? "" : "text-zinc-200"
            }`}
          >
            {body}
          </div>
        ) : null}
        {videoUrl ? (
          <SiteVideoPlayer
            url={videoUrl}
            autoplay={modal.videoAutoplay !== false}
            onPlaybackChange={onVideoPlaybackChange}
          />
        ) : null}
        {link ? (
          <div
            className={`border-t pt-3 ${
              modal.borderColor?.trim() ? "" : "border-white/10"
            }`}
            style={
              modal.borderColor?.trim()
                ? { borderTopColor: modal.borderColor.trim() }
                : undefined
            }
          >
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            >
              Ouvrir le lien
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type InteractionContentModalProps = {
  button: SceneInteractionButton | null;
  onClose: () => void;
};

/**
 * @deprecated Utiliser InteractionContentPanel dans SceneInteractionOverlay (ancrage).
 * Conservé si besoin d’un mode centré plein écran ailleurs.
 */
export function InteractionContentModal({
  button,
  onClose,
}: InteractionContentModalProps) {
  const open = button !== null && hasModalContent(button.modal);
  const modal = button?.modal;
  const closeBackdrop = modal?.closeOnBackdropClick !== false;
  const closeEscape = modal?.closeOnEscape !== false;
  const backdropBg =
    modal?.backdropColor?.trim() || "rgba(0,0,0,0.65)";

  useEffect(() => {
    if (!open || !closeEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeEscape, onClose]);

  if (!open || !button) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center p-4 ${
        closeBackdrop ? "" : "pointer-events-none"
      }`}
    >
      {closeBackdrop ? (
        <button
          type="button"
          className="absolute inset-0 backdrop-blur-[2px]"
          style={{ background: backdropBg }}
          aria-label="Fermer"
          onClick={onClose}
        />
      ) : null}
      <div
        className={`relative z-10 ${closeBackdrop ? "" : "pointer-events-auto"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <InteractionContentPanel button={button} onClose={onClose} />
      </div>
    </div>
  );
}

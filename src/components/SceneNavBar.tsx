"use client";

import { useMemo, type CSSProperties } from "react";

import sceneNavRaw from "@/data/scene-nav.json";
import { loadKrpanoScene } from "@/lib/krpanoNavigation";
import type { KrpanoViewer } from "@/types/krpanoViewer";
import type { SceneNavConfig } from "@/types/scene-nav";

const DEFAULT_ACCENT = "#0e203d";

/** Hauteur fixe de la pilule (style Dock) — ne change jamais. */
const DOCK_H = "h-14 min-h-14 max-h-14";

/**
 * Dock macOS : scale sur l’élément sélectionné (transform, hors flux),
 * origine bas pour que l’agrandissement parte vers le haut.
 */
const navBtnTransition =
  "transition-[transform,box-shadow,background-color,color,filter] duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0";

const navBtnBase =
  `relative z-0 flex min-h-0 min-w-[3rem] flex-1 basis-0 origin-bottom flex-col items-stretch justify-end rounded-xl px-2 pb-1.5 pt-1 text-[8px] font-medium leading-tight ${navBtnTransition}`;

type SceneNavBarProps = {
  krpano: KrpanoViewer | null;
  /** Nom de scène courant (ex. après `onblendcomplete`). */
  currentSceneId: string;
};

/**
 * Barre de navigation bas d’écran : liste pilotée par `scene-nav.json`
 * (`iconUrl` = chemin public, ex. `/scene-nav/foo.png` → `public/scene-nav/foo.png`).
 * Comportement type Dock macOS : hauteur fixe, largeur adaptative, scale sur la scène active.
 */
export function SceneNavBar({ krpano, currentSceneId }: SceneNavBarProps) {
  const config = sceneNavRaw as SceneNavConfig;
  const accent = config.accentColor?.trim() || DEFAULT_ACCENT;

  const items = useMemo(() => {
    const list = config.items ?? [];
    return list.filter(
      (i) =>
        i.sceneId?.trim() &&
        i.label?.trim() &&
        typeof i.iconUrl === "string" &&
        i.iconUrl.trim().length > 0,
    );
  }, [config.items]);

  const style = useMemo(
    () => ({ ["--site-nav-accent"]: accent }) as CSSProperties,
    [accent],
  );

  if (items.length === 0) return null;

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center overflow-x-auto overflow-y-visible px-1.5 pt-6 pb-[max(0.5rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
      style={style}
      aria-label="Navigation entre les scènes"
    >
      <div
        className={`pointer-events-auto flex ${DOCK_H} w-max max-w-[min(100%,min(94vw,80rem))] min-w-0 shrink-0 items-stretch gap-1 overflow-visible rounded-2xl border border-white/60 bg-white/75 px-1.5 shadow-[0_4px_20px_rgba(15,23,42,0.12)] backdrop-blur-md`}
        role="toolbar"
      >
        {items.map((item, index) => {
          const cur = currentSceneId.trim();
          const target = item.sceneId.trim();
          const isOnTarget = cur === target;
          const aliasIds =
            item.otherSceneId?.map((id) => id.trim()).filter(Boolean) ?? [];
          const isOnAlias = aliasIds.length > 0 && aliasIds.includes(cur);
          /** Style « actif » : scène cible ou une des scènes listées dans `otherSceneId`. */
          const looksActive = isOnTarget || isOnAlias;
          const src = item.iconUrl.trim();
          const rowKey = item.id?.trim() ?? `nav-${index}`;
          return (
            <button
              key={rowKey}
              type="button"
              onClick={() => {
                if (!krpano || isOnTarget) return;
                loadKrpanoScene(krpano, target);
              }}
              disabled={!krpano}
              className={
                looksActive
                  ? `${navBtnBase} z-10 scale-[1.14] text-white [background-color:var(--site-nav-accent)] shadow-lg`
                  : `${navBtnBase} scale-100 bg-transparent [color:var(--site-nav-accent)] hover:z-[1] hover:scale-[1.06] hover:bg-white/55`
              }
              aria-current={looksActive ? "true" : undefined}
            >
              <span className="flex min-h-0 flex-1 flex-col items-center justify-center px-0.5 pt-0.5" aria-hidden>
                <img
                  src={src}
                  alt=""
                  width={16}
                  height={16}
                  className={
                    looksActive
                      ? "h-4 w-4 object-contain brightness-0 invert"
                      : "h-4 w-4 object-contain"
                  }
                  loading="lazy"
                  decoding="async"
                />
              </span>
              <span className="mt-auto min-w-0 w-full shrink-0 text-center text-balance break-words [overflow-wrap:anywhere]">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

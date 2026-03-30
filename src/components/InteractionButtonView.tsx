"use client";

import {
  cloneElement,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

import { LucideIconByName } from "@/components/LucideIconByName";
import { InteractionSvgIcon } from "@/components/icons/InteractionSvgIcons";
import {
  hasCustomInteractionColors,
  interactionBtnCustomClass,
  interactionBtnDefaultClass,
  interactionButtonCustomStyle,
  sceneButtonBorderStyle,
  sceneButtonBorderTailwindClass,
  sceneButtonImageRingClass,
} from "@/lib/interactionButtonStyles";
import {
  isImageButton,
  isLucideButton,
  isSvgButton,
  isTextButton,
  type InteractionHoverHintPlacement,
  type SceneInteractionButton,
} from "@/types/interactions";

function hoverBubbleClass(placement: InteractionHoverHintPlacement): string {
  const base =
    "pointer-events-none absolute z-[60] min-w-[min(12rem,calc(100vw-2rem))] max-w-[min(240px,70vw)] rounded-lg border border-white/15 bg-zinc-900/95 px-2.5 py-1.5 text-left text-xs leading-snug text-zinc-100 shadow-lg transition-opacity duration-150 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100";
  switch (placement) {
    case "top":
      return `${base} bottom-full left-1/2 mb-2 -translate-x-1/2`;
    case "bottom":
      return `${base} top-full left-1/2 mt-2 -translate-x-1/2`;
    case "left":
      return `${base} right-full top-1/2 mr-2 -translate-y-1/2`;
    case "right":
      return `${base} left-full top-1/2 ml-2 -translate-y-1/2`;
    default:
      return `${base} bottom-full left-1/2 mb-2 -translate-x-1/2`;
  }
}

/**
 * Échelle, rotation 3D et rayon des coins — pour le bouton affiché sur le panorama (pas la modale).
 */
function SceneButtonShell({
  b,
  children,
}: {
  b: SceneInteractionButton;
  children: ReactNode;
}) {
  if (!isValidElement(children)) {
    return <>{children}</>;
  }

  const scale =
    typeof b.sceneBtnScale === "number" &&
    Number.isFinite(b.sceneBtnScale) &&
    b.sceneBtnScale > 0
      ? b.sceneBtnScale
      : 1;
  const rx = b.sceneBtnRotateXDeg ?? 0;
  const ry = b.sceneBtnRotateYDeg ?? 0;
  const rz = b.sceneBtnRotateZDeg ?? 0;
  const br = b.sceneBtnBorderRadius?.trim();

  const needsTransform =
    Math.abs(scale - 1) > 0.001 ||
    rx !== 0 ||
    ry !== 0 ||
    rz !== 0;
  const has3d = rx !== 0 || ry !== 0;
  const t = `scale(${scale}) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;

  const child = children as ReactElement<{ style?: CSSProperties }>;
  const prevStyle = child.props.style;

  const withRadius =
    br !== undefined && br !== ""
      ? cloneElement(child, {
          style: {
            ...prevStyle,
            borderRadius: br,
          },
        })
      : child;

  if (!needsTransform) {
    return <>{withRadius}</>;
  }

  return (
    <div
      className="inline-flex"
      style={has3d ? { perspective: "800px" } : undefined}
    >
      <div
        className="inline-flex origin-center will-change-transform"
        style={{ transform: t }}
      >
        {withRadius}
      </div>
    </div>
  );
}

function wrapWithHoverBubble(
  b: SceneInteractionButton,
  buttonEl: ReactNode,
): ReactNode {
  const hint = b.hoverHint?.trim();
  if (!hint) return buttonEl;
  const tid = `ix-hover-${b.id}`;
  const placement = b.hoverHintPlacement ?? "top";
  return (
    <div className="group relative inline-flex max-w-none">
      {buttonEl}
      <div
        id={tid}
        role="tooltip"
        className={hoverBubbleClass(placement)}
      >
        <span className="whitespace-pre-wrap break-words">{hint}</span>
      </div>
    </div>
  );
}

function baseClasses(b: SceneInteractionButton): string {
  return hasCustomInteractionColors(b)
    ? interactionBtnCustomClass
    : interactionBtnDefaultClass;
}

function baseStyle(b: SceneInteractionButton): CSSProperties | undefined {
  return hasCustomInteractionColors(b) ? interactionButtonCustomStyle(b) : undefined;
}

function mergedButtonSurfaceStyle(
  b: SceneInteractionButton,
): CSSProperties | undefined {
  const base = baseStyle(b);
  const border = sceneButtonBorderStyle(b);
  if (!base && !border) return undefined;
  return { ...base, ...border };
}

function iconRotationVars(
  b: SceneInteractionButton,
): CSSProperties | undefined {
  const base =
    typeof b.iconRotationDeg === "number" && !Number.isNaN(b.iconRotationDeg)
      ? b.iconRotationDeg
      : 0;
  const hover =
    typeof b.iconHoverRotationDeg === "number" &&
    !Number.isNaN(b.iconHoverRotationDeg)
      ? b.iconHoverRotationDeg
      : 0;
  const durationMs =
    typeof b.iconRotationDurationMs === "number" &&
    !Number.isNaN(b.iconRotationDurationMs) &&
    b.iconRotationDurationMs >= 0
      ? b.iconRotationDurationMs
      : undefined;
  const delayMs =
    typeof b.iconRotationDelayMs === "number" &&
    !Number.isNaN(b.iconRotationDelayMs) &&
    b.iconRotationDelayMs >= 0
      ? b.iconRotationDelayMs
      : undefined;

  const hasRotation = base !== 0 || hover !== 0;
  if (!hasRotation) return undefined;

  const out = {
    ["--ix-icon-base" as string]: `${base}deg`,
    ["--ix-icon-hover" as string]: `${hover}deg`,
    ...(durationMs !== undefined
      ? { ["--ix-icon-duration" as string]: `${durationMs}ms` }
      : {}),
    ...(delayMs !== undefined
      ? { ["--ix-icon-delay" as string]: `${delayMs}ms` }
      : {}),
  } as CSSProperties;
  return out;
}

export function InteractionButtonView({
  b,
  onActivate,
}: {
  b: SceneInteractionButton;
  onActivate: () => void;
}) {
  const style = mergedButtonSurfaceStyle(b);
  const borderTw = sceneButtonBorderTailwindClass(b, isImageButton(b));
  const custom = hasCustomInteractionColors(b);
  const hint = b.hoverHint?.trim();
  const hintId = hint ? `ix-hover-${b.id}` : undefined;

  if (isTextButton(b)) {
    return wrapWithHoverBubble(
      b,
      <SceneButtonShell b={b}>
        <button
          type="button"
          onClick={onActivate}
          style={style}
          className={`rounded-full px-4 py-2 text-sm font-medium ${borderTw} ${baseClasses(b)}`}
          aria-describedby={hintId}
        >
          {b.label}
        </button>
      </SceneButtonShell>,
    );
  }

  if (isLucideButton(b)) {
    const rotVars = iconRotationVars(b);
    return wrapWithHoverBubble(
      b,
      <SceneButtonShell b={b}>
        <button
          type="button"
          onClick={onActivate}
          style={style}
          className={`flex size-11 shrink-0 items-center justify-center rounded-full ${borderTw} ${baseClasses(
            b,
          )}`}
          aria-label={b.label?.trim() || b.lucideIcon}
          aria-describedby={hintId}
        >
        <span
          className={
            rotVars
              ? "ix-icon-rot inline-flex items-center justify-center"
              : "inline-flex items-center justify-center"
          }
          style={rotVars}
        >
          <LucideIconByName
            name={b.lucideIcon}
            size={22}
            className="text-current"
          />
        </span>
      </button>
      </SceneButtonShell>,
    );
  }

  if (isSvgButton(b)) {
    const rotVars = iconRotationVars(b);
    return wrapWithHoverBubble(
      b,
      <SceneButtonShell b={b}>
        <button
          type="button"
          onClick={onActivate}
          style={style}
          className={`flex size-11 shrink-0 items-center justify-center rounded-full ${borderTw} ${baseClasses(
            b,
          )}`}
          aria-label={b.label?.trim() || "Icône"}
          aria-describedby={hintId}
        >
        <span
          className={
            rotVars
              ? "ix-icon-rot inline-flex items-center justify-center"
              : "inline-flex items-center justify-center"
          }
          style={rotVars}
        >
          <InteractionSvgIcon
            id={b.svgId}
            className="size-[22px] text-current"
          />
        </span>
      </button>
      </SceneButtonShell>,
    );
  }

  if (isImageButton(b)) {
    const ringClass = custom ? "ring-current/35" : "ring-[#0e203d]/30";
    const ringW = sceneButtonImageRingClass(b);
    return wrapWithHoverBubble(
      b,
      <SceneButtonShell b={b}>
        <button
          type="button"
          onClick={onActivate}
          style={style}
          className={`size-14 shrink-0 overflow-hidden rounded-full p-0 ${ringW} ${ringClass} ${borderTw} ${baseClasses(
            b,
          )}`}
          aria-label={b.imageAlt?.trim() || "Image"}
          aria-describedby={hintId}
        >
        {/* eslint-disable-next-line @next/next/no-img-element -- URLs externes arbitraires */}
        <img
          src={b.imageSrc}
          alt=""
          className="size-full object-cover"
          draggable={false}
        />
      </button>
      </SceneButtonShell>,
    );
  }

  return null;
}

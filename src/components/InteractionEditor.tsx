"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";

import { EquipmentCatalogPanel } from "@/components/EquipmentCatalogPanel";
import { KrpanoViewHud } from "@/components/KrpanoViewHud";
import { KrpanoTour } from "@/components/KrpanoTour";
import { SceneNavBar } from "@/components/SceneNavBar";
import { SceneInteractionOverlay } from "@/components/SceneInteractionOverlay";
import { KRPANO_START_SCENE } from "@/constants/krpano";
import { sceneNavbarBottomReservePaddingClass } from "@/constants/sceneNavbarLayout";
import { loadKrpanoScene } from "@/lib/krpanoNavigation";
import { setReactVrUiCallbacks } from "@/lib/reactVrUiBridge";
import { dockNavSceneIdAfterDelta } from "@/lib/sceneDockNav";
import { postSceneInteractionsToServer } from "@/lib/sceneInteractionsApi";
import {
  exportInteractionsJson,
  getDefaultInteractions,
  loadSiteInteractions,
} from "@/lib/sceneInteractionsStorage";
import { useIdleHomeRedirect } from "@/hooks/useIdleHomeRedirect";
import { TOUR_SCENES } from "@/lib/tourScenes";
import type { KrpanoViewer } from "@/types/krpanoViewer";
import {
  interactionSvgLabel,
  InteractionSvgIcon,
} from "@/components/icons/InteractionSvgIcons";
import {
  hasModalContent,
  interactionSummary,
  isImageButton,
  isLucideButton,
  isSphereAnchored,
  isSvgButton,
  isTextButton,
  type InteractionHoverHintPlacement,
  type InteractionModalContent,
  type InteractionSvgIconId,
  type SceneInteractionButton,
  type SceneInteractionButtonImage,
  type SceneInteractionButtonLucide,
  type SceneInteractionButtonSvg,
  type SceneInteractionButtonText,
  type SceneInteractionsMap,
} from "@/types/interactions";

const LUCIDE_SUGGESTIONS = [
  "Info",
  "ExternalLink",
  "ShoppingCart",
  "Mail",
  "Phone",
  "MapPin",
  "Play",
  "Image",
  "FileText",
  "ArrowRight",
  "CircleHelp",
] as const;

/** Valeurs persistées côté API */
type ContentKind = "text" | "lucide" | "image" | "svg";
/** Regroupe Lucide + SVG dans l’interface */
type UiKind = "text" | "icon" | "image";
type IconPack = "lucide" | "svg";

const PRESET_COLORS = {
  btnBg: "#ffffff",
  btnFg: "#0e203d",
  hoverBg: "#0e203d",
  hoverFg: "#ffffff",
  modalBg: "#0e203d",
  modalText: "#fafafa",
  modalBorder: "rgba(255,255,255,0.12)",
  backdrop: "rgba(0,0,0,0.55)",
} as const;

const fieldClass =
  "w-full rounded-lg border border-zinc-700/80 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/25";

function EditorSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800/90 bg-zinc-900/50 p-3.5 shadow-sm">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        {title}
      </h3>
      {description ? (
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
          {description}
        </p>
      ) : null}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function pillClass(active: boolean) {
  return active
    ? "border-sky-500 bg-sky-950/60 text-sky-100 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.35)]"
    : "border-zinc-700/80 bg-zinc-950 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300";
}

/** Même règles que le placement depuis le formulaire, mais lues sur le bouton déjà enregistré. */
function validateButtonForPlacement(b: SceneInteractionButton): string | null {
  if (isImageButton(b) && !b.imageSrc?.trim()) {
    return "Renseignez l’URL de l’image avant de placer le bouton.";
  }
  if (isLucideButton(b) && !b.lucideIcon?.trim()) {
    return "Indiquez le nom de l’icône Lucide (ex. Info).";
  }
  return null;
}

type InteractionEditorProps = {
  sceneName: string;
  map: SceneInteractionsMap;
  onMapChange: (next: SceneInteractionsMap) => void;
  krpano: KrpanoViewer | null;
  viewerContainerId: string | null;
  /** Survol d’une ligne « Sur cette scène » : mettre le même bouton en avant sur le panorama. */
  onSceneButtonListHover?: (buttonId: string | null) => void;
  /** false = masquer le bouton / panneau « Interactions » (raccourci Ctrl+M dans VisiteShell). */
  shellPanelsVisible?: boolean;
};

type InteractionColorFields = Pick<
  SceneInteractionButton,
  "bgColor" | "fgColor" | "hoverBgColor" | "hoverFgColor"
>;

function buildColorFields(
  bg: string,
  fg: string,
  hoverBg: string,
  hoverFg: string,
): Partial<InteractionColorFields> {
  const out: Partial<InteractionColorFields> = {};
  if (bg.trim()) out.bgColor = bg.trim();
  if (fg.trim()) out.fgColor = fg.trim();
  if (hoverBg.trim()) out.hoverBgColor = hoverBg.trim();
  if (hoverFg.trim()) out.hoverFgColor = hoverFg.trim();
  return out;
}

function buildModalFromForm(
  modalTitle: string,
  modalBody: string,
  modalVideoUrl: string,
  modalBgColor: string,
  modalTextColor: string,
  modalBorderColor: string,
  backdropColor: string,
  modalMaxWidth: string,
  closeOnBackdropClick: boolean,
  closeOnEscape: boolean,
  showCloseButton: boolean,
  showTitleBar: boolean,
  centerViewForModal: boolean,
  modalVideoAutoplay: boolean,
): InteractionModalContent | undefined {
  const m: InteractionModalContent = {
    title: modalTitle.trim() || undefined,
    body: modalBody.trim() || undefined,
    videoUrl: modalVideoUrl.trim() || undefined,
  };
  if (modalBgColor.trim()) m.bgColor = modalBgColor.trim();
  if (modalTextColor.trim()) m.textColor = modalTextColor.trim();
  if (modalBorderColor.trim()) m.borderColor = modalBorderColor.trim();
  if (backdropColor.trim()) m.backdropColor = backdropColor.trim();
  if (modalMaxWidth.trim()) m.maxWidth = modalMaxWidth.trim();
  if (!closeOnBackdropClick) m.closeOnBackdropClick = false;
  if (!closeOnEscape) m.closeOnEscape = false;
  if (!showCloseButton) m.showCloseButton = false;
  if (!showTitleBar) m.showTitleBar = false;
  if (centerViewForModal) m.centerViewForModal = true;
  if (!modalVideoAutoplay) m.videoAutoplay = false;
  return hasModalContent(m) ? m : undefined;
}

function iconRotationField(
  contentKind: ContentKind,
  iconRotation: string,
  iconHoverRotation: string,
  iconRotationDuration: string,
  iconRotationDelay: string,
): {
  iconRotationDeg?: number;
  iconHoverRotationDeg?: number;
  iconRotationDurationMs?: number;
  iconRotationDelayMs?: number;
} {
  if (contentKind !== "lucide" && contentKind !== "svg") return {};
  const out: {
    iconRotationDeg?: number;
    iconHoverRotationDeg?: number;
    iconRotationDurationMs?: number;
    iconRotationDelayMs?: number;
  } = {};
  const r = parseFloat(iconRotation);
  if (Number.isFinite(r) && r !== 0) out.iconRotationDeg = r;
  const h = parseFloat(iconHoverRotation);
  if (Number.isFinite(h) && h !== 0) out.iconHoverRotationDeg = h;

  const hasRot =
    (Number.isFinite(r) && r !== 0) ||
    (Number.isFinite(h) && h !== 0);
  if (!hasRot) return out;

  const durStr = iconRotationDuration.trim();
  if (durStr !== "") {
    const dur = parseFloat(durStr);
    if (Number.isFinite(dur) && dur >= 0) out.iconRotationDurationMs = dur;
  }
  const delStr = iconRotationDelay.trim();
  if (delStr !== "") {
    const del = parseFloat(delStr);
    if (Number.isFinite(del) && del >= 0) out.iconRotationDelayMs = del;
  }
  return out;
}

/** Position à réinjecter lors d’une édition sans nouveau clic. */
function positionFromButton(
  b: SceneInteractionButton,
): { ath: number; atv: number } | { topPct: number; leftPct: number } {
  if (isSphereAnchored(b)) {
    return { ath: b.ath!, atv: b.atv! };
  }
  return { topPct: b.topPct ?? 0, leftPct: b.leftPct ?? 0 };
}

function parseSceneBtnBorderWidthPx(s: string): number | undefined {
  const t = s.trim();
  if (t === "") return undefined;
  const n = parseFloat(t.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

function mergeSceneBtnAppearance(args: {
  sceneBtnScale: number;
  sceneBtnRotateXDeg: number;
  sceneBtnRotateYDeg: number;
  sceneBtnRotateZDeg: number;
  sceneBtnBorderRadius: string;
  sceneBtnBorderWidthStr: string;
  sceneBtnBorderColor: string;
}): Partial<SceneInteractionButton> {
  const out: Partial<SceneInteractionButton> = {};
  if (Math.abs(args.sceneBtnScale - 1) > 0.001) {
    out.sceneBtnScale = args.sceneBtnScale;
  }
  if (args.sceneBtnRotateXDeg !== 0) {
    out.sceneBtnRotateXDeg = args.sceneBtnRotateXDeg;
  }
  if (args.sceneBtnRotateYDeg !== 0) {
    out.sceneBtnRotateYDeg = args.sceneBtnRotateYDeg;
  }
  if (args.sceneBtnRotateZDeg !== 0) {
    out.sceneBtnRotateZDeg = args.sceneBtnRotateZDeg;
  }
  const br = args.sceneBtnBorderRadius.trim();
  if (br) out.sceneBtnBorderRadius = br;

  const w = parseSceneBtnBorderWidthPx(args.sceneBtnBorderWidthStr);
  const col = args.sceneBtnBorderColor.trim();
  if (w === 0) {
    out.sceneBtnBorderWidthPx = 0;
  } else if (w !== undefined && w > 0) {
    out.sceneBtnBorderWidthPx = w;
    if (col) out.sceneBtnBorderColor = col;
  } else if (w === undefined && col) {
    out.sceneBtnBorderWidthPx = 1;
    out.sceneBtnBorderColor = col;
  }
  return out;
}

function mergeTargetSceneNav(args: {
  targetSceneId: string;
  targetSceneLookAtH: string;
  targetSceneLookAtV: string;
  targetSceneLookAtFov: string;
  preserveCurrentViewOnSceneChange: boolean;
}):
  | { ok: true; extras: { targetSceneId?: string; targetSceneLookAt?: { hlookat: number; vlookat: number; fov?: number }; preserveCurrentViewOnSceneChange?: true } }
  | { ok: false; error: string } {
  const sceneTrim = args.targetSceneId.trim();
  const hStr = args.targetSceneLookAtH.trim();
  const vStr = args.targetSceneLookAtV.trim();
  const fovStr = args.targetSceneLookAtFov.trim();
  if (!sceneTrim) {
    if (hStr || vStr || fovStr) {
      return {
        ok: false,
        error:
          "Choisissez une scène de destination pour définir l’angle de vue à l’arrivée.",
      };
    }
    return { ok: true, extras: {} };
  }
  if (args.preserveCurrentViewOnSceneChange) {
    return {
      ok: true,
      extras: {
        targetSceneId: sceneTrim,
        preserveCurrentViewOnSceneChange: true,
      },
    };
  }
  const h = parseFloat(hStr.replace(",", "."));
  const v = parseFloat(vStr.replace(",", "."));
  const hasH = hStr !== "" && Number.isFinite(h);
  const hasV = vStr !== "" && Number.isFinite(v);
  if (hasH !== hasV) {
    return {
      ok: false,
      error:
        "Renseignez hlookat et vlookat (tous les deux), ou laissez-les vides pour la vue par défaut de la scène.",
    };
  }
  if (hasH && hasV) {
    const look: {
      hlookat: number;
      vlookat: number;
      fov?: number;
    } = { hlookat: h, vlookat: v };
    if (fovStr !== "") {
      const f = parseFloat(fovStr.replace(",", "."));
      if (!Number.isFinite(f)) {
        return { ok: false, error: "FOV : nombre invalide." };
      }
      look.fov = f;
    }
    return {
      ok: true,
      extras: { targetSceneId: sceneTrim, targetSceneLookAt: look },
    };
  }
  return { ok: true, extras: { targetSceneId: sceneTrim } };
}

function buildInteractionButton(
  contentKind: ContentKind,
  args: {
    id: string;
    pos: { ath: number; atv: number } | { topPct: number; leftPct: number };
    label: string;
    url: string;
    lucideIcon: string;
    imageSrc: string;
    imageAlt: string;
    svgIconId: InteractionSvgIconId;
    modal: InteractionModalContent | undefined;
    colors: Partial<InteractionColorFields>;
    rotation: ReturnType<typeof iconRotationField>;
    hoverHint: string;
    hoverHintPlacement: InteractionHoverHintPlacement;
    targetSceneId: string;
    targetSceneLookAtH: string;
    targetSceneLookAtV: string;
    targetSceneLookAtFov: string;
    preserveCurrentViewOnSceneChange: boolean;
    sceneBtnScale: number;
    sceneBtnRotateXDeg: number;
    sceneBtnRotateYDeg: number;
    sceneBtnRotateZDeg: number;
    sceneBtnBorderRadius: string;
    sceneBtnBorderWidthStr: string;
    sceneBtnBorderColor: string;
    isEquipment: boolean;
  },
): SceneInteractionButton | { error: string } {
  const link = args.url.trim() || undefined;
  const pos = args.pos;
  const hintTrim = args.hoverHint.trim();
  const hoverExtras =
    hintTrim !== ""
      ? {
          hoverHint: hintTrim,
          hoverHintPlacement: args.hoverHintPlacement,
        }
      : {};
  const nav = mergeTargetSceneNav({
    targetSceneId: args.targetSceneId,
    targetSceneLookAtH: args.targetSceneLookAtH,
    targetSceneLookAtV: args.targetSceneLookAtV,
    targetSceneLookAtFov: args.targetSceneLookAtFov,
    preserveCurrentViewOnSceneChange: args.preserveCurrentViewOnSceneChange,
  });
  if (!nav.ok) return { error: nav.error };
  const sceneExtras = nav.extras;
  const base = {
    id: args.id,
    url: link,
    ...(args.modal ? { modal: args.modal } : {}),
    ...args.colors,
    ...args.rotation,
    ...pos,
    ...hoverExtras,
    ...sceneExtras,
    ...mergeSceneBtnAppearance({
      sceneBtnScale: args.sceneBtnScale,
      sceneBtnRotateXDeg: args.sceneBtnRotateXDeg,
      sceneBtnRotateYDeg: args.sceneBtnRotateYDeg,
      sceneBtnRotateZDeg: args.sceneBtnRotateZDeg,
      sceneBtnBorderRadius: args.sceneBtnBorderRadius,
      sceneBtnBorderWidthStr: args.sceneBtnBorderWidthStr,
      sceneBtnBorderColor: args.sceneBtnBorderColor,
    }),
    ...(args.isEquipment ? { isEquipment: true as const } : {}),
  };

  if (contentKind === "lucide") {
    const icon = args.lucideIcon.trim() || "Info";
    return {
      ...base,
      contentType: "lucide",
      lucideIcon: icon,
      label: args.label.trim() || undefined,
    } as SceneInteractionButtonLucide;
  }
  if (contentKind === "image") {
    const src = args.imageSrc.trim();
    if (!src) return { error: "Indiquez l’URL ou le chemin de l’image." };
    return {
      ...base,
      contentType: "image",
      imageSrc: src,
      imageAlt: args.imageAlt.trim() || undefined,
    } as SceneInteractionButtonImage;
  }
  if (contentKind === "svg") {
    return {
      ...base,
      contentType: "svg",
      svgId: args.svgIconId,
      label: args.label.trim() || undefined,
    } as SceneInteractionButtonSvg;
  }
  return {
    ...base,
    contentType: "text",
    label: args.label.trim() || "Bouton",
  } as SceneInteractionButtonText;
}

function InteractionColorRow({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const trimmed = value.trim();
  const isHex6 = /^#[0-9A-Fa-f]{6}$/.test(trimmed);
  const pickerValue = isHex6 ? trimmed : "#0284c7";
  return (
    <div className="mt-2 space-y-1">
      <label className="block text-xs text-zinc-400" htmlFor={id}>
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="color"
          id={`${id}-pick`}
          className="h-9 w-11 shrink-0 cursor-pointer rounded border border-white/10 bg-zinc-900"
          value={pickerValue}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} (nuancier)`}
        />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`min-w-0 flex-1 font-mono ${fieldClass}`}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

/**
 * Bouton en haut à droite + panneau pour créer des boutons d’interaction par scène.
 */
export function InteractionEditor({
  sceneName,
  map,
  onMapChange,
  krpano,
  viewerContainerId,
  onSceneButtonListHover,
  shellPanelsVisible = true,
}: InteractionEditorProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [placementMode, setPlacementMode] = useState(false);
  const [uiKind, setUiKind] = useState<UiKind>("text");
  const [iconPack, setIconPack] = useState<IconPack>("lucide");
  const [svgIconId, setSvgIconId] = useState<InteractionSvgIconId>("cross");
  const [label, setLabel] = useState("Nouveau bouton");
  const [url, setUrl] = useState("");
  const [lucideIcon, setLucideIcon] = useState("Info");
  const [imageSrc, setImageSrc] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [modalTitle, setModalTitle] = useState("");
  const [modalBody, setModalBody] = useState("");
  const [modalVideoUrl, setModalVideoUrl] = useState("");
  const [bgColor, setBgColor] = useState<string>(PRESET_COLORS.btnBg);
  const [fgColor, setFgColor] = useState<string>(PRESET_COLORS.btnFg);
  const [hoverBgColor, setHoverBgColor] = useState<string>(
    PRESET_COLORS.hoverBg,
  );
  const [hoverFgColor, setHoverFgColor] = useState<string>(
    PRESET_COLORS.hoverFg,
  );
  const [iconRotation, setIconRotation] = useState("0");
  const [iconHoverRotation, setIconHoverRotation] = useState("0");
  const [iconRotationDuration, setIconRotationDuration] = useState("");
  const [iconRotationDelay, setIconRotationDelay] = useState("");
  const [modalBgColor, setModalBgColor] = useState<string>(
    PRESET_COLORS.modalBg,
  );
  const [modalTextColor, setModalTextColor] = useState<string>(
    PRESET_COLORS.modalText,
  );
  const [modalBorderColor, setModalBorderColor] = useState<string>(
    PRESET_COLORS.modalBorder,
  );
  const [backdropColor, setBackdropColor] = useState<string>(
    PRESET_COLORS.backdrop,
  );
  const [modalMaxWidth, setModalMaxWidth] = useState("");
  const [modalVideoAutoplay, setModalVideoAutoplay] = useState(true);
  const [hoverHint, setHoverHint] = useState("");
  const [hoverHintPlacement, setHoverHintPlacement] =
    useState<InteractionHoverHintPlacement>("top");
  const [targetSceneId, setTargetSceneId] = useState("");
  const [targetSceneLookAtH, setTargetSceneLookAtH] = useState("");
  const [targetSceneLookAtV, setTargetSceneLookAtV] = useState("");
  const [targetSceneLookAtFov, setTargetSceneLookAtFov] = useState("");
  const [preserveCurrentViewOnSceneChange, setPreserveCurrentViewOnSceneChange] =
    useState(false);
  const [sceneBtnScale, setSceneBtnScale] = useState(1);
  const [sceneBtnRotateXDeg, setSceneBtnRotateXDeg] = useState(0);
  const [sceneBtnRotateYDeg, setSceneBtnRotateYDeg] = useState(0);
  const [sceneBtnRotateZDeg, setSceneBtnRotateZDeg] = useState(0);
  const [sceneBtnBorderRadius, setSceneBtnBorderRadius] = useState("");
  const [sceneBtnBorderWidthStr, setSceneBtnBorderWidthStr] = useState("");
  const [sceneBtnBorderColor, setSceneBtnBorderColor] = useState("");
  const [isEquipment, setIsEquipment] = useState(false);
  const [closeOnBackdropClick, setCloseOnBackdropClick] = useState(true);
  const [closeOnEscape, setCloseOnEscape] = useState(true);
  const [showCloseButton, setShowCloseButton] = useState(true);
  const [showTitleBar, setShowTitleBar] = useState(true);
  const [centerViewForModal, setCenterViewForModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  /** Onglet du panneau : création (nouveau bouton) ou édition (liste + formulaire si modification). */
  const [panelTab, setPanelTab] = useState<"create" | "edit">("create");
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState<string | null>(null);

  const buttons = map[sceneName] ?? [];
  const editingButton =
    editingId != null ? buttons.find((b) => b.id === editingId) : undefined;

  useEffect(() => {
    onSceneButtonListHover?.(null);
  }, [sceneName, onSceneButtonListHover]);

  useEffect(() => {
    if (!open) onSceneButtonListHover?.(null);
  }, [open, onSceneButtonListHover]);

  useEffect(() => {
    if (!open) setPanelTab("create");
  }, [open]);

  const resetFormToDefaults = useCallback(() => {
    setUiKind("text");
    setIconPack("lucide");
    setSvgIconId("cross");
    setLabel("Nouveau bouton");
    setUrl("");
    setLucideIcon("Info");
    setImageSrc("");
    setImageAlt("");
    setModalTitle("");
    setModalBody("");
    setModalVideoUrl("");
    setBgColor(PRESET_COLORS.btnBg);
    setFgColor(PRESET_COLORS.btnFg);
    setHoverBgColor(PRESET_COLORS.hoverBg);
    setHoverFgColor(PRESET_COLORS.hoverFg);
    setIconRotation("0");
    setIconHoverRotation("0");
    setIconRotationDuration("");
    setIconRotationDelay("");
    setModalBgColor(PRESET_COLORS.modalBg);
    setModalTextColor(PRESET_COLORS.modalText);
    setModalBorderColor(PRESET_COLORS.modalBorder);
    setBackdropColor(PRESET_COLORS.backdrop);
    setModalMaxWidth("");
    setModalVideoAutoplay(true);
    setHoverHint("");
    setHoverHintPlacement("top");
    setTargetSceneId("");
    setTargetSceneLookAtH("");
    setTargetSceneLookAtV("");
    setTargetSceneLookAtFov("");
    setPreserveCurrentViewOnSceneChange(false);
    setSceneBtnScale(1);
    setSceneBtnRotateXDeg(0);
    setSceneBtnRotateYDeg(0);
    setSceneBtnRotateZDeg(0);
    setSceneBtnBorderRadius("");
    setSceneBtnBorderWidthStr("");
    setSceneBtnBorderColor("");
    setIsEquipment(false);
    setCloseOnBackdropClick(true);
    setCloseOnEscape(true);
    setShowCloseButton(true);
    setShowTitleBar(true);
    setCenterViewForModal(false);
  }, []);

  const fillFormFromButton = useCallback((b: SceneInteractionButton) => {
    setFormError(null);
    setUrl(b.url ?? "");
    setBgColor(b.bgColor ?? PRESET_COLORS.btnBg);
    setFgColor(b.fgColor ?? PRESET_COLORS.btnFg);
    setHoverBgColor(b.hoverBgColor ?? PRESET_COLORS.hoverBg);
    setHoverFgColor(b.hoverFgColor ?? PRESET_COLORS.hoverFg);
    setIconRotation(
      b.iconRotationDeg != null && Number.isFinite(b.iconRotationDeg)
        ? String(b.iconRotationDeg)
        : "0",
    );
    setIconHoverRotation(
      b.iconHoverRotationDeg != null && Number.isFinite(b.iconHoverRotationDeg)
        ? String(b.iconHoverRotationDeg)
        : "0",
    );
    setIconRotationDuration(
      b.iconRotationDurationMs != null &&
        Number.isFinite(b.iconRotationDurationMs)
        ? String(b.iconRotationDurationMs)
        : "",
    );
    setIconRotationDelay(
      b.iconRotationDelayMs != null && Number.isFinite(b.iconRotationDelayMs)
        ? String(b.iconRotationDelayMs)
        : "",
    );

    const m = b.modal;
    setModalTitle(m?.title ?? "");
    setModalBody(m?.body ?? "");
    setModalVideoUrl(m?.videoUrl ?? "");
    setModalBgColor(m?.bgColor ?? PRESET_COLORS.modalBg);
    setModalTextColor(m?.textColor ?? PRESET_COLORS.modalText);
    setModalBorderColor(m?.borderColor ?? PRESET_COLORS.modalBorder);
    setBackdropColor(m?.backdropColor ?? PRESET_COLORS.backdrop);
    setModalMaxWidth(m?.maxWidth ?? "");
    setModalVideoAutoplay(m?.videoAutoplay !== false);
    setHoverHint(b.hoverHint?.trim() ?? "");
    setHoverHintPlacement(b.hoverHintPlacement ?? "top");
    setTargetSceneId(b.targetSceneId?.trim() ?? "");
    const preserve = b.preserveCurrentViewOnSceneChange === true;
    setPreserveCurrentViewOnSceneChange(preserve);
    if (!preserve) {
      const la = b.targetSceneLookAt;
      if (
        la &&
        Number.isFinite(la.hlookat) &&
        Number.isFinite(la.vlookat)
      ) {
        setTargetSceneLookAtH(String(la.hlookat));
        setTargetSceneLookAtV(String(la.vlookat));
        setTargetSceneLookAtFov(
          la.fov != null && Number.isFinite(la.fov) ? String(la.fov) : "",
        );
      } else {
        setTargetSceneLookAtH("");
        setTargetSceneLookAtV("");
        setTargetSceneLookAtFov("");
      }
    } else {
      setTargetSceneLookAtH("");
      setTargetSceneLookAtV("");
      setTargetSceneLookAtFov("");
    }
    setSceneBtnScale(
      b.sceneBtnScale != null &&
        Number.isFinite(b.sceneBtnScale) &&
        b.sceneBtnScale > 0
        ? b.sceneBtnScale
        : 1,
    );
    setSceneBtnRotateXDeg(b.sceneBtnRotateXDeg ?? 0);
    setSceneBtnRotateYDeg(b.sceneBtnRotateYDeg ?? 0);
    setSceneBtnRotateZDeg(b.sceneBtnRotateZDeg ?? 0);
    setSceneBtnBorderRadius(b.sceneBtnBorderRadius?.trim() ?? "");
    {
      const bw = b.sceneBtnBorderWidthPx;
      if (bw === 0) setSceneBtnBorderWidthStr("0");
      else if (typeof bw === "number" && bw > 0)
        setSceneBtnBorderWidthStr(String(bw));
      else setSceneBtnBorderWidthStr("");
    }
    setSceneBtnBorderColor(b.sceneBtnBorderColor?.trim() ?? "");
    setIsEquipment(b.isEquipment === true);
    setCloseOnBackdropClick(m?.closeOnBackdropClick !== false);
    setCloseOnEscape(m?.closeOnEscape !== false);
    setShowCloseButton(m?.showCloseButton !== false);
    setShowTitleBar(m?.showTitleBar !== false);
    setCenterViewForModal(m?.centerViewForModal === true);

    if (isLucideButton(b)) {
      setUiKind("icon");
      setIconPack("lucide");
      setLucideIcon(b.lucideIcon);
      setLabel(b.label ?? "");
    } else if (isSvgButton(b)) {
      setUiKind("icon");
      setIconPack("svg");
      setSvgIconId(b.svgId);
      setLabel(b.label ?? "");
    } else if (isImageButton(b)) {
      setUiKind("image");
      setImageSrc(b.imageSrc);
      setImageAlt(b.imageAlt ?? "");
    } else {
      setUiKind("text");
      setLabel(isTextButton(b) ? b.label : "Bouton");
    }
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    resetFormToDefaults();
    setFormError(null);
  }, [resetFormToDefaults]);

  const startEditButton = useCallback(
    (b: SceneInteractionButton) => {
      fillFormFromButton(b);
      setEditingId(b.id);
      setPanelTab("edit");
      setOpen(true);
      setFormError(null);
    },
    [fillFormFromButton],
  );

  const beginRepositionButton = useCallback(
    (b: SceneInteractionButton) => {
      setFormError(null);
      if (!krpano || !viewerContainerId) {
        setFormError(
          "Panorama pas encore prêt — attendez quelques secondes et réessayez.",
        );
        return;
      }
      const err = validateButtonForPlacement(b);
      if (err) {
        setFormError(err);
        return;
      }
      fillFormFromButton(b);
      setEditingId(b.id);
      setOpen(false);
      setPlacementMode(true);
    },
    [fillFormFromButton, krpano, viewerContainerId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (placementMode) {
        setPlacementMode(false);
        return;
      }
      if (open) {
        setOpen(false);
        if (editingId) {
          setEditingId(null);
          resetFormToDefaults();
          setFormError(null);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placementMode, open, editingId, resetFormToDefaults]);

  const buildModalAndColorsRotation = useCallback(() => {
    const contentKind: ContentKind =
      uiKind === "text"
        ? "text"
        : uiKind === "image"
          ? "image"
          : iconPack === "lucide"
            ? "lucide"
            : "svg";
    const modal = buildModalFromForm(
      modalTitle,
      modalBody,
      modalVideoUrl,
      modalBgColor,
      modalTextColor,
      modalBorderColor,
      backdropColor,
      modalMaxWidth,
      closeOnBackdropClick,
      closeOnEscape,
      showCloseButton,
      showTitleBar,
      centerViewForModal,
      modalVideoAutoplay,
    );
    const colors = buildColorFields(
      bgColor,
      fgColor,
      hoverBgColor,
      hoverFgColor,
    );
    const rotation = iconRotationField(
      contentKind,
      iconRotation,
      iconHoverRotation,
      iconRotationDuration,
      iconRotationDelay,
    );
    return { contentKind, modal, colors, rotation };
  }, [
    uiKind,
    iconPack,
    modalTitle,
    modalBody,
    modalVideoUrl,
    modalBgColor,
    modalTextColor,
    modalBorderColor,
    backdropColor,
    modalMaxWidth,
    closeOnBackdropClick,
    closeOnEscape,
    showCloseButton,
    showTitleBar,
    centerViewForModal,
    modalVideoAutoplay,
    bgColor,
    fgColor,
    hoverBgColor,
    hoverFgColor,
    iconRotation,
    iconHoverRotation,
    iconRotationDuration,
    iconRotationDelay,
  ]);

  const addButtonAt = useCallback(
    (ath: number, atv: number) => {
      const { contentKind, modal, colors, rotation } =
        buildModalAndColorsRotation();

      const id =
        editingId ??
        (typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `btn-${Date.now()}`);

      const next = buildInteractionButton(contentKind, {
        id,
        pos: { ath, atv },
        label,
        url,
        lucideIcon,
        imageSrc,
        imageAlt,
        svgIconId,
        modal,
        colors,
        rotation,
        hoverHint,
        hoverHintPlacement,
        targetSceneId,
        targetSceneLookAtH,
        targetSceneLookAtV,
        targetSceneLookAtFov,
        preserveCurrentViewOnSceneChange,
        sceneBtnScale,
        sceneBtnRotateXDeg,
        sceneBtnRotateYDeg,
        sceneBtnRotateZDeg,
        sceneBtnBorderRadius,
        sceneBtnBorderWidthStr,
        sceneBtnBorderColor,
        isEquipment,
      });

      if ("error" in next) {
        setFormError(next.error);
        setPlacementMode(false);
        setOpen(true);
        return;
      }

      const list = map[sceneName] ?? [];
      const isReplace = editingId != null;
      const nextList = isReplace
        ? list.map((item) => (item.id === editingId ? next : item))
        : [...list, next];

      onMapChange({
        ...map,
        [sceneName]: nextList,
      });
      setPlacementMode(false);
      setFormError(null);
      if (isReplace) {
        setEditingId(null);
        resetFormToDefaults();
      }
    },
    [
      editingId,
      buildModalAndColorsRotation,
      label,
      url,
      lucideIcon,
      imageSrc,
      imageAlt,
      svgIconId,
      hoverHint,
      hoverHintPlacement,
      targetSceneId,
      targetSceneLookAtH,
      targetSceneLookAtV,
      targetSceneLookAtFov,
      preserveCurrentViewOnSceneChange,
      sceneBtnScale,
      sceneBtnRotateXDeg,
      sceneBtnRotateYDeg,
      sceneBtnRotateZDeg,
      sceneBtnBorderRadius,
      sceneBtnBorderWidthStr,
      sceneBtnBorderColor,
      isEquipment,
      map,
      sceneName,
      onMapChange,
      resetFormToDefaults,
    ],
  );

  const saveEditsWithoutPlacement = useCallback(() => {
    if (!editingId) return;
    const list = map[sceneName] ?? [];
    const existing = list.find((b) => b.id === editingId);
    if (!existing) {
      setFormError("Bouton introuvable — annulez l’édition.");
      return;
    }
    const { contentKind, modal, colors, rotation } =
      buildModalAndColorsRotation();
    const pos = positionFromButton(existing);

    const next = buildInteractionButton(contentKind, {
      id: editingId,
      pos,
      label,
      url,
      lucideIcon,
      imageSrc,
      imageAlt,
      svgIconId,
      modal,
      colors,
      rotation,
      hoverHint,
      hoverHintPlacement,
      targetSceneId,
      targetSceneLookAtH,
      targetSceneLookAtV,
      targetSceneLookAtFov,
      preserveCurrentViewOnSceneChange,
      sceneBtnScale,
      sceneBtnRotateXDeg,
      sceneBtnRotateYDeg,
      sceneBtnRotateZDeg,
      sceneBtnBorderRadius,
      sceneBtnBorderWidthStr,
      sceneBtnBorderColor,
      isEquipment,
    });

    if ("error" in next) {
      setFormError(next.error);
      return;
    }

    onMapChange({
      ...map,
      [sceneName]: list.map((b) => (b.id === editingId ? next : b)),
    });
    setFormError(null);
    setEditingId(null);
    resetFormToDefaults();
  }, [
    editingId,
    buildModalAndColorsRotation,
    label,
    url,
    lucideIcon,
    imageSrc,
    imageAlt,
    svgIconId,
    hoverHint,
    hoverHintPlacement,
    targetSceneId,
    targetSceneLookAtH,
    targetSceneLookAtV,
    targetSceneLookAtFov,
    preserveCurrentViewOnSceneChange,
    sceneBtnScale,
    sceneBtnRotateXDeg,
    sceneBtnRotateYDeg,
    sceneBtnRotateZDeg,
    sceneBtnBorderRadius,
    sceneBtnBorderWidthStr,
    sceneBtnBorderColor,
    isEquipment,
    map,
    sceneName,
    onMapChange,
    resetFormToDefaults,
  ]);

  const removeButton = useCallback(
    (id: string) => {
      if (id === editingId) {
        setEditingId(null);
        resetFormToDefaults();
      }
      const list = map[sceneName] ?? [];
      onMapChange({
        ...map,
        [sceneName]: list.filter((b) => b.id !== id),
      });
    },
    [map, sceneName, onMapChange, editingId, resetFormToDefaults],
  );

  const startPlacement = useCallback(() => {
    setFormError(null);
    if (!krpano || !viewerContainerId) {
      setFormError(
        "Panorama pas encore prêt — attendez quelques secondes et réessayez.",
      );
      return;
    }
    if (uiKind === "text" && !label.trim()) {
      setLabel("Bouton");
    }
    if (uiKind === "image" && !imageSrc.trim()) {
      setFormError("Renseignez l’URL de l’image avant de placer le bouton.");
      return;
    }
    if (uiKind === "icon" && iconPack === "lucide" && !lucideIcon.trim()) {
      setFormError("Indiquez le nom de l’icône Lucide (ex. Info).");
      return;
    }
    setOpen(false);
    setPlacementMode(true);
  }, [uiKind, iconPack, label, imageSrc, lucideIcon, krpano, viewerContainerId]);

  const downloadJson = useCallback(() => {
    const blob = new Blob([exportInteractionsJson(map)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "scene-interactions.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }, [map]);

  const publishToDb = useCallback(async () => {
    setPublishBusy(true);
    setPublishFeedback(null);
    try {
      const result = await postSceneInteractionsToServer(map);
      if (!result.ok) {
        throw new Error(result.error);
      }
      setPublishFeedback(null);
    } catch (e) {
      setPublishFeedback(
        e instanceof Error ? e.message : "Échec de l’enregistrement",
      );
    } finally {
      setPublishBusy(false);
    }
  }, [map]);

  return (
    <>
      <div
        className={`fixed right-4 bottom-0 z-100 flex flex-col-reverse gap-2 pointer-events-none items-end ${sceneNavbarBottomReservePaddingClass} ${shellPanelsVisible ? "" : "hidden"}`}
      >
        {!placementMode && (
          <button
            type="button"
            aria-expanded={open ? "true" : "false"}
            aria-controls={open ? panelId : undefined}
            onClick={() => setOpen((o) => !o)}
            className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/15 bg-zinc-900/90 px-4 py-2.5 text-sm font-medium text-zinc-100 shadow-lg backdrop-blur-md transition hover:bg-zinc-800/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <span className="inline-block size-2 rounded-full bg-emerald-400" aria-hidden />
            Interactions
          </button>
        )}

        {open && !placementMode && (
          <div
            id={panelId}
            role="dialog"
            aria-label="Éditeur d’interactions par scène"
            className="pointer-events-auto flex max-h-[min(40rem,calc(100dvh-7rem))] w-[min(100vw-2rem,30rem)] flex-col overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950/98 text-zinc-100 shadow-2xl backdrop-blur-md [-webkit-overflow-scrolling:touch]"
          >
          <div className="shrink-0 border-b border-zinc-800/80 bg-zinc-950/80 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Scène active
            </p>
            <p className="mt-0.5 font-mono text-xs leading-snug text-sky-300 break-all">
              {sceneName || "—"}
            </p>
          </div>

          <div
            className="flex shrink-0 gap-1 border-b border-zinc-800/80 bg-zinc-950/90 px-3 py-2"
            role="tablist"
            aria-label="Mode du panneau"
          >
            <button
              type="button"
              role="tab"
              id={`${panelId}-tab-create`}
              aria-selected={panelTab === "create"}
              aria-controls={`${panelId}-interaction-panel`}
              tabIndex={panelTab === "create" ? 0 : -1}
              onClick={() => {
                cancelEdit();
                setPanelTab("create");
                setFormError(null);
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 ${
                panelTab === "create"
                  ? "bg-sky-600 text-white shadow-md shadow-sky-900/30"
                  : "bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              Création
            </button>
            <button
              type="button"
              role="tab"
              id={`${panelId}-tab-edit`}
              aria-selected={panelTab === "edit"}
              aria-controls={`${panelId}-interaction-panel`}
              tabIndex={panelTab === "edit" ? 0 : -1}
              onClick={() => setPanelTab("edit")}
              className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 ${
                panelTab === "edit"
                  ? "bg-sky-600 text-white shadow-md shadow-sky-900/30"
                  : "bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              Édition
              {buttons.length > 0 ? (
                <span className="ml-1.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-white/20 px-1 text-[10px] tabular-nums">
                  {buttons.length}
                </span>
              ) : null}
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            <div
              id={`${panelId}-interaction-panel`}
              role="tabpanel"
              aria-labelledby={
                panelTab === "create"
                  ? `${panelId}-tab-create`
                  : `${panelId}-tab-edit`
              }
              className="space-y-4"
            >
            {panelTab === "edit" ? (
                <div className="rounded-2xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/55 to-zinc-950/70 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                  <div className="flex items-start justify-between gap-2 border-b border-zinc-800/70 pb-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        Sur cette scène
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-zinc-100">
                        Boutons placés
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                        {buttons.length === 0
                          ? "Aucun bouton encore — passez à l’onglet Création pour en ajouter."
                          : `${buttons.length} élément${buttons.length > 1 ? "s" : ""} — survolez une ligne pour la surbrillance dans la visite.`}
                      </p>
                    </div>
                    {buttons.length > 0 ? (
                      <span className="shrink-0 rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-sky-300">
                        {buttons.length}
                      </span>
                    ) : null}
                  </div>
                  {buttons.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-zinc-700/70 bg-zinc-950/40 px-4 py-8 text-center">
                      <p className="text-[13px] font-medium text-zinc-300">
                        Aucun bouton pour l’instant
                      </p>
                      <p className="mt-2 text-[12px] leading-relaxed text-zinc-500">
                        Ouvrez l’onglet <span className="font-medium text-zinc-400">Création</span>{" "}
                        pour configurer un bouton puis « Placer sur la scène ».
                      </p>
                    </div>
                  ) : (
                    <ul className="mt-4 max-h-52 space-y-2.5 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] [scrollbar-color:rgba(82,82,91,0.6)_transparent]">
                      {buttons.map((b) => (
                        <li key={b.id}>
                          <div
                            className="group relative overflow-hidden rounded-xl border border-zinc-700/55 bg-zinc-950/85 pl-3 pr-2 py-2.5 shadow-sm transition hover:border-sky-500/40 hover:bg-zinc-900/95"
                            onMouseEnter={() => onSceneButtonListHover?.(b.id)}
                            onMouseLeave={() => onSceneButtonListHover?.(null)}
                          >
                            <div
                              className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-sky-500/80 opacity-70 transition group-hover:opacity-100"
                              aria-hidden
                            />
                            <div className="pl-2.5">
                              <p
                                className="line-clamp-2 text-[13px] font-medium leading-snug text-zinc-100"
                                title={interactionSummary(b)}
                              >
                                {interactionSummary(b)}
                              </p>
                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => startEditButton(b)}
                                  className="inline-flex items-center justify-center rounded-lg border border-sky-800/60 bg-sky-950/50 px-2.5 py-1.5 text-[11px] font-semibold text-sky-300 transition hover:border-sky-600/60 hover:bg-sky-900/60"
                                >
                                  Modifier
                                </button>
                                <button
                                  type="button"
                                  onClick={() => beginRepositionButton(b)}
                                  disabled={placementMode}
                                  className="inline-flex items-center justify-center rounded-lg border border-amber-800/50 bg-amber-950/35 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200/95 transition hover:border-amber-600/50 hover:bg-amber-950/55 disabled:cursor-not-allowed disabled:opacity-40"
                                  title="Replacer le bouton en cliquant sur le panorama"
                                >
                                  Déplacer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeButton(b.id)}
                                  className="inline-flex items-center justify-center rounded-lg border border-red-900/45 bg-red-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-red-300/95 transition hover:border-red-700/50 hover:bg-red-950/50"
                                >
                                  Supprimer
                                </button>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
            ) : null}

            {(panelTab === "create" ||
              (panelTab === "edit" && editingId != null)) && (
              <div
                className={`min-h-0 space-y-3 ${
                  panelTab === "edit" && editingId
                    ? "border-t border-zinc-800/70 pt-4"
                    : ""
                }`}
              >
                <div className="px-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {panelTab === "edit" && editingId ? "Édition" : "Nouveau bouton"}
                  </p>
                  <h2 className="mt-1 text-sm font-semibold tracking-tight text-zinc-100">
                    {panelTab === "edit" && editingId
                      ? "Modifier ce bouton"
                      : "Créer un bouton"}
                  </h2>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                    {panelTab === "edit" && editingId
                      ? "Ajustez les options puis enregistrez ou repositionnez sur la scène."
                      : "Choisissez le type, les couleurs et le comportement, puis placez le bouton sur le panorama."}
                  </p>
                </div>
          <EditorSection
            title="Type de bouton"
            description="Texte, icône (Lucide ou pictogrammes Micronique) ou image."
          >
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["text", "Texte"],
                  ["icon", "Icône"],
                  ["image", "Image"],
                ] as const
              ).map(([value, lab]) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-medium transition ${pillClass(
                    uiKind === value,
                  )}`}
                >
                  <input
                    type="radio"
                    name="ix-uikind"
                    className="sr-only"
                    checked={uiKind === value}
                    onChange={() => {
                      setUiKind(value);
                      setFormError(null);
                    }}
                  />
                  {lab}
                </label>
              ))}
            </div>
            {uiKind === "icon" && (
              <div>
                <p className="text-[11px] text-zinc-500">Source de l’icône</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIconPack("lucide");
                      setFormError(null);
                    }}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${pillClass(
                      iconPack === "lucide",
                    )}`}
                  >
                    Bibliothèque Lucide
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIconPack("svg");
                      setFormError(null);
                    }}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${pillClass(
                      iconPack === "svg",
                    )}`}
                  >
                    Micronique (SVG)
                  </button>
                </div>
              </div>
            )}
          </EditorSection>

            <EditorSection
              title="Catalogue équipements"
              description="Les entrées cochées apparaissent dans le menu « Équipements » (haut gauche), groupées par zone (scène)."
            >
              <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-snug text-zinc-300">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-white/20"
                  checked={isEquipment}
                  onChange={(e) => setIsEquipment(e.target.checked)}
                />
                <span>
                  Marquer comme équipement (accessible depuis le catalogue par zone ; un clic rejoue
                  la même action que sur la scène : boîte, lien, autre scène…).
                </span>
              </label>
            </EditorSection>

            {uiKind === "text" && (
              <EditorSection title="Texte du bouton">
                <label className="block text-[11px] font-medium text-zinc-400" htmlFor="ix-label">
                  Libellé affiché
                </label>
                <input
                  id="ix-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className={fieldClass}
                  placeholder="Ex. Voir la fiche produit"
                />
              </EditorSection>
            )}

            {uiKind === "icon" && iconPack === "lucide" && (
              <EditorSection
                title="Icône Lucide"
                description="Nom du symbole tel qu’exporté par la bibliothèque (PascalCase)."
              >
                <label className="block text-[11px] font-medium text-zinc-400" htmlFor="ix-lucide">
                  Symbole
                </label>
                <select
                  id="ix-lucide-preset"
                  aria-label="Suggestions d’icônes Lucide"
                  className={`mb-2 ${fieldClass}`}
                  value={
                    LUCIDE_SUGGESTIONS.includes(lucideIcon as (typeof LUCIDE_SUGGESTIONS)[number])
                      ? lucideIcon
                      : ""
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) setLucideIcon(v);
                  }}
                >
                  <option value="">— Suggestions —</option>
                  {LUCIDE_SUGGESTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <input
                  id="ix-lucide"
                  value={lucideIcon}
                  onChange={(e) => setLucideIcon(e.target.value)}
                  className={`font-mono ${fieldClass}`}
                  placeholder="Ex. Info, ExternalLink, MapPin…"
                  autoComplete="off"
                />
                <p className="text-[11px] text-zinc-500">
                  Référence :{" "}
                  <a
                    href="https://lucide.dev/icons/"
                    className="text-sky-400 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    lucide.dev/icons
                  </a>
                </p>
                <label className="mt-2 block text-[11px] font-medium text-zinc-400" htmlFor="ix-lucide-aria">
                  Libellé accessibilité (optionnel)
                </label>
                <input
                  id="ix-lucide-aria"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className={fieldClass}
                  placeholder="Ex. Ouvrir la carte"
                />
              </EditorSection>
            )}

            {uiKind === "icon" && iconPack === "svg" && (
              <EditorSection
                title="Pictogramme Micronique"
                description="Couleur pilotée par « Texte / icônes » ci-dessous."
              >
                <p className="text-[11px] text-zinc-500">Choisir le symbole</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["cross", "arrow", "microniquePlay"] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSvgIconId(id)}
                      className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-3 transition ${pillClass(
                        svgIconId === id,
                      )}`}
                    >
                      <InteractionSvgIcon
                        id={id}
                        className="size-9 text-zinc-100"
                      />
                      <span className="text-[11px] text-zinc-400">
                        {interactionSvgLabel(id)}
                      </span>
                    </button>
                  ))}
                </div>
                <label className="mt-2 block text-[11px] font-medium text-zinc-400" htmlFor="ix-svg-aria">
                  Libellé accessibilité (optionnel)
                </label>
                <input
                  id="ix-svg-aria"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className={fieldClass}
                  placeholder="Ex. Plus d’informations"
                />
              </EditorSection>
            )}

            {uiKind === "image" && (
              <EditorSection title="Image du bouton">
                <label className="block text-[11px] font-medium text-zinc-400" htmlFor="ix-img">
                  URL ou chemin (/…)
                </label>
                <input
                  id="ix-img"
                  value={imageSrc}
                  onChange={(e) => setImageSrc(e.target.value)}
                  className={fieldClass}
                  placeholder="https://… ou /mon-image.png"
                />
                <label className="mt-2 block text-[11px] font-medium text-zinc-400" htmlFor="ix-img-alt">
                  Texte alternatif (optionnel)
                </label>
                <input
                  id="ix-img-alt"
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                  className={fieldClass}
                  placeholder="Description courte"
                />
              </EditorSection>
            )}

            {uiKind === "icon" && (
              <EditorSection
                title="Rotation et animation"
                description="Angles en degrés, sens horaire. Optionnel."
              >
              <div>
                <label
                  className="block text-xs text-zinc-400"
                  htmlFor="ix-icon-rot"
                >
                  Rotation de l’icône (degrés)
                </label>
                <input
                  id="ix-icon-rot"
                  type="number"
                  step={1}
                  value={iconRotation}
                  onChange={(e) => setIconRotation(e.target.value)}
                  className={`mt-1 ${fieldClass}`}
                  placeholder="0"
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  Sens horaire. Ex. 90 pour une flèche vers le bas.
                </p>
                <label
                  className="mt-3 block text-xs text-zinc-400"
                  htmlFor="ix-icon-rot-hover"
                >
                  Rotation au survol (degrés en plus)
                </label>
                <input
                  id="ix-icon-rot-hover"
                  type="number"
                  step={1}
                  value={iconHoverRotation}
                  onChange={(e) => setIconHoverRotation(e.target.value)}
                  className={`mt-1 ${fieldClass}`}
                  placeholder="0"
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  S’ajoute à la rotation de base pendant le survol du bouton
                  (animation douce ; désactivée si « réduire les animations »
                  système).
                </p>
                <label
                  className="mt-3 block text-xs text-zinc-400"
                  htmlFor="ix-icon-rot-duration"
                >
                  Durée de la transition (ms)
                </label>
                <input
                  id="ix-icon-rot-duration"
                  type="number"
                  min={0}
                  step={50}
                  value={iconRotationDuration}
                  onChange={(e) => setIconRotationDuration(e.target.value)}
                  className={`mt-1 ${fieldClass}`}
                  placeholder="250 (défaut si vide)"
                />
                <label
                  className="mt-3 block text-xs text-zinc-400"
                  htmlFor="ix-icon-rot-delay"
                >
                  Délai avant la transition (ms)
                </label>
                <input
                  id="ix-icon-rot-delay"
                  type="number"
                  min={0}
                  step={50}
                  value={iconRotationDelay}
                  onChange={(e) => setIconRotationDelay(e.target.value)}
                  className={`mt-1 ${fieldClass}`}
                  placeholder="0 (défaut si vide)"
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  Uniquement si une rotation (base ou survol) est définie. Vide
                  = 250 ms et 0 ms de délai.
                </p>
              </div>
              </EditorSection>
            )}

            <EditorSection
              title="Couleurs du bouton"
              description="Préréglages : fond blanc, texte bleu nuit (#0e203d), survol inversé. Ajustez ou réinitialisez."
            >
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBgColor(PRESET_COLORS.btnBg);
                    setFgColor(PRESET_COLORS.btnFg);
                    setHoverBgColor(PRESET_COLORS.hoverBg);
                    setHoverFgColor(PRESET_COLORS.hoverFg);
                  }}
                  className="rounded-lg border border-zinc-600 bg-zinc-800/80 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-700"
                >
                  Réinitialiser les couleurs
                </button>
              </div>
              <InteractionColorRow
                id="ix-bg"
                label="Fond du bouton"
                value={bgColor}
                onChange={setBgColor}
                placeholder="#ffffff"
              />
              <InteractionColorRow
                id="ix-fg"
                label="Texte / icônes / SVG"
                value={fgColor}
                onChange={setFgColor}
                placeholder="#0e203d"
              />
              <InteractionColorRow
                id="ix-hover-bg"
                label="Fond au survol"
                value={hoverBgColor}
                onChange={setHoverBgColor}
                placeholder="#0e203d"
              />
              <InteractionColorRow
                id="ix-hover-fg"
                label="Texte / icônes au survol"
                value={hoverFgColor}
                onChange={setHoverFgColor}
                placeholder="#ffffff"
              />
            </EditorSection>

            <EditorSection
              title="Bouton sur la scène"
              description="Taille, orientation 3D et coins du bouton dans le panorama uniquement — pas la fenêtre au clic."
            >
              <label
                className="block text-[11px] font-medium text-zinc-400"
                htmlFor="ix-scene-scale"
              >
                Échelle ({sceneBtnScale.toFixed(2)}×)
              </label>
              <input
                id="ix-scene-scale"
                type="range"
                min={0.25}
                max={3}
                step={0.05}
                value={sceneBtnScale}
                onChange={(e) =>
                  setSceneBtnScale(parseFloat(e.target.value) || 1)
                }
                className="mt-1 w-full accent-sky-500"
              />
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    className="block text-[11px] font-medium text-zinc-400"
                    htmlFor="ix-scene-rx"
                  >
                    Inclinaison X (°)
                  </label>
                  <input
                    id="ix-scene-rx"
                    type="number"
                    value={sceneBtnRotateXDeg}
                    onChange={(e) =>
                      setSceneBtnRotateXDeg(
                        Number.isFinite(parseFloat(e.target.value))
                          ? parseFloat(e.target.value)
                          : 0,
                      )
                    }
                    className={`mt-1 ${fieldClass}`}
                    step={1}
                    min={-90}
                    max={90}
                  />
                </div>
                <div>
                  <label
                    className="block text-[11px] font-medium text-zinc-400"
                    htmlFor="ix-scene-ry"
                  >
                    Inclinaison Y (°)
                  </label>
                  <input
                    id="ix-scene-ry"
                    type="number"
                    value={sceneBtnRotateYDeg}
                    onChange={(e) =>
                      setSceneBtnRotateYDeg(
                        Number.isFinite(parseFloat(e.target.value))
                          ? parseFloat(e.target.value)
                          : 0,
                      )
                    }
                    className={`mt-1 ${fieldClass}`}
                    step={1}
                    min={-90}
                    max={90}
                  />
                </div>
                <div>
                  <label
                    className="block text-[11px] font-medium text-zinc-400"
                    htmlFor="ix-scene-rz"
                  >
                    Rotation Z — plan (°)
                  </label>
                  <input
                    id="ix-scene-rz"
                    type="number"
                    value={sceneBtnRotateZDeg}
                    onChange={(e) =>
                      setSceneBtnRotateZDeg(
                        Number.isFinite(parseFloat(e.target.value))
                          ? parseFloat(e.target.value)
                          : 0,
                      )
                    }
                    className={`mt-1 ${fieldClass}`}
                    step={1}
                    min={-180}
                    max={180}
                  />
                </div>
              </div>
              <label
                className="mt-3 block text-[11px] font-medium text-zinc-400"
                htmlFor="ix-scene-radius"
              >
                Rayon des coins (CSS)
              </label>
              <input
                id="ix-scene-radius"
                value={sceneBtnBorderRadius}
                onChange={(e) => setSceneBtnBorderRadius(e.target.value)}
                className={fieldClass}
                placeholder="Vide = défaut (pilule / rond). Ex. 8px, 0, 9999px"
              />
              <label
                className="mt-3 block text-[11px] font-medium text-zinc-400"
                htmlFor="ix-scene-border-w"
              >
                Bordure du bouton — épaisseur (px)
              </label>
              <input
                id="ix-scene-border-w"
                type="text"
                inputMode="decimal"
                value={sceneBtnBorderWidthStr}
                onChange={(e) => setSceneBtnBorderWidthStr(e.target.value)}
                className={fieldClass}
                placeholder="Vide = bordure fine par défaut ; 0 = aucune ; ex. 2"
              />
              <InteractionColorRow
                id="ix-scene-border-c"
                label="Couleur de la bordure"
                value={sceneBtnBorderColor}
                onChange={setSceneBtnBorderColor}
                placeholder="rgba(14,32,61,0.35)"
              />
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                Couleur seule (épaisseur vide) = 1 px. Épaisseur sans couleur =
                teinte par défaut. Bouton image : la bordure remplace l’anneau si
                tu personnalises.
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                X et Y inclinent le bouton en perspective (3D). Z tourne le bouton dans le plan de l’écran. Remettre échelle à 1 et rotations à 0 pour le défaut.
              </p>
            </EditorSection>

            <EditorSection
              title="Fenêtre au clic"
              description="Contenu optionnel. Fond bleu nuit (#0e203d) et texte clair par défaut."
            >
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalBgColor(PRESET_COLORS.modalBg);
                    setModalTextColor(PRESET_COLORS.modalText);
                    setModalBorderColor(PRESET_COLORS.modalBorder);
                    setBackdropColor(PRESET_COLORS.backdrop);
                  }}
                  className="rounded-lg border border-zinc-600 bg-zinc-800/80 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-700"
                >
                  Réinitialiser l’apparence de la boîte
                </button>
              </div>
              <label
                className="mt-3 block text-[11px] font-medium text-zinc-400"
                htmlFor="ix-modal-title"
              >
                Titre
              </label>
              <input
                id="ix-modal-title"
                value={modalTitle}
                onChange={(e) => setModalTitle(e.target.value)}
                className={fieldClass}
                placeholder="Ex. Machine CNC-400"
              />
              <label
                className="mt-2 block text-[11px] font-medium text-zinc-400"
                htmlFor="ix-modal-body"
              >
                Texte
              </label>
              <textarea
                id="ix-modal-body"
                value={modalBody}
                onChange={(e) => setModalBody(e.target.value)}
                rows={4}
                className={`resize-y ${fieldClass}`}
                placeholder="Description, consignes, etc."
              />
              <label
                className="mt-2 block text-[11px] font-medium text-zinc-400"
                htmlFor="ix-modal-video"
              >
                Vidéo (URL)
              </label>
              <input
                id="ix-modal-video"
                value={modalVideoUrl}
                onChange={(e) => setModalVideoUrl(e.target.value)}
                className={fieldClass}
                placeholder="YouTube, Vimeo, ou fichier .mp4 / .webm"
                inputMode="url"
              />
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-white/20"
                  checked={modalVideoAutoplay}
                  onChange={(e) => setModalVideoAutoplay(e.target.checked)}
                />
                <span>
                  Lancer la vidéo automatiquement à l’ouverture de la boîte
                  (YouTube, Vimeo, fichiers directs). Désactiver pour que
                  l’utilisateur appuie sur lecture.
                </span>
              </label>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Apparence de la boîte
              </p>
              <InteractionColorRow
                id="ix-modal-bg"
                label="Fond de la boîte"
                value={modalBgColor}
                onChange={setModalBgColor}
                placeholder="ex. #0e203d"
              />
              <InteractionColorRow
                id="ix-modal-fg"
                label="Texte dans la boîte"
                value={modalTextColor}
                onChange={setModalTextColor}
                placeholder="ex. #fafafa"
              />
              <InteractionColorRow
                id="ix-modal-border"
                label="Bordure"
                value={modalBorderColor}
                onChange={setModalBorderColor}
                placeholder="ex. rgba(255,255,255,0.15)"
              />
              <InteractionColorRow
                id="ix-modal-backdrop"
                label="Voile plein écran (fond derrière la boîte)"
                value={backdropColor}
                onChange={setBackdropColor}
                placeholder="ex. rgba(0,0,0,0.5)"
              />
              <label
                className="mt-3 block text-[11px] font-medium text-zinc-400"
                htmlFor="ix-modal-maxw"
              >
                Largeur max. (CSS, optionnel)
              </label>
              <input
                id="ix-modal-maxw"
                value={modalMaxWidth}
                onChange={(e) => setModalMaxWidth(e.target.value)}
                className={`font-mono ${fieldClass}`}
                placeholder="min(520px, 100vw - 2rem)"
              />
              <div className="mt-4 space-y-2 text-xs text-zinc-300">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-white/20"
                    checked={closeOnBackdropClick}
                    onChange={(e) =>
                      setCloseOnBackdropClick(e.target.checked)
                    }
                  />
                  <span>
                    Fermer en cliquant sur le voile (fond assombri). Si décoché,
                    le panorama reste utilisable derrière la boîte.
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-white/20"
                    checked={closeOnEscape}
                    onChange={(e) => setCloseOnEscape(e.target.checked)}
                  />
                  <span>Fermer avec la touche Échap</span>
                </label>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-white/20"
                    checked={showCloseButton}
                    onChange={(e) => setShowCloseButton(e.target.checked)}
                  />
                  <span>Afficher le bouton « Fermer » (sinon Échap / clic voile)</span>
                </label>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-white/20"
                    checked={showTitleBar}
                    onChange={(e) => setShowTitleBar(e.target.checked)}
                  />
                  <span>
                    Afficher la bande titre (titre + zone du bouton Fermer). Si
                    décoché, seul le corps (texte, vidéo, lien) est visible —
                    fermer avec Échap ou le voile.
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-white/20"
                    checked={centerViewForModal}
                    onChange={(e) => setCenterViewForModal(e.target.checked)}
                  />
                  <span>
                    Orienter la caméra vers le point du bouton à l’ouverture (ancrage 3D
                    uniquement) — la boîte reste attachée au bouton comme d’habitude. À la
                    fermeture, la vue revient comme avant.
                  </span>
                </label>
              </div>
            </EditorSection>

            <EditorSection
              title="Lien externe"
              description="S’ouvre dans un nouvel onglet (en complément de la fenêtre)."
            >
              <input
                id="ix-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className={fieldClass}
                placeholder="https://…"
                inputMode="url"
              />
            </EditorSection>

            <EditorSection
              title="Navigation panorama 3D"
              description="Charge une autre scène krpano au clic (comme un hotspot du tour). Prioritaire sur la boîte et le lien."
            >
              <label
                className="block text-[11px] font-medium text-zinc-400"
                htmlFor="ix-target-scene"
              >
                Scène de destination
              </label>
              <select
                id="ix-target-scene"
                value={targetSceneId}
                onChange={(e) => {
                  const v = e.target.value;
                  setTargetSceneId(v);
                  if (!v) {
                    setTargetSceneLookAtH("");
                    setTargetSceneLookAtV("");
                    setTargetSceneLookAtFov("");
                    setPreserveCurrentViewOnSceneChange(false);
                  }
                  setFormError(null);
                }}
                className={fieldClass}
              >
                <option value="">
                  — Aucune (boîte / lien selon le reste) —
                </option>
                {TOUR_SCENES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} — {s.id}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
                Liste issue de{" "}
                <span className="font-mono text-zinc-400">src/data/tour.json</span>{" "}
                (régénérer avec{" "}
                <span className="font-mono text-zinc-400">
                  node scripts/build-tour.mjs
                </span>
                ).
              </p>
              {targetSceneId ? (
                <div className="mt-4 rounded-lg border border-zinc-700/60 bg-zinc-950/50 p-3">
                  <p className="text-[11px] font-medium text-zinc-400">
                    Angle de vue à l’arrivée (optionnel)
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
                    h / v = orientation (°) ; FOV = zoom (laisser vide pour ne pas le changer). Ex. XML :{" "}
                    <span className="font-mono text-zinc-400">
                      linkedscene_lookat=&quot;-120,5,120&quot;
                    </span>
                  </p>

                  {/* DOM : paires libellé/champ pour le mobile. sm+ : placement grille = ligne des libellés, ligne des champs. */}
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-x-3 sm:gap-y-2">
                    <label
                      htmlFor="ix-target-h"
                      className="text-[11px] font-medium leading-tight text-zinc-400 sm:col-start-1 sm:row-start-1 sm:self-end"
                    >
                      hlookat (°)
                    </label>
                    <input
                      id="ix-target-h"
                      value={targetSceneLookAtH}
                      onChange={(e) => {
                        setTargetSceneLookAtH(e.target.value);
                        setFormError(null);
                      }}
                      disabled={preserveCurrentViewOnSceneChange}
                      className={`min-w-0 font-mono tabular-nums sm:col-start-1 sm:row-start-2 ${fieldClass}`}
                      placeholder="ex. −120"
                      inputMode="decimal"
                    />
                    <label
                      htmlFor="ix-target-v"
                      className="text-[11px] font-medium leading-tight text-zinc-400 sm:col-start-2 sm:row-start-1 sm:self-end"
                    >
                      vlookat (°)
                    </label>
                    <input
                      id="ix-target-v"
                      value={targetSceneLookAtV}
                      onChange={(e) => {
                        setTargetSceneLookAtV(e.target.value);
                        setFormError(null);
                      }}
                      disabled={preserveCurrentViewOnSceneChange}
                      className={`min-w-0 font-mono tabular-nums sm:col-start-2 sm:row-start-2 ${fieldClass}`}
                      placeholder="ex. 5"
                      inputMode="decimal"
                    />
                    <label
                      htmlFor="ix-target-fov"
                      className="text-[11px] font-medium leading-tight text-zinc-400 sm:col-start-3 sm:row-start-1 sm:self-end"
                      title="Champ de vision (zoom). Vide = conserver le zoom de la scène."
                    >
                      FOV (°)
                      <span className="ml-1 whitespace-nowrap text-[10px] font-normal text-zinc-500">
                        opt.
                      </span>
                    </label>
                    <input
                      id="ix-target-fov"
                      value={targetSceneLookAtFov}
                      onChange={(e) => {
                        setTargetSceneLookAtFov(e.target.value);
                        setFormError(null);
                      }}
                      disabled={preserveCurrentViewOnSceneChange}
                      className={`min-w-0 font-mono tabular-nums sm:col-start-3 sm:row-start-2 ${fieldClass}`}
                      placeholder="vide"
                      inputMode="decimal"
                    />
                  </div>
                  <label className="mt-3 flex cursor-pointer items-start gap-2 text-[11px] leading-snug text-zinc-400">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-3.5 shrink-0 rounded border-zinc-600 bg-zinc-900 accent-sky-500"
                      checked={preserveCurrentViewOnSceneChange}
                      onChange={(e) => {
                        setPreserveCurrentViewOnSceneChange(e.target.checked);
                        setFormError(null);
                      }}
                    />
                    <span>
                      Conserver l’angle de vue actuel (h / v / zoom) sur la scène de
                      destination — les champs ci-dessus sont ignorés.
                    </span>
                  </label>
                </div>
              ) : null}
            </EditorSection>

            <EditorSection
              title="Bulle au survol"
              description="Texte affiché à côté du bouton au survol (style notification), pas à l’intérieur du bouton."
            >
              <label
                className="block text-[11px] font-medium text-zinc-400"
                htmlFor="ix-hover-hint"
              >
                Texte
              </label>
              <textarea
                id="ix-hover-hint"
                value={hoverHint}
                onChange={(e) => setHoverHint(e.target.value)}
                rows={2}
                className={`resize-y ${fieldClass}`}
                placeholder="Ex. Machine CNC-400 — voir la fiche"
              />
              <p className="mt-2 text-[11px] text-zinc-500">Position de la bulle</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(
                  [
                    ["top", "Haut"],
                    ["right", "Droite"],
                    ["bottom", "Bas"],
                    ["left", "Gauche"],
                  ] as const
                ).map(([value, lab]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setHoverHintPlacement(value)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${pillClass(
                      hoverHintPlacement === value,
                    )}`}
                  >
                    {lab}
                  </button>
                ))}
              </div>
            </EditorSection>
              </div>
            )}

            {formError && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-xs text-amber-200" role="alert">
                {formError}
              </p>
            )}
          </div>
          </div>

          <div className="shrink-0 space-y-3 border-t border-zinc-800/90 bg-zinc-950/98 px-4 py-3">
          {editingId && editingButton ? (
            <div
              className="rounded-xl border border-sky-500/40 bg-gradient-to-r from-sky-950/50 to-sky-950/25 px-3 py-2.5 text-xs leading-snug text-sky-100 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.12)]"
              role="status"
            >
              <span className="font-semibold text-sky-200">Édition — </span>
              <span className="text-sky-100/90">{interactionSummary(editingButton)}</span>
            </div>
          ) : null}

          {editingId ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={saveEditsWithoutPlacement}
                disabled={placementMode}
                className="w-full rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/25 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Enregistrer les modifications
              </button>
              <button
                type="button"
                onClick={startPlacement}
                disabled={placementMode}
                className="w-full rounded-xl bg-sky-600 px-3 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {placementMode
                  ? "Cliquez sur la visite pour repositionner…"
                  : "Repositionner sur la scène"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={placementMode}
                className="w-full rounded-xl border border-zinc-600 bg-zinc-900/80 px-3 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Annuler l’édition
              </button>
            </div>
          ) : panelTab === "create" ? (
            <button
              type="button"
              onClick={startPlacement}
              disabled={placementMode}
              className="w-full rounded-xl bg-sky-600 px-3 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {placementMode
                ? "Cliquez sur la visite pour placer…"
                : "Placer sur la scène"}
            </button>
          ) : (
            <p className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2.5 text-center text-[11px] leading-relaxed text-zinc-400">
              Pour ajouter un bouton, passez à l’onglet{" "}
              <span className="font-medium text-zinc-300">Création</span>.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadJson}
              className="rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
            >
              Télécharger JSON
            </button>
            <button
              type="button"
              disabled={publishBusy}
              onClick={() => void publishToDb()}
              className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-950/60 disabled:opacity-50"
            >
              {publishBusy ? "Enregistrement…" : "Publier dans la base (toutes les scènes)"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  typeof window !== "undefined" &&
                  window.confirm("Effacer tous les boutons de toutes les scènes ?")
                ) {
                  onMapChange({});
                }
              }}
              className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/50"
            >
              Tout effacer
            </button>
          </div>

          {publishFeedback ? (
            <p className="text-[10px] leading-snug text-red-400">{publishFeedback}</p>
          ) : null}
          <p className="text-[10px] leading-snug text-zinc-500">
            Les visiteurs chargent la carte depuis PostgreSQL (fusion avec le JSON
            par défaut dans le build). Chaque modification est enregistrée
            automatiquement ; « Publier » force une synchro immédiate si besoin.
          </p>
          </div>
        </div>
      )}
      </div>

      {placementMode && krpano && viewerContainerId && (
        <PlacementLayer
          krpano={krpano}
          containerId={viewerContainerId}
          isRepositioning={editingId != null}
          onPlace={(ath, atv) => addButtonAt(ath, atv)}
          onCancel={() => setPlacementMode(false)}
        />
      )}

    </>
  );
}

function PlacementLayer({
  krpano,
  containerId,
  isRepositioning,
  onPlace,
  onCancel,
}: {
  krpano: KrpanoViewer;
  containerId: string;
  /** true = déplacement d’un bouton existant (remplace la position). */
  isRepositioning: boolean;
  onPlace: (ath: number, atv: number) => void;
  onCancel: () => void;
}) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const host = document.getElementById(containerId);
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = krpano.screentosphere(x, y);
    if (!s || Number.isNaN(s.x) || Number.isNaN(s.y)) {
      return;
    }
    onPlace(s.x, s.y);
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-110 cursor-crosshair bg-black/40 backdrop-blur-[1px]"
      onClick={handleClick}
    >
      <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-center">
        <p className="rounded-full bg-zinc-900/90 px-4 py-2 text-sm text-zinc-100 shadow-lg">
          {isRepositioning
            ? "Cliquez sur le panorama pour replacer le bouton — Échap pour annuler"
            : "Cliquez sur l’objet dans le panorama — le bouton y restera ancré — Échap pour annuler"}
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        className="absolute bottom-8 left-1/2 z-95 -translate-x-1/2 rounded-full border border-white/20 bg-zinc-900 px-5 py-2 text-sm text-zinc-200 pointer-events-auto"
      >
        Annuler
      </button>
    </div>
  );
}

/**
 * Enveloppe la visite : viewer krpano + boutons par scène + éditeur.
 */
export function VisiteShell() {
  const [videoPlaybackBlocksIdle, setVideoPlaybackBlocksIdle] = useState(false);
  useIdleHomeRedirect(true, videoPlaybackBlocksIdle);
  const [sceneName, setSceneName] = useState(KRPANO_START_SCENE);
  /** false tant que krpano n’a pas fini le 1er blend (évite boutons avant le 1er panorama). */
  const [scenePanoReady, setScenePanoReady] = useState(false);
  /** true après le premier onblendcomplete — permet d’ignorer onnewscene initial et le timeout de secours pendant une transition. */
  const hasCompletedFirstBlendRef = useRef(false);
  const [map, setMap] = useState<SceneInteractionsMap>(() =>
    getDefaultInteractions(),
  );
  /** Après le premier chargement depuis l’API — évite d’écraser la base avant d’avoir la carte serveur. */
  const [interactionsHydrated, setInteractionsHydrated] = useState(false);
  const [krpano, setKrpano] = useState<KrpanoViewer | null>(null);
  const [viewerContainerId, setViewerContainerId] = useState<string | null>(
    null,
  );
  const [listHoverButtonId, setListHoverButtonId] = useState<string | null>(
    null,
  );
  const [pendingActivation, setPendingActivation] = useState<{
    sceneId: string;
    buttonId: string;
    nonce: number;
  } | null>(null);

  const handlePickEquipment = useCallback(
    (sceneId: string, buttonId: string) => {
      setPendingActivation({
        sceneId,
        buttonId,
        nonce: Date.now(),
      });
      if (sceneName.trim() !== sceneId.trim() && krpano) {
        loadKrpanoScene(krpano, sceneId);
      }
    },
    [sceneName, krpano],
  );

  const clearPendingActivation = useCallback(() => {
    setPendingActivation(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadSiteInteractions().then((m) => {
      if (cancelled) return;
      setMap(m);
      setInteractionsHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Sauvegarde automatique vers PostgreSQL à chaque changement de carte. */
  useEffect(() => {
    if (!interactionsHydrated) return;
    const t = window.setTimeout(() => {
      void postSceneInteractionsToServer(map).then((r) => {
        if (!r.ok) console.warn("[scene-interactions] auto-save:", r.error);
      });
    }, 800);
    return () => clearTimeout(t);
  }, [map, interactionsHydrated]);

  useEffect(() => {
    setListHoverButtonId(null);
  }, [sceneName]);

  /** Secours uniquement au premier chargement si onblendcomplete ne vient pas — jamais pendant un changement de scène. */
  useEffect(() => {
    if (!krpano || scenePanoReady) return;
    if (hasCompletedFirstBlendRef.current) return;
    const t = window.setTimeout(() => setScenePanoReady(true), 3500);
    return () => clearTimeout(t);
  }, [krpano, scenePanoReady]);

  const handleSceneTransitionStart = useCallback(() => {
    if (!hasCompletedFirstBlendRef.current) return;
    setScenePanoReady(false);
  }, []);

  const handleMapChange = useCallback((next: SceneInteractionsMap) => {
    setMap(next);
  }, []);

  /** Panneaux « Vue caméra » + « Interactions » : cachés par défaut, Ctrl+M pour afficher / masquer (Mac & Windows). */
  const [shellPanelsVisible, setShellPanelsVisible] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        setShellPanelsVisible((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /** Hotspots VR (scene-nav.json) — même logique que la dock React, mais rendu krpano en WebXR. */
  useEffect(() => {
    setReactVrUiCallbacks({
      dockPrev: () => {
        const id = dockNavSceneIdAfterDelta(sceneName, -1);
        if (id && krpano) loadKrpanoScene(krpano, id);
      },
      dockNext: () => {
        const id = dockNavSceneIdAfterDelta(sceneName, +1);
        if (id && krpano) loadKrpanoScene(krpano, id);
      },
    });
    return () => {
      setReactVrUiCallbacks({ dockPrev: undefined, dockNext: undefined });
    };
  }, [sceneName, krpano]);

  return (
    <div className="fixed inset-0">
      <Link
        href="/"
        className="pointer-events-auto fixed left-3 top-3 z-[85] block w-[min(48vw,9rem)] max-w-[10rem] outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/50 sm:left-4 sm:top-4 sm:w-[min(36vw,11rem)] sm:max-w-[11rem]"
        aria-label="Micronique — retour à l’accueil"
      >
        <img
          src="/images/global/micronique.webp"
          alt="Micronique"
          width={280}
          height={93}
          className="h-auto w-full object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]"
          decoding="async"
        />
      </Link>
      <KrpanoTour
        className="absolute inset-0 z-0 h-dvh min-h-dvh w-full max-w-full bg-black"
        onSceneTransitionStart={handleSceneTransitionStart}
        onSceneChange={(name) => {
          hasCompletedFirstBlendRef.current = true;
          setSceneName(name);
          setScenePanoReady(true);
        }}
        onViewerReady={({ krpano: k, containerId }) => {
          setKrpano(k);
          setViewerContainerId(containerId);
        }}
      />
      <EquipmentCatalogPanel
        map={map}
        krpano={krpano}
        onPickEquipment={handlePickEquipment}
        onNavigateToZone={(sceneId) => {
          if (krpano) loadKrpanoScene(krpano, sceneId);
        }}
      />
      <SceneInteractionOverlay
        sceneName={sceneName}
        map={map}
        krpano={krpano}
        viewerContainerId={viewerContainerId}
        scenePanoReady={scenePanoReady}
        highlightButtonId={listHoverButtonId}
        pendingActivation={pendingActivation}
        onPendingActivationConsumed={clearPendingActivation}
        onVideoPlaybackChange={setVideoPlaybackBlocksIdle}
      />
      <KrpanoViewHud
        krpano={krpano}
        sceneName={sceneName}
        visible={shellPanelsVisible}
      />
      <SceneNavBar krpano={krpano} currentSceneId={sceneName} />
      <InteractionEditor
        key={sceneName}
        sceneName={sceneName}
        map={map}
        onMapChange={handleMapChange}
        krpano={krpano}
        viewerContainerId={viewerContainerId}
        onSceneButtonListHover={setListHoverButtonId}
        shellPanelsVisible={shellPanelsVisible}
      />
    </div>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import {
  getKrpanoViewSnapshot,
  getKrpanoViewerHitRect,
  krpanoScreentosphereFromContainerClientPx,
} from "@/lib/krpanoNavigation";

import { interactionSvgLabel } from "@/components/icons/InteractionSvgIcons";
import { sceneNavbarBottomReservePaddingClass } from "@/constants/sceneNavbarLayout";
import {
  deleteHotspotInteractionFromServer,
  postSceneInteractionsToServer,
} from "@/lib/sceneInteractionsApi";
import {
  krpanoColorizeToPickerHex,
  pickerHexToKrpanoColorize,
} from "@/lib/krpanoHotspotColorize";
import { isMicroniquePresetUrl } from "@/lib/microniqueHotspotSvg";
import { resolveHotspotOxOyFromUrl } from "@/lib/krpanoHotspotTextureOxOy";
import { KRPANO_XML_HOTSPOT_PRESET_URLS } from "@/lib/krpanoXmlHotspotPresets";
import {
  getDefaultInteractions,
  getDefaultKrpanoNavigationHotspotStyle,
  getDefaultKrpanoXmlHotspotOverrides,
} from "@/lib/sceneInteractionsStorage";
import type { KrpanoViewer } from "@/types/krpanoViewer";
import type {
  InteractionSvgIconId,
  KrpanoNavigationHotspotStyle,
  KrpanoXmlHotspotMode,
  KrpanoXmlHotspotOverride,
  KrpanoXmlHotspotOverridesByScene,
  SceneInteractionsMap,
} from "@/types/interactions";

import tour from "@/data/tour.json";

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

type TourHotspot = (typeof tour.scenes)[number]["hotspots"][number];

export type HotspotXmlEditorProps = {
  sceneName: string;
  map: SceneInteractionsMap;
  krpano: KrpanoViewer | null;
  viewerContainerId: string | null;
  krpanoNavigationHotspotStyle?: KrpanoNavigationHotspotStyle;
  onKrpanoNavigationHotspotStyleChange: (next: KrpanoNavigationHotspotStyle) => void;
  krpanoXmlHotspotOverrides: KrpanoXmlHotspotOverridesByScene;
  onKrpanoXmlHotspotOverridesChange: (
    next: KrpanoXmlHotspotOverridesByScene,
  ) => void;
  shellPanelsVisible?: boolean;
  /** API PostgreSQL injoignable — pas de lecture/écriture en base. */
  dbUnavailable?: boolean;
};

function PlacementLayer({
  krpano,
  containerId,
  onPlace,
  onCancel,
}: {
  krpano: KrpanoViewer;
  containerId: string;
  onPlace: (ath: number, atv: number) => void;
  onCancel: () => void;
}) {
  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const rect = getKrpanoViewerHitRect(containerId);
    if (!rect) return;
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    if (
      rawX < 0 ||
      rawY < 0 ||
      rawX > rect.width ||
      rawY > rect.height
    ) {
      return;
    }
    const s = krpanoScreentosphereFromContainerClientPx(
      krpano,
      rect,
      e.clientX,
      e.clientY,
    );
    if (!s || Number.isNaN(s.x) || Number.isNaN(s.y)) return;
    onPlace(s.x, s.y);
  };

  const layer = (
    <div
      role="presentation"
      className="pointer-events-auto fixed inset-0 z-[200] cursor-crosshair bg-black/40 backdrop-blur-[1px]"
      onPointerDown={handlePointerDown}
    >
      <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-center">
        <p className="rounded-full bg-zinc-900/90 px-4 py-2 text-sm text-zinc-100 shadow-lg">
          Cliquez sur le panorama pour positionner le hotspot — Échap pour annuler
        </p>
      </div>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        className="pointer-events-auto absolute bottom-8 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/20 bg-zinc-900 px-5 py-2 text-sm text-zinc-200"
      >
        Annuler
      </button>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(layer, document.body);
}

export function HotspotXmlEditor({
  sceneName,
  map,
  krpano,
  viewerContainerId,
  krpanoNavigationHotspotStyle,
  onKrpanoNavigationHotspotStyleChange,
  krpanoXmlHotspotOverrides,
  onKrpanoXmlHotspotOverridesChange,
  shellPanelsVisible = true,
  dbUnavailable = false,
}: HotspotXmlEditorProps) {
  const [open, setOpen] = useState(false);
  const [placementMode, setPlacementMode] = useState(false);
  /** Placement depuis l’onglet création vs édition des hotspots du tour. */
  const [placementTarget, setPlacementTarget] = useState<"new" | "edit">(
    "edit",
  );
  const [editorTab, setEditorTab] = useState<"create" | "edit">("create");
  const [createError, setCreateError] = useState<string | null>(null);

  /** Style navigation (hotspot_custom_style) : défaut JSON + snapshot chargé — utilisé comme fallback si un champ n’est pas renseigné. */
  const styleDefaults = useMemo(() => {
    const d = getDefaultKrpanoNavigationHotspotStyle() ?? {};
    const s = krpanoNavigationHotspotStyle ?? {};
    const url =
      (typeof s.url === "string" && s.url.trim()) ||
      (typeof d.url === "string" && d.url.trim()) ||
      "krpano-patches/hotspot.svg";
    const oy =
      typeof s.oy === "number" && Number.isFinite(s.oy)
        ? s.oy
        : typeof d.oy === "number" && Number.isFinite(d.oy)
          ? d.oy
          : 30;
    const scale =
      typeof s.scale === "number" && Number.isFinite(s.scale)
        ? s.scale
        : typeof d.scale === "number" && Number.isFinite(d.scale)
          ? d.scale
          : 0.5;
    const edge =
      (typeof s.edge === "string" && s.edge.trim()) ||
      (typeof d.edge === "string" && d.edge.trim()) ||
      "top";
    const zorder =
      typeof s.zorder === "number" && Number.isFinite(s.zorder)
        ? s.zorder
        : typeof d.zorder === "number" && Number.isFinite(d.zorder)
          ? d.zorder
          : 500;
    return { url, oy, scale, edge, zorder };
  }, [krpanoNavigationHotspotStyle]);

  const sceneHotspots = useMemo((): TourHotspot[] => {
    const s = tour.scenes.find((x) => x.id === sceneName);
    return s?.hotspots ?? [];
  }, [sceneName]);

  const sceneHotspotNamesFromTour = useMemo(
    () => new Set(sceneHotspots.map((h) => h.name)),
    [sceneHotspots],
  );

  /** Scènes du tour (pour la navigation au clic). */
  const allTourScenes = useMemo(
    () =>
      tour.scenes.map((s) => ({
        id: s.id,
        title: typeof s.title === "string" && s.title.trim() ? s.title : s.id,
      })),
    [],
  );

  /**
   * Liste d’édition = seulement les hotspots persistés en base (HotspotInteraction),
   * comme dans l’API GET (`krpanoXmlHotspotOverrides` construit via buildHotspotOverridesFromDb).
   * Si la base est injoignable, on ne propose pas de liste (pas de mélange avec le tour.xml).
   */
  const allEditNames = useMemo(() => {
    if (dbUnavailable) return [] as string[];
    const m = krpanoXmlHotspotOverrides[sceneName];
    if (!m || typeof m !== "object") return [];
    return Object.keys(m).sort((a, b) => a.localeCompare(b));
  }, [dbUnavailable, krpanoXmlHotspotOverrides, sceneName]);

  const [selectedName, setSelectedName] = useState<string>("");

  /** Onglet Modifier : aucune présélection — choix explicite dans la liste. */
  useEffect(() => {
    if (editorTab === "edit") {
      setSelectedName("");
    }
  }, [editorTab]);

  useEffect(() => {
    if (allEditNames.length === 0) {
      setSelectedName("");
      return;
    }
    if (editorTab === "edit") {
      if (selectedName && !allEditNames.includes(selectedName)) {
        setSelectedName("");
      }
      return;
    }
    if (!selectedName || !allEditNames.includes(selectedName)) {
      setSelectedName(allEditNames[0]!);
    }
  }, [allEditNames, selectedName, editorTab]);

  const selectedMeta = useMemo((): TourHotspot | undefined => {
    const fromTour = sceneHotspots.find((h) => h.name === selectedName);
    if (fromTour) return fromTour;
    const o =
      selectedName && krpanoXmlHotspotOverrides[sceneName]?.[selectedName];
    if (!o) return undefined;
    return {
      id: `dyn_${selectedName}`,
      name: selectedName,
      ath: typeof o.ath === "number" ? o.ath : 0,
      atv: typeof o.atv === "number" ? o.atv : 0,
      targetSceneId: null,
    };
  }, [sceneHotspots, selectedName, krpanoXmlHotspotOverrides, sceneName]);

  const currentOverride: KrpanoXmlHotspotOverride = useMemo(() => {
    if (!selectedName) return {};
    return krpanoXmlHotspotOverrides[sceneName]?.[selectedName] ?? {};
  }, [krpanoXmlHotspotOverrides, sceneName, selectedName]);

  const [localUrl, setLocalUrl] = useState("");
  const [localScale, setLocalScale] = useState("");
  const [localRotate, setLocalRotate] = useState("");
  const [localEdge, setLocalEdge] = useState("");
  const [localZ, setLocalZ] = useState("");
  const [localOnover, setLocalOnover] = useState("");
  const [localOnout, setLocalOnout] = useState("");
  const [localHotspotMode, setLocalHotspotMode] =
    useState<KrpanoXmlHotspotMode>("interaction");
  const [localNavTargetSceneId, setLocalNavTargetSceneId] = useState("");
  const [localOnclick, setLocalOnclick] = useState("");
  const [localColorize, setLocalColorize] = useState("");
  const [localIconBg, setLocalIconBg] = useState("");
  const [localIconFg, setLocalIconFg] = useState("");

  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newScale, setNewScale] = useState("");
  const [newRotate, setNewRotate] = useState("");
  const [newEdge, setNewEdge] = useState("");
  const [newZ, setNewZ] = useState("");
  const [newOnover, setNewOnover] = useState("");
  const [newOnout, setNewOnout] = useState("");
  const [newOnclick, setNewOnclick] = useState("");
  const [newHotspotMode, setNewHotspotMode] =
    useState<KrpanoXmlHotspotMode>("interaction");
  const [newNavTargetSceneId, setNewNavTargetSceneId] = useState("");
  const [newColorize, setNewColorize] = useState("");
  const [newIconBg, setNewIconBg] = useState("");
  const [newIconFg, setNewIconFg] = useState("");

  useEffect(() => {
    setPlacementMode(false);
  }, [editorTab]);

  useEffect(() => {
    const o = currentOverride;
    setLocalUrl(o.url ?? "");
    setLocalScale(o.scale != null ? String(o.scale) : "");
    setLocalRotate(o.rotateDeg != null ? String(o.rotateDeg) : "");
    setLocalEdge(o.edge ?? "");
    setLocalZ(o.zorder != null ? String(o.zorder) : "");
    setLocalOnover(o.onover ?? "");
    setLocalOnout(o.onout ?? "");
    setLocalOnclick(o.onclick ?? "");
    setLocalHotspotMode(
      o.hotspotMode ??
        (o.navigationTargetSceneId?.trim() ? "navigation" : "interaction"),
    );
    setLocalNavTargetSceneId(o.navigationTargetSceneId ?? "");
    setLocalColorize(krpanoColorizeToPickerHex(o.colorize));
    setLocalIconBg(
      o.iconBgColor ? krpanoColorizeToPickerHex(o.iconBgColor) : "",
    );
    setLocalIconFg(
      o.iconFgColor ? krpanoColorizeToPickerHex(o.iconFgColor) : "",
    );
  }, [currentOverride, selectedName, sceneName]);

  const presetActive = useCallback(
    (id: InteractionSvgIconId): boolean => {
      const u = KRPANO_XML_HOTSPOT_PRESET_URLS[id];
      const effective = (localUrl || "").trim() || styleDefaults.url;
      return effective === u;
    },
    [localUrl, styleDefaults.url],
  );

  /** POST immédiat (hors debounce VisiteShell) pour affichage + base à jour tout de suite. */
  const persistDocument = useCallback(
    (nextOverrides: KrpanoXmlHotspotOverridesByScene) => {
      if (dbUnavailable) return;
      void postSceneInteractionsToServer(
        map,
        krpanoNavigationHotspotStyle ?? {},
        nextOverrides,
      ).then((r) => {
        if (!r.ok) console.warn("[hotspot] persist", r.error, r.details ?? "");
      });
    },
    [dbUnavailable, map, krpanoNavigationHotspotStyle],
  );

  const patchSceneHotspot = useCallback(
    (
      patch: Partial<KrpanoXmlHotspotOverride>,
      opts?: { clearMicroniqueIconColors?: boolean },
    ) => {
      if (!selectedName) return;
      const prev = krpanoXmlHotspotOverrides[sceneName]?.[selectedName] ?? {};
      const merged: KrpanoXmlHotspotOverride = { ...prev, ...patch };
      if (opts?.clearMicroniqueIconColors) {
        delete merged.iconBgColor;
        delete merged.iconFgColor;
      }
      if (merged.hotspotMode === "navigation") {
        delete merged.onclick;
      }
      if (merged.hotspotMode === "interaction") {
        delete merged.navigationTargetSceneId;
      }
      const next: KrpanoXmlHotspotOverridesByScene = {
        ...krpanoXmlHotspotOverrides,
        [sceneName]: {
          ...(krpanoXmlHotspotOverrides[sceneName] ?? {}),
          [selectedName]: merged,
        },
      };
      onKrpanoXmlHotspotOverridesChange(next);
      persistDocument(next);
    },
    [
      krpanoXmlHotspotOverrides,
      onKrpanoXmlHotspotOverridesChange,
      persistDocument,
      sceneName,
      selectedName,
    ],
  );

  /** ox / oy = moitié largeur / hauteur de la texture (centrage). */
  const patchSceneHotspotWithComputedOxOy = useCallback(
    async (patch: Partial<KrpanoXmlHotspotOverride>) => {
      if (!selectedName) return;
      const prev = krpanoXmlHotspotOverrides[sceneName]?.[selectedName] ?? {};
      const merged: KrpanoXmlHotspotOverride = { ...prev, ...patch };
      const url = merged.url?.trim() || styleDefaults.url;
      const { ox, oy } = await resolveHotspotOxOyFromUrl(url);
      patchSceneHotspot({ ...patch, ox, oy });
    },
    [
      selectedName,
      krpanoXmlHotspotOverrides,
      sceneName,
      styleDefaults.url,
      patchSceneHotspot,
    ],
  );

  const applyLocalFieldsToPatch = useCallback(async () => {
    const num = (s: string) => {
      const t = s.trim();
      if (t === "") return undefined;
      const n = parseFloat(t);
      return Number.isFinite(n) ? n : undefined;
    };
    const url = localUrl.trim() || styleDefaults.url;
    const { ox, oy } = await resolveHotspotOxOyFromUrl(url);
    const micronique = isMicroniquePresetUrl(url);
    const dualMicronique =
      micronique &&
      localIconBg.trim() !== "" &&
      localIconFg.trim() !== "";
    const base: Partial<KrpanoXmlHotspotOverride> = {
      url: localUrl.trim() || undefined,
      scale: num(localScale),
      ox,
      oy,
      rotateDeg: num(localRotate),
      edge: localEdge.trim() || undefined,
      zorder: num(localZ) != null ? Math.round(num(localZ)!) : undefined,
      onover: localOnover.trim() || undefined,
      onout: localOnout.trim() || undefined,
      hotspotMode: localHotspotMode,
      navigationTargetSceneId:
        localHotspotMode === "navigation"
          ? localNavTargetSceneId.trim() || undefined
          : undefined,
      onclick:
        localHotspotMode === "interaction"
          ? localOnclick.trim() || undefined
          : undefined,
    };
    if (dualMicronique) {
      patchSceneHotspot({
        ...base,
        iconBgColor: pickerHexToKrpanoColorize(localIconBg.trim()),
        iconFgColor: pickerHexToKrpanoColorize(localIconFg.trim()),
        colorize: "0xffffff",
      });
    } else {
      patchSceneHotspot(
        {
          ...base,
          colorize: pickerHexToKrpanoColorize(localColorize.trim() || "#ffffff"),
        },
        { clearMicroniqueIconColors: true },
      );
    }
  }, [
    localColorize,
    localEdge,
    localHotspotMode,
    localIconBg,
    localIconFg,
    localNavTargetSceneId,
    localOnclick,
    localOnout,
    localOnover,
    localRotate,
    localScale,
    localUrl,
    localZ,
    patchSceneHotspot,
    styleDefaults.url,
  ]);

  const clearHotspotOverride = useCallback(() => {
    if (!selectedName) return;
    const hm = { ...(krpanoXmlHotspotOverrides[sceneName] ?? {}) };
    delete hm[selectedName];
    const next = { ...krpanoXmlHotspotOverrides };
    if (Object.keys(hm).length === 0) delete next[sceneName];
    else next[sceneName] = hm;
    onKrpanoXmlHotspotOverridesChange(next);
    if (!dbUnavailable) {
      void deleteHotspotInteractionFromServer(sceneName, selectedName).then(
        (r) => {
          if (!r.ok) {
            console.warn("[hotspot] suppression base", r.error);
          }
        },
      );
    }
  }, [
    dbUnavailable,
    krpanoXmlHotspotOverrides,
    onKrpanoXmlHotspotOverridesChange,
    sceneName,
    selectedName,
  ]);

  const newPresetActive = useCallback(
    (id: InteractionSvgIconId): boolean => {
      const u = KRPANO_XML_HOTSPOT_PRESET_URLS[id];
      const effective = (newUrl || "").trim() || styleDefaults.url;
      return effective === u;
    },
    [newUrl, styleDefaults.url],
  );

  const commitNewHotspot = useCallback(
    async (coords?: { ath: number; atv: number }) => {
      const n = newName.trim();
      setCreateError(null);
      if (!n) {
        setCreateError("Indiquez un nom pour le hotspot.");
        return;
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(n)) {
        setCreateError(
          "Nom invalide : lettres, chiffres et _ (ex. MonSpot_1).",
        );
        return;
      }
      if (allEditNames.includes(n)) {
        setCreateError("Un hotspot avec ce nom existe déjà sur cette scène.");
        return;
      }
      const num = (s: string) => {
        const t = s.trim();
        if (t === "") return undefined;
        const v = parseFloat(t);
        return Number.isFinite(v) ? v : undefined;
      };
      let ath: number | undefined;
      let atv: number | undefined;
      if (coords) {
        ath = coords.ath;
        atv = coords.atv;
      } else {
        const snap = krpano ? getKrpanoViewSnapshot(krpano) : null;
        ath = snap?.hlookat;
        atv = snap?.vlookat;
      }
      if (ath === undefined || atv === undefined) {
        setCreateError(
          "Position indisponible : utilisez « Placer sur la scène » ou attendez le chargement du panorama.",
        );
        return;
      }
      if (newHotspotMode === "navigation" && !newNavTargetSceneId.trim()) {
        setCreateError(
          "Choisissez la scène de destination pour la navigation.",
        );
        return;
      }
      const textureUrl = newUrl.trim() || styleDefaults.url;
      const { ox, oy } = await resolveHotspotOxOyFromUrl(textureUrl);
      const z = num(newZ);
      const dualNew =
        isMicroniquePresetUrl(textureUrl) &&
        newIconBg.trim() !== "" &&
        newIconFg.trim() !== "";
      const nextEntry: KrpanoXmlHotspotOverride = {
        hotspotMode: newHotspotMode,
        navigationTargetSceneId:
          newHotspotMode === "navigation"
            ? newNavTargetSceneId.trim()
            : undefined,
        url: textureUrl,
        scale: num(newScale) ?? styleDefaults.scale,
        ox,
        oy,
        rotateDeg: num(newRotate),
        ath,
        atv,
        edge: newEdge.trim() || styleDefaults.edge,
        zorder: z != null ? Math.round(z) : styleDefaults.zorder,
        onover: newOnover.trim() || undefined,
        onout: newOnout.trim() || undefined,
        onclick:
          newHotspotMode === "interaction"
            ? newOnclick.trim() || undefined
            : undefined,
        ...(dualNew
          ? {
              iconBgColor: pickerHexToKrpanoColorize(newIconBg.trim()),
              iconFgColor: pickerHexToKrpanoColorize(newIconFg.trim()),
              colorize: "0xffffff" as const,
            }
          : {
              colorize: pickerHexToKrpanoColorize(newColorize.trim() || "#ffffff"),
            }),
      };
      const next: KrpanoXmlHotspotOverridesByScene = {
        ...krpanoXmlHotspotOverrides,
        [sceneName]: {
          ...(krpanoXmlHotspotOverrides[sceneName] ?? {}),
          [n]: nextEntry,
        },
      };
      onKrpanoXmlHotspotOverridesChange(next);
      persistDocument(next);
      setSelectedName(n);
      setEditorTab("edit");
      setNewName("");
      setNewUrl("");
      setNewScale("");
      setNewRotate("");
      setNewEdge("");
      setNewZ("");
      setNewOnover("");
      setNewOnout("");
      setNewOnclick("");
      setNewHotspotMode("interaction");
      setNewNavTargetSceneId("");
      setNewColorize("");
      setNewIconBg("");
      setNewIconFg("");
    },
    [
      allEditNames,
      krpano,
      styleDefaults,
      krpanoXmlHotspotOverrides,
      newColorize,
      newIconBg,
      newIconFg,
      newEdge,
      newHotspotMode,
      newName,
      newNavTargetSceneId,
      newOnclick,
      newOnout,
      newOnover,
      newRotate,
      newScale,
      newUrl,
      newZ,
      onKrpanoXmlHotspotOverridesChange,
      persistDocument,
      sceneName,
    ],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlacementMode(false);
    };
    if (placementMode) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placementMode]);

  const editTextureUrlForMicronique = useMemo(
    () => (localUrl || "").trim() || styleDefaults.url,
    [localUrl, styleDefaults.url],
  );
  const editIsMicronique = isMicroniquePresetUrl(editTextureUrlForMicronique);
  const editDualIconActive =
    editIsMicronique &&
    localIconBg.trim() !== "" &&
    localIconFg.trim() !== "";

  const createTextureUrlForMicronique = useMemo(
    () => (newUrl || "").trim() || styleDefaults.url,
    [newUrl, styleDefaults.url],
  );
  const createIsMicronique = isMicroniquePresetUrl(createTextureUrlForMicronique);
  const createDualIconActive =
    createIsMicronique &&
    newIconBg.trim() !== "" &&
    newIconFg.trim() !== "";

  if (!shellPanelsVisible) return null;

  return (
    <>
      <div
        className={`fixed right-4 bottom-0 z-100 flex flex-col-reverse gap-2 pointer-events-none items-end ${sceneNavbarBottomReservePaddingClass}`}
      >
        {!placementMode && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/15 bg-zinc-900/90 px-4 py-2.5 text-sm font-medium text-zinc-100 shadow-lg backdrop-blur-md transition hover:bg-zinc-800/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            aria-expanded={open ? "true" : "false"}
          >
            <span
              className="inline-block size-2 rounded-full bg-sky-400"
              aria-hidden
            />
            Hotspots XML
          </button>
        )}

        {open && !placementMode ? (
      <div
        className="pointer-events-auto flex max-h-[min(40rem,calc(100dvh-7rem))] w-[min(100vw-2rem,30rem)] flex-col overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950/98 text-zinc-100 shadow-2xl backdrop-blur-md [-webkit-overflow-scrolling:touch]"
      >
        {/* Onglets type navigateur : en premier, reliés au fond du panneau */}
        <div
          className="flex shrink-0 items-end gap-0.5 border-b border-zinc-700/90 bg-zinc-900 px-2 pt-2"
          role="tablist"
          aria-label="Hotspots — ajouter ou modifier"
        >
          <button
            type="button"
            role="tab"
            id="hotspot-tab-create"
            aria-selected={editorTab === "create"}
            aria-controls="hotspot-tabpanel"
            title="Créer un nouveau hotspot sur cette scène"
            className={`min-h-[2.5rem] min-w-0 flex-1 truncate rounded-t-lg border px-3 py-2 text-left text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
              editorTab === "create"
                ? "relative z-[1] -mb-px border border-b-0 border-zinc-600/90 bg-zinc-950 text-zinc-100 shadow-[0_-1px_0_0_rgba(24,24,27,0.9)]"
                : "border border-transparent border-b-0 bg-zinc-800/55 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            }`}
            onClick={() => setEditorTab("create")}
          >
            Ajouter
          </button>
          <button
            type="button"
            role="tab"
            id="hotspot-tab-edit"
            aria-selected={editorTab === "edit"}
            aria-controls="hotspot-tabpanel"
            title="Modifier les hotspots déjà présents sur cette scène"
            className={`min-h-[2.5rem] min-w-0 flex-1 truncate rounded-t-lg border px-3 py-2 text-left text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
              editorTab === "edit"
                ? "relative z-[1] -mb-px border border-b-0 border-zinc-600/90 bg-zinc-950 text-zinc-100 shadow-[0_-1px_0_0_rgba(24,24,27,0.9)]"
                : "border border-transparent border-b-0 bg-zinc-800/55 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            }`}
            onClick={() => setEditorTab("edit")}
          >
            Modifier
          </button>
        </div>

        <div className="shrink-0 border-b border-zinc-800/90 bg-zinc-950 px-3.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Scène active
          </p>
          <p className="truncate font-mono text-sm text-sky-300">{sceneName}</p>
        </div>

        {dbUnavailable ? (
          <div className="border-b border-amber-800/80 bg-amber-950/50 px-3.5 py-2 text-[11px] leading-snug text-amber-100">
            <strong className="font-semibold">Base PostgreSQL injoignable.</strong> Les
            hotspots visibles viennent du <code className="text-amber-200/90">tour.xml</code>{" "}
            ; rien ne sera enregistré tant que{" "}
            <code className="text-amber-200/90">DATABASE_URL</code> est joignable depuis le
            serveur Next (pare-feu, SSL, VPN). Vérifiez les logs du terminal{" "}
            <code className="text-amber-200/90">npm run dev</code>.
          </div>
        ) : null}

        <div
          id="hotspot-tabpanel"
          role="tabpanel"
          aria-labelledby={
            editorTab === "create" ? "hotspot-tab-create" : "hotspot-tab-edit"
          }
          className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3 space-y-4"
        >
          {editorTab === "create" ? (
          <EditorSection
            title="Créer un hotspot (hors tour.xml)"
            description="Nom unique pour la scène. Le hotspot est ajouté en runtime (addhotspot) puis enregistré dans le JSON. Champs vides : à l’enregistrement, les valeurs du style navigation (défaut embarqué / snapshot) sont appliquées pour texture, scale, edge et zorder. Les décalages ox/oy sont calculés automatiquement (moitié de la largeur / hauteur de la texture)."
          >
            <label className="block text-[11px] text-zinc-400">Nom krpano</label>
            <input
              className={`${fieldClass} font-mono`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="ex. MonSpot_info"
              autoComplete="off"
            />
            <p className="text-[10px] text-zinc-500">
              Lettres, chiffres et underscore ; doit être unique sur cette scène.
            </p>

            <p className="text-[10px] font-medium text-zinc-400">
              Icônes Micronique
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(
                Object.keys(KRPANO_XML_HOTSPOT_PRESET_URLS) as InteractionSvgIconId[]
              ).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    const u = KRPANO_XML_HOTSPOT_PRESET_URLS[id];
                    setNewUrl(u);
                  }}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${pillClass(newPresetActive(id))}`}
                >
                  {interactionSvgLabel(id)}
                </button>
              ))}
            </div>

            <label className="block text-[11px] text-zinc-400">URL texture</label>
            <input
              className={fieldClass}
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder={styleDefaults.url}
            />

            {createIsMicronique ? (
              <div className="rounded-lg border border-sky-900/50 bg-sky-950/20 p-2.5">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-sky-400/90">
                  Couleurs · icônes Micronique
                </p>
                <p className="mb-2 text-[10px] leading-relaxed text-zinc-500">
                  Renseignez les deux pour un fond et un pictogramme indépendants. Sinon
                  utilisez la teinte globale ci-dessous (une seule couleur sur toute la
                  texture).
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] text-zinc-400">Fond du bouton</label>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <input
                        type="color"
                        className="h-10 w-[4.5rem] shrink-0 cursor-pointer rounded border border-zinc-600 bg-zinc-950 p-1"
                        value={krpanoColorizeToPickerHex(
                          pickerHexToKrpanoColorize(
                            newIconBg.trim() || "#ffffff",
                          ),
                        )}
                        onChange={(e) => setNewIconBg(e.target.value)}
                        title="Fond du disque"
                      />
                      <input
                        className={`${fieldClass} min-w-0 flex-1 font-mono text-xs`}
                        value={newIconBg}
                        onChange={(e) => setNewIconBg(e.target.value)}
                        placeholder="#ffffff"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400">
                      Pictogramme (trait / icône)
                    </label>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <input
                        type="color"
                        className="h-10 w-[4.5rem] shrink-0 cursor-pointer rounded border border-zinc-600 bg-zinc-950 p-1"
                        value={krpanoColorizeToPickerHex(
                          pickerHexToKrpanoColorize(
                            newIconFg.trim() || "#0f172a",
                          ),
                        )}
                        onChange={(e) => setNewIconFg(e.target.value)}
                        title="Couleur du glyphe"
                      />
                      <input
                        className={`${fieldClass} min-w-0 flex-1 font-mono text-xs`}
                        value={newIconFg}
                        onChange={(e) => setNewIconFg(e.target.value)}
                        placeholder="#0f172a"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {!createDualIconActive ? (
              <div className="rounded-lg border border-sky-900/50 bg-sky-950/20 p-2.5">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-sky-400/90">
                  {createIsMicronique
                    ? "Teinte globale (fichier)"
                    : "Couleur · teinte de l’icône"}
                </p>
                <label className="block text-[11px] text-zinc-400">
                  Teinte (krpano <span className="font-mono text-zinc-500">colorize</span>)
                </label>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <input
                    type="color"
                    className="h-10 w-[4.5rem] shrink-0 cursor-pointer rounded border border-zinc-600 bg-zinc-950 p-1"
                    value={krpanoColorizeToPickerHex(
                      pickerHexToKrpanoColorize(newColorize.trim() || "#ffffff"),
                    )}
                    onChange={(e) => setNewColorize(e.target.value)}
                    title="Teinte multiplicative sur toute la texture"
                  />
                  <input
                    className={`${fieldClass} min-w-0 flex-1 font-mono text-xs`}
                    value={newColorize}
                    onChange={(e) => setNewColorize(e.target.value)}
                    placeholder="#ffffff ou 0xffffff — neutre"
                    spellCheck={false}
                  />
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-500">
                  {createIsMicronique
                    ? "Utilisée si les deux champs « fond / pictogramme » ne sont pas tous les deux renseignés."
                    : "Blanc = couleurs d’origine du fichier. Sinon la teinte s’applique à l’image entière (SVG / PNG)."}
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-zinc-400">scale</label>
                <input
                  className={fieldClass}
                  value={newScale}
                  onChange={(e) => setNewScale(e.target.value)}
                  placeholder={String(styleDefaults.scale)}
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400">rotate (°)</label>
                <input
                  className={fieldClass}
                  value={newRotate}
                  onChange={(e) => setNewRotate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-zinc-400">edge</label>
                <input
                  className={fieldClass}
                  value={newEdge}
                  onChange={(e) => setNewEdge(e.target.value)}
                  placeholder={styleDefaults.edge}
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400">zorder</label>
                <input
                  className={fieldClass}
                  value={newZ}
                  onChange={(e) => setNewZ(e.target.value)}
                  placeholder={String(styleDefaults.zorder)}
                />
              </div>
            </div>

            <label className="block text-[11px] text-zinc-400">
              Fonction au clic
            </label>
            <select
              className={fieldClass}
              value={newHotspotMode}
              onChange={(e) =>
                setNewHotspotMode(e.target.value as KrpanoXmlHotspotMode)
              }
            >
              <option value="interaction">Interaction</option>
              <option value="navigation">Navigation</option>
            </select>
            {newHotspotMode === "navigation" ? (
              <div>
                <label className="mt-2 block text-[11px] text-zinc-400">
                  Scène de destination
                </label>
                <select
                  className={fieldClass}
                  value={newNavTargetSceneId}
                  onChange={(e) => setNewNavTargetSceneId(e.target.value)}
                >
                  <option value="">— Choisir une scène —</option>
                  {allTourScenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.id})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] leading-relaxed text-zinc-500">
                  Contenu et comportement détaillés : à définir ultérieurement.
                  Vous pouvez déjà renseigner une action krpano brute (optionnel).
                </p>
                <label className="block text-[11px] text-zinc-400">
                  Action krpano (optionnel)
                </label>
                <textarea
                  className={`${fieldClass} min-h-[52px] font-mono text-[11px]`}
                  value={newOnclick}
                  onChange={(e) => setNewOnclick(e.target.value)}
                  placeholder="ex. trace(hotspot);"
                />
              </div>
            )}

            <button
              type="button"
              className="w-full rounded-lg border border-sky-600/60 bg-sky-950/40 py-2 text-sm text-sky-100 hover:bg-sky-900/50 disabled:opacity-40"
              disabled={!krpano || !viewerContainerId || !newName.trim()}
              onClick={() => {
                setPlacementTarget("new");
                setPlacementMode(true);
              }}
            >
              Placer sur la scène (clic)
            </button>

            <label className="block text-[11px] text-zinc-400">onover</label>
            <textarea
              className={`${fieldClass} min-h-[52px] font-mono text-[11px]`}
              value={newOnover}
              onChange={(e) => setNewOnover(e.target.value)}
            />
            <label className="block text-[11px] text-zinc-400">onout</label>
            <textarea
              className={`${fieldClass} min-h-[52px] font-mono text-[11px]`}
              value={newOnout}
              onChange={(e) => setNewOnout(e.target.value)}
            />

            {createError ? (
              <p className="text-[11px] text-red-400">{createError}</p>
            ) : null}

            <button
              type="button"
              className="w-full rounded-lg border border-emerald-700/70 bg-emerald-950/40 py-2.5 text-sm font-medium text-emerald-100 hover:bg-emerald-900/45"
              onClick={() => void commitNewHotspot()}
            >
              Ajouter à la scène
            </button>
          </EditorSection>
          ) : (
          <EditorSection
            title="Hotspots du tour sur cette scène"
            description="Liste des hotspots enregistrés en base (HotspotInteraction) pour cette scène. Choisissez-en un pour modifier les réglages."
          >
            {allEditNames.length === 0 ? (
              <p className="text-xs text-zinc-500">
                {dbUnavailable
                  ? "Impossible de charger la liste : base PostgreSQL indisponible."
                  : "Aucun hotspot enregistré en base pour cette scène. Utilisez l’onglet Ajouter pour en créer un."}
              </p>
            ) : (
              <>
                <label className="block text-[11px] text-zinc-400">Hotspot</label>
                <select
                  className={fieldClass}
                  value={selectedName}
                  onChange={(e) => setSelectedName(e.target.value)}
                >
                  <option value="">
                    — Choisir un hotspot —
                  </option>
                  {allEditNames.map((name) => {
                    const h = sceneHotspots.find((x) => x.name === name);
                    const suffix = h?.targetSceneId
                      ? ` → ${h.targetSceneId}`
                      : h
                        ? " (info / sans lien)"
                        : " (créé, hors XML)";
                    return (
                      <option key={name} value={name}>
                        {name}
                        {suffix}
                      </option>
                    );
                  })}
                </select>

                {!selectedName ? (
                  <p className="rounded-lg border border-zinc-700/80 bg-zinc-900/60 px-3 py-2.5 text-[12px] leading-relaxed text-zinc-400">
                    Sélectionnez un hotspot dans la liste ci-dessus pour afficher les
                    options (icône, texture, actions krpano, etc.).
                  </p>
                ) : (
                  <>
                {selectedMeta ? (
                  <p className="text-[10px] text-zinc-500">
                    {sceneHotspotNamesFromTour.has(selectedName) ? (
                      <>
                        XML : ath {selectedMeta.ath.toFixed(2)}°, atv{" "}
                        {selectedMeta.atv.toFixed(2)}°
                      </>
                    ) : (
                      <>
                        JSON / runtime : ath {selectedMeta.ath.toFixed(2)}°, atv{" "}
                        {selectedMeta.atv.toFixed(2)}°
                      </>
                    )}
                  </p>
                ) : null}

                <p className="text-[10px] font-medium text-zinc-400">
                  Icônes Micronique
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    Object.keys(KRPANO_XML_HOTSPOT_PRESET_URLS) as InteractionSvgIconId[]
                  ).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        const u = KRPANO_XML_HOTSPOT_PRESET_URLS[id];
                        setLocalUrl(u);
                        void patchSceneHotspotWithComputedOxOy({ url: u });
                      }}
                      className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${pillClass(presetActive(id))}`}
                    >
                      {interactionSvgLabel(id)}
                    </button>
                  ))}
                </div>

                <label className="block text-[11px] text-zinc-400">
                  URL texture (perso.)
                </label>
                <input
                  className={fieldClass}
                  value={localUrl}
                  onChange={(e) => setLocalUrl(e.target.value)}
                  onBlur={() => void applyLocalFieldsToPatch()}
                  placeholder={styleDefaults.url}
                />

                {editIsMicronique ? (
                  <div className="rounded-lg border border-sky-900/50 bg-sky-950/20 p-2.5">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-sky-400/90">
                      Couleurs · icônes Micronique
                    </p>
                    <p className="mb-2 text-[10px] leading-relaxed text-zinc-500">
                      Renseignez les deux pour régler le fond et le pictogramme séparément.
                      Sinon la teinte globale ci-dessous s’applique au fichier SVG (une seule
                      couleur sur toute la texture).
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] text-zinc-400">
                          Fond du bouton
                        </label>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <input
                            type="color"
                            className="h-10 w-[4.5rem] shrink-0 cursor-pointer rounded border border-zinc-600 bg-zinc-950 p-1"
                            value={krpanoColorizeToPickerHex(
                              pickerHexToKrpanoColorize(
                                localIconBg.trim() || "#ffffff",
                              ),
                            )}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLocalIconBg(v);
                              const fg = localIconFg.trim();
                              if (fg !== "") {
                                patchSceneHotspot({
                                  iconBgColor: pickerHexToKrpanoColorize(v),
                                  iconFgColor: pickerHexToKrpanoColorize(fg),
                                  colorize: "0xffffff",
                                });
                              }
                            }}
                            title="Fond du disque"
                          />
                          <input
                            className={`${fieldClass} min-w-0 flex-1 font-mono text-xs`}
                            value={localIconBg}
                            onChange={(e) => setLocalIconBg(e.target.value)}
                            onBlur={() => void applyLocalFieldsToPatch()}
                            placeholder="#ffffff"
                            spellCheck={false}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] text-zinc-400">
                          Pictogramme (trait / icône)
                        </label>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <input
                            type="color"
                            className="h-10 w-[4.5rem] shrink-0 cursor-pointer rounded border border-zinc-600 bg-zinc-950 p-1"
                            value={krpanoColorizeToPickerHex(
                              pickerHexToKrpanoColorize(
                                localIconFg.trim() || "#0f172a",
                              ),
                            )}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLocalIconFg(v);
                              const bg = localIconBg.trim();
                              if (bg !== "") {
                                patchSceneHotspot({
                                  iconBgColor: pickerHexToKrpanoColorize(bg),
                                  iconFgColor: pickerHexToKrpanoColorize(v),
                                  colorize: "0xffffff",
                                });
                              }
                            }}
                            title="Couleur du glyphe"
                          />
                          <input
                            className={`${fieldClass} min-w-0 flex-1 font-mono text-xs`}
                            value={localIconFg}
                            onChange={(e) => setLocalIconFg(e.target.value)}
                            onBlur={() => void applyLocalFieldsToPatch()}
                            placeholder="#0f172a"
                            spellCheck={false}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {!editDualIconActive ? (
                  <div className="rounded-lg border border-sky-900/50 bg-sky-950/20 p-2.5">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-sky-400/90">
                      {editIsMicronique
                        ? "Teinte globale (fichier)"
                        : "Couleur · teinte de l’icône"}
                    </p>
                    <label className="block text-[11px] text-zinc-400">
                      Teinte (krpano{" "}
                      <span className="font-mono text-zinc-500">colorize</span>)
                    </label>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <input
                        type="color"
                        className="h-10 w-[4.5rem] shrink-0 cursor-pointer rounded border border-zinc-600 bg-zinc-950 p-1"
                        value={krpanoColorizeToPickerHex(
                          pickerHexToKrpanoColorize(
                            localColorize.trim() || "#ffffff",
                          ),
                        )}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLocalColorize(v);
                          patchSceneHotspot(
                            {
                              colorize: pickerHexToKrpanoColorize(v),
                            },
                            { clearMicroniqueIconColors: true },
                          );
                        }}
                        title="Teinte multiplicative sur toute la texture"
                      />
                      <input
                        className={`${fieldClass} min-w-0 flex-1 font-mono text-xs`}
                        value={localColorize}
                        onChange={(e) => setLocalColorize(e.target.value)}
                        onBlur={() => void applyLocalFieldsToPatch()}
                        placeholder="#ffffff ou 0xffffff"
                        spellCheck={false}
                      />
                    </div>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-500">
                      {editIsMicronique
                        ? "Utilisée si les deux champs « fond / pictogramme » ne sont pas tous les deux renseignés. Blanc = neutre."
                        : "Blanc = neutre. Pipette = enregistrement immédiat ; champ texte = au blur ou avec les autres champs."}
                    </p>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-zinc-400">scale</label>
                    <input
                      className={fieldClass}
                      value={localScale}
                      onChange={(e) => setLocalScale(e.target.value)}
                      onBlur={() => void applyLocalFieldsToPatch()}
                      placeholder={String(styleDefaults.scale)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400">
                      rotate (°)
                    </label>
                    <input
                      className={fieldClass}
                      value={localRotate}
                      onChange={(e) => setLocalRotate(e.target.value)}
                      onBlur={() => void applyLocalFieldsToPatch()}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-zinc-400">edge</label>
                    <input
                      className={fieldClass}
                      value={localEdge}
                      onChange={(e) => setLocalEdge(e.target.value)}
                      onBlur={() => void applyLocalFieldsToPatch()}
                      placeholder={styleDefaults.edge}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400">zorder</label>
                    <input
                      className={fieldClass}
                      value={localZ}
                      onChange={(e) => setLocalZ(e.target.value)}
                      onBlur={() => void applyLocalFieldsToPatch()}
                      placeholder={String(styleDefaults.zorder)}
                    />
                  </div>
                </div>

                <label className="block text-[11px] text-zinc-400">
                  Fonction au clic
                </label>
                <select
                  className={fieldClass}
                  value={localHotspotMode}
                  onChange={(e) => {
                    const m = e.target.value as KrpanoXmlHotspotMode;
                    setLocalHotspotMode(m);
                    patchSceneHotspot({
                      hotspotMode: m,
                      navigationTargetSceneId:
                        m === "navigation"
                          ? localNavTargetSceneId.trim() || undefined
                          : undefined,
                      onclick:
                        m === "interaction"
                          ? localOnclick.trim() || undefined
                          : undefined,
                    });
                  }}
                >
                  <option value="interaction">Interaction</option>
                  <option value="navigation">Navigation</option>
                </select>
                {localHotspotMode === "navigation" ? (
                  <div>
                    <label className="mt-2 block text-[11px] text-zinc-400">
                      Scène de destination
                    </label>
                    <select
                      className={fieldClass}
                      value={localNavTargetSceneId}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLocalNavTargetSceneId(v);
                        patchSceneHotspot({
                          navigationTargetSceneId: v.trim() || undefined,
                        });
                      }}
                    >
                      <option value="">— Choisir une scène —</option>
                      {allTourScenes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} ({s.id})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] leading-relaxed text-zinc-500">
                      Contenu et comportement détaillés : à définir ultérieurement.
                      Action krpano optionnelle ci-dessous.
                    </p>
                    <label className="block text-[11px] text-zinc-400">
                      Action krpano (optionnel)
                    </label>
                    <textarea
                      className={`${fieldClass} min-h-[52px] font-mono text-[11px]`}
                      value={localOnclick}
                      onChange={(e) => setLocalOnclick(e.target.value)}
                      onBlur={() => void applyLocalFieldsToPatch()}
                      placeholder="ex. trace(hotspot);"
                    />
                  </div>
                )}

                <button
                  type="button"
                  className="w-full rounded-lg border border-sky-600/60 bg-sky-950/40 py-2 text-sm text-sky-100 hover:bg-sky-900/50"
                  disabled={!krpano || !viewerContainerId || !selectedName}
                  onClick={() => {
                    setPlacementTarget("edit");
                    setPlacementMode(true);
                  }}
                >
                  Repositionner sur la scène (clic)
                </button>

                <label className="block text-[11px] text-zinc-400">
                  onover (action krpano, optionnel)
                </label>
                <textarea
                  className={`${fieldClass} min-h-[52px] font-mono text-[11px]`}
                  value={localOnover}
                  onChange={(e) => setLocalOnover(e.target.value)}
                  onBlur={() => void applyLocalFieldsToPatch()}
                  placeholder='ex. tween(scale,0.55);'
                />
                <label className="block text-[11px] text-zinc-400">
                  onout (optionnel)
                </label>
                <textarea
                  className={`${fieldClass} min-h-[52px] font-mono text-[11px]`}
                  value={localOnout}
                  onChange={(e) => setLocalOnout(e.target.value)}
                  onBlur={() => void applyLocalFieldsToPatch()}
                />

                <button
                  type="button"
                  className="w-full rounded-lg border border-zinc-600 py-2 text-xs text-zinc-300 hover:bg-zinc-800/80"
                  onClick={clearHotspotOverride}
                >
                  Réinitialiser ce hotspot (surcharges)
                </button>
                  </>
                )}
              </>
            )}
          </EditorSection>
          )}
        </div>
      </div>
        ) : null}
      </div>

      {placementMode &&
      krpano &&
      viewerContainerId &&
      (placementTarget === "new"
        ? newName.trim().length > 0
        : Boolean(selectedName)) ? (
        <PlacementLayer
          krpano={krpano}
          containerId={viewerContainerId}
          onPlace={(ath, atv) => {
            if (placementTarget === "new") {
              setPlacementMode(false);
              void commitNewHotspot({ ath, atv });
              return;
            }
            patchSceneHotspot({ ath, atv });
            setPlacementMode(false);
          }}
          onCancel={() => setPlacementMode(false)}
        />
      ) : null}
    </>
  );
}

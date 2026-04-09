"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import { interactionSvgLabel } from "@/components/icons/InteractionSvgIcons";
import { sceneNavbarBottomReservePaddingClass } from "@/constants/sceneNavbarLayout";
import { postSceneInteractionsToServer } from "@/lib/sceneInteractionsApi";
import { KRPANO_XML_HOTSPOT_PRESET_URLS } from "@/lib/krpanoXmlHotspotPresets";
import {
  exportInteractionsDocumentJson,
  getDefaultInteractions,
  getDefaultKrpanoNavigationHotspotStyle,
  getDefaultKrpanoXmlHotspotOverrides,
} from "@/lib/sceneInteractionsStorage";
import type { KrpanoViewer } from "@/types/krpanoViewer";
import type {
  InteractionSvgIconId,
  KrpanoNavigationHotspotStyle,
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
  onMapChange: (next: SceneInteractionsMap) => void;
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
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const host = document.getElementById(containerId);
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = krpano.screentosphere(x, y);
    if (!s || Number.isNaN(s.x) || Number.isNaN(s.y)) return;
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
          Cliquez sur le panorama pour positionner le hotspot — Échap pour annuler
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        className="pointer-events-auto absolute bottom-8 left-1/2 z-95 -translate-x-1/2 rounded-full border border-white/20 bg-zinc-900 px-5 py-2 text-sm text-zinc-200"
      >
        Annuler
      </button>
    </div>
  );
}

export function HotspotXmlEditor({
  sceneName,
  map,
  onMapChange,
  krpano,
  viewerContainerId,
  krpanoNavigationHotspotStyle,
  onKrpanoNavigationHotspotStyleChange,
  krpanoXmlHotspotOverrides,
  onKrpanoXmlHotspotOverridesChange,
  shellPanelsVisible = true,
  dbUnavailable = false,
}: HotspotXmlEditorProps) {
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [placementMode, setPlacementMode] = useState(false);

  const [globalUrl, setGlobalUrl] = useState(
    () => krpanoNavigationHotspotStyle?.url ?? "krpano-patches/hotspot.svg",
  );
  const [globalOy, setGlobalOy] = useState(
    () => String(krpanoNavigationHotspotStyle?.oy ?? 30),
  );
  const [globalScale, setGlobalScale] = useState(
    () => String(krpanoNavigationHotspotStyle?.scale ?? 0.5),
  );
  const [globalEdge, setGlobalEdge] = useState(
    () => krpanoNavigationHotspotStyle?.edge ?? "top",
  );
  const [globalZ, setGlobalZ] = useState(
    () => String(krpanoNavigationHotspotStyle?.zorder ?? 500),
  );

  useEffect(() => {
    const s = krpanoNavigationHotspotStyle;
    if (!s) return;
    if (s.url != null) setGlobalUrl(s.url);
    if (typeof s.oy === "number") setGlobalOy(String(s.oy));
    if (typeof s.scale === "number") setGlobalScale(String(s.scale));
    if (s.edge != null) setGlobalEdge(s.edge);
    if (typeof s.zorder === "number") setGlobalZ(String(s.zorder));
  }, [krpanoNavigationHotspotStyle]);

  const pushGlobalStyle = useCallback(() => {
    const oy = parseFloat(globalOy);
    const scale = parseFloat(globalScale);
    const z = parseInt(globalZ, 10);
    onKrpanoNavigationHotspotStyleChange({
      url: globalUrl.trim() || undefined,
      oy: Number.isFinite(oy) ? oy : undefined,
      scale: Number.isFinite(scale) ? scale : undefined,
      edge: globalEdge.trim() || undefined,
      zorder: Number.isFinite(z) ? z : undefined,
    });
  }, [
    globalEdge,
    globalOy,
    globalScale,
    globalUrl,
    globalZ,
    onKrpanoNavigationHotspotStyleChange,
  ]);

  const sceneHotspots = useMemo((): TourHotspot[] => {
    const s = tour.scenes.find((x) => x.id === sceneName);
    return s?.hotspots ?? [];
  }, [sceneName]);

  const [selectedName, setSelectedName] = useState<string>("");

  useEffect(() => {
    if (sceneHotspots.length === 0) {
      setSelectedName("");
      return;
    }
    if (!selectedName || !sceneHotspots.some((h) => h.name === selectedName)) {
      setSelectedName(sceneHotspots[0]!.name);
    }
  }, [sceneHotspots, selectedName]);

  const selectedMeta = useMemo(
    () => sceneHotspots.find((h) => h.name === selectedName),
    [sceneHotspots, selectedName],
  );

  const currentOverride: KrpanoXmlHotspotOverride = useMemo(() => {
    if (!selectedName) return {};
    return krpanoXmlHotspotOverrides[sceneName]?.[selectedName] ?? {};
  }, [krpanoXmlHotspotOverrides, sceneName, selectedName]);

  const [localUrl, setLocalUrl] = useState("");
  const [localScale, setLocalScale] = useState("");
  const [localOy, setLocalOy] = useState("");
  const [localOx, setLocalOx] = useState("");
  const [localRotate, setLocalRotate] = useState("");
  const [localAth, setLocalAth] = useState("");
  const [localAtv, setLocalAtv] = useState("");
  const [localEdge, setLocalEdge] = useState("");
  const [localZ, setLocalZ] = useState("");
  const [localOnover, setLocalOnover] = useState("");
  const [localOnout, setLocalOnout] = useState("");

  useEffect(() => {
    const o = currentOverride;
    setLocalUrl(o.url ?? "");
    setLocalScale(o.scale != null ? String(o.scale) : "");
    setLocalOy(o.oy != null ? String(o.oy) : "");
    setLocalOx(o.ox != null ? String(o.ox) : "");
    setLocalRotate(o.rotateDeg != null ? String(o.rotateDeg) : "");
    setLocalAth(o.ath != null ? String(o.ath) : "");
    setLocalAtv(o.atv != null ? String(o.atv) : "");
    setLocalEdge(o.edge ?? "");
    setLocalZ(o.zorder != null ? String(o.zorder) : "");
    setLocalOnover(o.onover ?? "");
    setLocalOnout(o.onout ?? "");
  }, [currentOverride, selectedName, sceneName]);

  const presetActive = useCallback(
    (id: InteractionSvgIconId): boolean => {
      const u = KRPANO_XML_HOTSPOT_PRESET_URLS[id];
      return (localUrl || "").trim() === u;
    },
    [localUrl],
  );

  const patchSceneHotspot = useCallback(
    (patch: Partial<KrpanoXmlHotspotOverride>) => {
      if (!selectedName) return;
      const prev = krpanoXmlHotspotOverrides[sceneName]?.[selectedName] ?? {};
      const next: KrpanoXmlHotspotOverridesByScene = {
        ...krpanoXmlHotspotOverrides,
        [sceneName]: {
          ...(krpanoXmlHotspotOverrides[sceneName] ?? {}),
          [selectedName]: { ...prev, ...patch },
        },
      };
      onKrpanoXmlHotspotOverridesChange(next);
    },
    [
      krpanoXmlHotspotOverrides,
      onKrpanoXmlHotspotOverridesChange,
      sceneName,
      selectedName,
    ],
  );

  const applyLocalFieldsToPatch = useCallback(() => {
    const num = (s: string) => {
      const t = s.trim();
      if (t === "") return undefined;
      const n = parseFloat(t);
      return Number.isFinite(n) ? n : undefined;
    };
    patchSceneHotspot({
      url: localUrl.trim() || undefined,
      scale: num(localScale),
      oy: num(localOy),
      ox: num(localOx),
      rotateDeg: num(localRotate),
      ath: num(localAth),
      atv: num(localAtv),
      edge: localEdge.trim() || undefined,
      zorder: num(localZ) != null ? Math.round(num(localZ)!) : undefined,
      onover: localOnover.trim() || undefined,
      onout: localOnout.trim() || undefined,
    });
  }, [
    localAth,
    localAtv,
    localEdge,
    localOx,
    localOy,
    localOnout,
    localOnover,
    localRotate,
    localScale,
    localUrl,
    localZ,
    patchSceneHotspot,
  ]);

  const clearHotspotOverride = useCallback(() => {
    if (!selectedName) return;
    const hm = { ...(krpanoXmlHotspotOverrides[sceneName] ?? {}) };
    delete hm[selectedName];
    const next = { ...krpanoXmlHotspotOverrides };
    if (Object.keys(hm).length === 0) delete next[sceneName];
    else next[sceneName] = hm;
    onKrpanoXmlHotspotOverridesChange(next);
  }, [
    krpanoXmlHotspotOverrides,
    onKrpanoXmlHotspotOverridesChange,
    sceneName,
    selectedName,
  ]);

  const clearAll = useCallback(() => {
    onMapChange(getDefaultInteractions());
    onKrpanoNavigationHotspotStyleChange(
      getDefaultKrpanoNavigationHotspotStyle() ?? {},
    );
    onKrpanoXmlHotspotOverridesChange(getDefaultKrpanoXmlHotspotOverrides());
  }, [
    onKrpanoNavigationHotspotStyleChange,
    onKrpanoXmlHotspotOverridesChange,
    onMapChange,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlacementMode(false);
    };
    if (placementMode) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placementMode]);

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
        <div className="border-b border-zinc-800/90 px-3.5 py-2.5">
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

        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3 space-y-4">
          <EditorSection
            title="Style global (hotspot_custom_style)"
            description="Les hotspots affichés dans la visite sont d’abord définis dans data/tour.xml (krpano). La base stocke une ligne SceneInteractionsSnapshot (id « default ») : style global + surcharges par hotspot (JSON). Relatif au basepath /micronique-assets/."
          >
            <label className="block text-[11px] text-zinc-400">URL texture</label>
            <input
              className={fieldClass}
              value={globalUrl}
              onChange={(e) => setGlobalUrl(e.target.value)}
              onBlur={pushGlobalStyle}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-zinc-400">oy (px)</label>
                <input
                  className={fieldClass}
                  value={globalOy}
                  onChange={(e) => setGlobalOy(e.target.value)}
                  onBlur={pushGlobalStyle}
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400">scale</label>
                <input
                  className={fieldClass}
                  value={globalScale}
                  onChange={(e) => setGlobalScale(e.target.value)}
                  onBlur={pushGlobalStyle}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-zinc-400">edge</label>
                <input
                  className={fieldClass}
                  value={globalEdge}
                  onChange={(e) => setGlobalEdge(e.target.value)}
                  onBlur={pushGlobalStyle}
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400">zorder</label>
                <input
                  className={fieldClass}
                  value={globalZ}
                  onChange={(e) => setGlobalZ(e.target.value)}
                  onBlur={pushGlobalStyle}
                />
              </div>
            </div>
          </EditorSection>

          <EditorSection
            title="Hotspot XML sur cette scène"
            description="Liste issue du tour (data/tour.xml). Les réglages s’appliquent au hotspot krpano du même nom."
          >
            {sceneHotspots.length === 0 ? (
              <p className="text-xs text-zinc-500">Aucun hotspot sur cette scène.</p>
            ) : (
              <>
                <label className="block text-[11px] text-zinc-400">Hotspot</label>
                <select
                  className={fieldClass}
                  value={selectedName}
                  onChange={(e) => setSelectedName(e.target.value)}
                >
                  {sceneHotspots.map((h) => (
                    <option key={h.id} value={h.name}>
                      {h.name}
                      {h.targetSceneId
                        ? ` → ${h.targetSceneId}`
                        : " (info / sans lien)"}
                    </option>
                  ))}
                </select>

                {selectedMeta ? (
                  <p className="text-[10px] text-zinc-500">
                    XML : ath {selectedMeta.ath.toFixed(2)}°, atv{" "}
                    {selectedMeta.atv.toFixed(2)}°
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
                        patchSceneHotspot({ url: u });
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
                  onBlur={applyLocalFieldsToPatch}
                />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-zinc-400">scale</label>
                    <input
                      className={fieldClass}
                      value={localScale}
                      onChange={(e) => setLocalScale(e.target.value)}
                      onBlur={applyLocalFieldsToPatch}
                      placeholder="ex. 0.5"
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
                      onBlur={applyLocalFieldsToPatch}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-zinc-400">ox</label>
                    <input
                      className={fieldClass}
                      value={localOx}
                      onChange={(e) => setLocalOx(e.target.value)}
                      onBlur={applyLocalFieldsToPatch}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400">oy</label>
                    <input
                      className={fieldClass}
                      value={localOy}
                      onChange={(e) => setLocalOy(e.target.value)}
                      onBlur={applyLocalFieldsToPatch}
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
                      onBlur={applyLocalFieldsToPatch}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400">zorder</label>
                    <input
                      className={fieldClass}
                      value={localZ}
                      onChange={(e) => setLocalZ(e.target.value)}
                      onBlur={applyLocalFieldsToPatch}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-zinc-400">ath</label>
                    <input
                      className={fieldClass}
                      value={localAth}
                      onChange={(e) => setLocalAth(e.target.value)}
                      onBlur={applyLocalFieldsToPatch}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400">atv</label>
                    <input
                      className={fieldClass}
                      value={localAtv}
                      onChange={(e) => setLocalAtv(e.target.value)}
                      onBlur={applyLocalFieldsToPatch}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="w-full rounded-lg border border-sky-600/60 bg-sky-950/40 py-2 text-sm text-sky-100 hover:bg-sky-900/50"
                  disabled={!krpano || !viewerContainerId || !selectedName}
                  onClick={() => setPlacementMode(true)}
                >
                  Placer ath / atv sur la scène
                </button>

                <label className="block text-[11px] text-zinc-400">
                  onover (action krpano, optionnel)
                </label>
                <textarea
                  className={`${fieldClass} min-h-[52px] font-mono text-[11px]`}
                  value={localOnover}
                  onChange={(e) => setLocalOnover(e.target.value)}
                  onBlur={applyLocalFieldsToPatch}
                  placeholder='ex. tween(scale,0.55);'
                />
                <label className="block text-[11px] text-zinc-400">
                  onout (optionnel)
                </label>
                <textarea
                  className={`${fieldClass} min-h-[52px] font-mono text-[11px]`}
                  value={localOnout}
                  onChange={(e) => setLocalOnout(e.target.value)}
                  onBlur={applyLocalFieldsToPatch}
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
          </EditorSection>
        </div>

        <div className="border-t border-zinc-800/90 p-3.5 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-1.5 text-xs text-zinc-200"
              onClick={() => {
                const blob = new Blob(
                  [
                    exportInteractionsDocumentJson(
                      map,
                      krpanoNavigationHotspotStyle,
                      krpanoXmlHotspotOverrides,
                    ),
                  ],
                  { type: "application/json" },
                );
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "scene-interactions.json";
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              Télécharger JSON
            </button>
            <button
              type="button"
              disabled={publishBusy || dbUnavailable}
              className="rounded-lg border border-emerald-700/80 bg-emerald-950/50 px-3 py-1.5 text-xs text-emerald-100 disabled:opacity-50"
              onClick={async () => {
                setPublishBusy(true);
                setPublishFeedback(null);
                setPublishSuccess(null);
                try {
                  const r = await postSceneInteractionsToServer(
                    map,
                    krpanoNavigationHotspotStyle,
                    krpanoXmlHotspotOverrides,
                  );
                  if (!r.ok) {
                    const extra = r.details ? ` — ${r.details}` : "";
                    throw new Error(`${r.error}${extra}`);
                  }
                  setPublishSuccess(
                    r.updatedAt
                      ? `Enregistré (snapshot « default », ${r.updatedAt})`
                      : "Enregistré dans la table SceneInteractionsSnapshot (id « default »).",
                  );
                } catch (e) {
                  setPublishFeedback(
                    e instanceof Error ? e.message : "Échec de l’enregistrement",
                  );
                } finally {
                  setPublishBusy(false);
                }
              }}
            >
              {publishBusy ? "Enregistrement…" : "Publier dans la base"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-red-800/80 bg-red-950/30 px-3 py-1.5 text-xs text-red-200"
              onClick={() => {
                if (
                  typeof window !== "undefined" &&
                  window.confirm(
                    "Tout effacer (carte vide, style défaut, surcharges hotspots) ?",
                  )
                )
                  clearAll();
              }}
            >
              Tout effacer
            </button>
          </div>
          <p className="text-[10px] leading-snug text-zinc-500">
            PostgreSQL : fusion avec le JSON du build. Ctrl+M pour afficher ce panneau.
          </p>
          {publishSuccess ? (
            <p className="text-[10px] text-emerald-400">{publishSuccess}</p>
          ) : null}
          {publishFeedback ? (
            <p className="text-[10px] text-red-400">{publishFeedback}</p>
          ) : null}
        </div>
      </div>
        ) : null}
      </div>

      {placementMode && krpano && viewerContainerId && selectedName ? (
        <PlacementLayer
          krpano={krpano}
          containerId={viewerContainerId}
          onPlace={(ath, atv) => {
            setLocalAth(String(ath));
            setLocalAtv(String(atv));
            patchSceneHotspot({ ath, atv });
            setPlacementMode(false);
          }}
          onCancel={() => setPlacementMode(false)}
        />
      ) : null}
    </>
  );
}

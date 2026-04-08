"use client";

import { Home, Menu, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { catalogEquipmentRowDisplay } from "@/lib/catalogDisplayLabels";
import { findBestEquipmentCatalogSearchMatch } from "@/lib/equipmentCatalogSearch";
import { mergeEquipmentCatalogZones } from "@/lib/mergedEquipmentZones";
import type { SceneInteractionsMap } from "@/types/interactions";

/** Lignes catalogue : nom du bouton (équipement). */
const CATALOG_ITEM_LABEL = "equipment" as const;

export type EquipmentCatalogPanelProps = {
  map: SceneInteractionsMap;
  /** Appelé avec la scène cible et l’id du bouton — le parent charge la scène si besoin puis déclenche l’activation. */
  onPickEquipment: (sceneId: string, buttonId: string) => void;
  /** Navigation vers une zone (scène) depuis la recherche — équivalent à un clic dock / zone catalogue. */
  onNavigateToZone: (sceneId: string) => void;
};

/**
 * Panneau plein écran : zones à gauche, équipements à droite (style catalogue type Micronique).
 */
export function EquipmentCatalogPanel({
  map,
  onPickEquipment,
  onNavigateToZone,
}: EquipmentCatalogPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedZoneIdx, setSelectedZoneIdx] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /**
   * Zones avec équipements, puis fusion par libellé affiché (après remplacements JSON).
   * Ex. « Micronique 19 » et « Micronique 8 » → « MAGASIN » : une seule ligne, liste d’équipements fusionnée.
   */
  const zones = useMemo(() => mergeEquipmentCatalogZones(map), [map]);

  const searchMatch = useMemo(
    () => findBestEquipmentCatalogSearchMatch(searchQuery, map),
    [searchQuery, map],
  );

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
  }, []);

  const applySearchMatch = useCallback(() => {
    if (!searchMatch) return;
    closeSearch();
    if (searchMatch.kind === "zone") {
      onNavigateToZone(searchMatch.sceneId);
    } else {
      onPickEquipment(searchMatch.sceneId, searchMatch.buttonId);
    }
  }, [searchMatch, onNavigateToZone, onPickEquipment, closeSearch]);

  useEffect(() => {
    if (!searchOpen) return;
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = searchWrapRef.current;
      if (el && !el.contains(e.target as Node)) {
        closeSearch();
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [searchOpen, closeSearch]);

  useEffect(() => {
    if (zones.length === 0) {
      setSelectedZoneIdx(0);
      return;
    }
    setSelectedZoneIdx((i) => (i >= zones.length ? 0 : i));
  }, [zones]);

  useEffect(() => {
    if (open) setSelectedZoneIdx(0);
  }, [open]);

  const selectedZone = zones[selectedZoneIdx] ?? null;
  const selectedZoneDisplay = selectedZone?.displayLabel ?? "";

  return (
    <>
      <div
        ref={searchWrapRef}
        className="pointer-events-auto fixed right-4 top-4 z-[310] flex flex-col items-end gap-2"
      >
        <div className="flex items-center gap-2">
          {searchOpen ? (
            <div
              id="equipment-catalog-search"
              role="search"
              className="flex w-[min(calc(100vw-8rem),32rem)] min-w-0 items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
            >
              <label className="sr-only" htmlFor="equipment-catalog-search-input">
                Rechercher une zone ou un équipement
              </label>
              <input
                id="equipment-catalog-search-input"
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applySearchMatch();
                  }
                  if (e.key === "Escape") {
                    closeSearch();
                  }
                }}
                placeholder="Zone ou équipement…"
                autoComplete="off"
                className="min-w-0 flex-1 border-0 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-0"
              />
              <button
                type="button"
                onClick={closeSearch}
                className="flex size-11 shrink-0 items-center justify-center border-l border-slate-200 bg-white text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400"
                aria-expanded={searchOpen}
                aria-controls="equipment-catalog-search"
                aria-label="Fermer la recherche zone ou équipement"
              >
                <Search strokeWidth={2} className="size-5" aria-hidden />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 shadow-lg transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
              aria-expanded={false}
              aria-controls="equipment-catalog-search"
              aria-label="Rechercher une zone ou un équipement"
            >
              <Search strokeWidth={2} className="size-5" aria-hidden />
            </button>
          )}
          {/* Bouton menu : ouvre / ferme le catalogue, icône Menu ↔ X */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex size-11 items-center justify-center rounded-xl border border-white/15 bg-zinc-900/90 text-zinc-100 shadow-lg backdrop-blur-md transition hover:bg-zinc-800/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
            aria-expanded={open}
            aria-controls="equipment-catalog-panel"
            aria-label={
              open
                ? "Fermer le catalogue équipements"
                : "Ouvrir le catalogue équipements"
            }
          >
            <span className="relative flex size-5 items-center justify-center">
              <Menu
                strokeWidth={2}
                className={`absolute size-5 transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none ${
                  open
                    ? "scale-50 rotate-90 opacity-0"
                    : "scale-100 rotate-0 opacity-100"
                }`}
                aria-hidden
              />
              <X
                strokeWidth={2.5}
                className={`absolute size-5 transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none ${
                  open
                    ? "scale-100 rotate-0 opacity-100"
                    : "scale-50 -rotate-90 opacity-0"
                }`}
                aria-hidden
              />
            </span>
          </button>
        </div>

        {searchOpen && searchQuery.trim() ? (
          <div className="w-[min(calc(100vw-8rem),32rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
            {searchMatch ? (
              <button
                type="button"
                onClick={applySearchMatch}
                className="flex w-full flex-col items-start gap-0.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-900 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {searchMatch.kind === "zone" ? "Zone" : "Équipement"}
                </span>
                <span className="font-medium leading-snug text-slate-900">
                  {searchMatch.label}
                </span>
              </button>
            ) : (
              <p className="text-center text-xs text-slate-500">Aucun résultat</p>
            )}
          </div>
        ) : null}
      </div>

      <div
        className={`fixed inset-0 z-[300] transition-[visibility] duration-300 ${
          open ? "visible" : "invisible pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        <div
          id="equipment-catalog-panel"
          role="dialog"
          aria-label="Catalogue des équipements par zone"
          aria-modal="true"
          className={`flex h-dvh max-h-dvh min-h-0 flex-col bg-white text-slate-900 shadow-2xl transition-transform duration-300 ease-out ${
            open ? "translate-y-0" : "-translate-y-full"
          }`}
        >
          {/* Barre d’en-tête */}
          <header className="flex shrink-0 items-center border-b border-slate-200/90 px-4 py-4 sm:px-8">
            <div className="w-1/3 min-w-0 text-left">
              <span className="text-[13px] font-medium tracking-wide text-slate-400">
                MICRONIQUE
              </span>
            </div>
            <div className="w-1/3 text-center">
              <h1 className="text-base font-bold uppercase tracking-[0.14em] text-slate-900 sm:text-lg">
                EQUIPEMENTS
              </h1>
            </div>
            <div className="w-1/3 shrink-0" aria-hidden />
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:flex-row sm:gap-6 sm:p-6 md:p-8">
            {zones.length === 0 ? (
              <p className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-16 text-center text-sm text-slate-500">
                Aucun équipement pour l’instant. Cochez « Équipement » dans l’éditeur
                d’interactions sur un bouton.
              </p>
            ) : (
              <>
                {/* Colonne zones */}
                <aside className="flex h-full min-h-0 w-full shrink-0 flex-col rounded-2xl bg-[#e4eaf0] p-4 sm:max-w-[min(100%,20rem)] md:max-w-[22rem]">
                  <nav
                    className="min-h-0 flex-1 overflow-y-auto pr-1 [-webkit-overflow-scrolling:touch]"
                    aria-label="Zones"
                  >
                    <ul className="flex flex-col gap-0.5">
                      {zones.map((z, i) => {
                        const active = i === selectedZoneIdx;
                        return (
                          <li key={z.sceneIds.join("|")}>
                            <button
                              type="button"
                              onClick={() => setSelectedZoneIdx(i)}
                              className={`relative w-full text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
                                active ? "text-slate-900" : "text-slate-800 hover:text-slate-950"
                              }`}
                            >
                              <span className="flex items-center justify-between gap-2 py-2.5 pl-1 pr-0">
                                <span className="text-[11px] font-semibold uppercase leading-snug tracking-wide sm:text-xs">
                                  {z.displayLabel}
                                </span>
                                <span
                                  className={`mt-0.5 size-2 shrink-0 rounded-full ${
                                    active ? "bg-slate-900" : "bg-slate-600"
                                  }`}
                                  aria-hidden
                                />
                              </span>
                              {active ? (
                                <span
                                  className="absolute bottom-0 left-0 right-0 block h-px bg-slate-900"
                                  aria-hidden
                                />
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>
                  <div className="shrink-0 border-t border-slate-400/35 pt-3">
                    <button
                      type="button"
                      onClick={() => router.replace("/")}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-400/50 bg-white/90 px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-900 shadow-sm transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 sm:text-xs"
                      aria-label="Retour à l’accueil"
                    >
                      <Home className="size-4 shrink-0" aria-hidden />
                      Accueil
                    </button>
                  </div>
                </aside>

                {/* Liste équipements zone sélectionnée */}
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  {selectedZone ? (
                    <ul
                      className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain py-1 pr-1 [-webkit-overflow-scrolling:touch]"
                      aria-label={`Équipements — ${selectedZoneDisplay}`}
                    >
                      {selectedZone.items.map(({ sceneId, button: b }) => (
                        <li key={`${sceneId}:${b.id}`}>
                          <button
                            type="button"
                            onClick={() => {
                              setOpen(false);
                              onPickEquipment(sceneId, b.id);
                            }}
                            className="group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-slate-100 focus:outline-none focus-visible:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-400"
                          >
                            <span
                              className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-slate-900"
                              aria-hidden
                            >
                              <span className="size-1.5 rounded-full bg-slate-900" />
                            </span>
                            <span className="min-w-0 flex-1 text-[12px] font-semibold uppercase leading-snug tracking-wide text-slate-900 sm:text-[13px]">
                              {catalogEquipmentRowDisplay(
                                b,
                                selectedZoneDisplay,
                                CATALOG_ITEM_LABEL,
                              )}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

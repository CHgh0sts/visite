import tour from "@/data/tour.json";

export type TourSceneOption = {
  id: string;
  title: string;
};

/** Toutes les scènes 3D du tour (depuis `src/data/tour.json`, généré par `scripts/build-tour.mjs`). */
export const TOUR_SCENES: TourSceneOption[] = tour.scenes.map((s) => ({
  id: s.id,
  title: s.title,
}));

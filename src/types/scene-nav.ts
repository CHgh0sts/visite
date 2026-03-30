/** Config JSON `src/data/scene-nav.json` — navigation entre scènes krpano. */
export type SceneNavItem = {
  /**
   * Optionnel : clé stable si plusieurs lignes pointent vers la même `sceneId`
   * (libellés / icônes différents). Sinon l’index dans le tableau sert de clé React.
   */
  id?: string;
  /** Identifiant de scène dans le tour (ex. `scene_micronique_1`). */
  sceneId: string;
  /**
   * Scènes « associées » : même style « zone actuelle » que `sceneId`, mais le clic
   * charge toujours `sceneId` (utile pour plusieurs hotspots d’une même zone).
   * `otherSceneIds` est un alias (même tableau) — les deux noms sont acceptés.
   */
  otherSceneId?: string[];
  otherSceneIds?: string[];
  /** Libellé sous l’icône. */
  label: string;
  /**
   * URL publique (fichier sous `public/`, tout format image : png, svg, webp…).
   * Ex. `public/scene-nav/accueil.png` → `"/scene-nav/accueil.png"`.
   */
  iconUrl: string;
};

export type SceneNavConfig = {
  /**
   * Bleu « site » (actif : fond + texte inactif).
   * Défaut : aligné sur l’éditeur d’interactions (`#0e203d`).
   */
  accentColor?: string;
  items: SceneNavItem[];
};

/** Config `src/data/catalog-labels.json` — libellés catalogue équipements (surcharges + dictionnaire). */
export type CatalogTextReplacement = {
  /** Texte à remplacer (tel quel, partout où il apparaît). */
  from: string;
  /** Texte de remplacement. */
  to: string;
};

export type CatalogLabelsConfig = {
  /**
   * Par identifiant de scène krpano : libellé affiché à la place du titre tour / nav.
   * Priorité : ce champ > `scene-nav.json` > `tour.json` > id.
   */
  sceneLabels?: Record<string, string>;
  /**
   * Par id de bouton d’interaction : libellé affiché à la place du titre modale / résumé.
   * S’applique uniquement quand l’affichage « Lignes » = Équipement.
   */
  buttonLabels?: Record<string, string>;
  /**
   * Remplacements globaux appliqués dans l’ordre sur les libellés finaux (zones + lignes).
   * Utile pour harmoniser une tournure sans toucher chaque scène.
   */
  textReplacements?: CatalogTextReplacement[];
};

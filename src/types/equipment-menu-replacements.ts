/**
 * Config `src/data/equipment-menu-replacements.json`
 * Remplacements visuels dans le menu catalogue équipements uniquement.
 */
export type EquipmentMenuReplacementEntry = {
  /** Texte à chercher (voir `exact`). */
  from: string;
  /** Texte affiché à la place. */
  to: string;
  /**
   * Si `true` : remplace seulement quand tout le libellé (après trim) est égal à `from`.
   * Si `false` ou absent : remplace chaque occurrence de `from` dans le texte (comme rechercher/remplacer).
   */
  exact?: boolean;
};

export type EquipmentMenuReplacementsConfig = {
  /**
   * Liste appliquée dans l’ordre, après les surcharges de `catalog-labels.json`
   * et avant affichage. S’applique aux **noms de zones** et aux **noms de machines** (lignes).
   */
  replacements: EquipmentMenuReplacementEntry[];
};

/**
 * Chaque entrée = une image affichée en position absolue sur la scène.
 * Utilisez %, px, vh, vw, calc()… comme en CSS.
 */
export type SceneImage = {
  id: string;
  /** Chemin sous /public, ex. /scene/atelier.jpg */
  src: string;
  alt?: string;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  width?: string;
  height?: string;
  maxWidth?: string;
  maxHeight?: string;
  zIndex?: number;
  objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
  transform?: string;
};

export type SceneConfig = {
  title?: string;
  /** Couleur de fond derrière les images */
  background?: string;
  images: SceneImage[];
};

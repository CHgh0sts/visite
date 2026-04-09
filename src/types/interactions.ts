/**
 * Bouton d’interaction par-dessus le viewer.
 * - **Sphère** (`ath` + `atv`) : suit le panorama quand on tourne la caméra (recommandé).
 * - **Écran** (`topPct` + `leftPct` uniquement) : ancien mode, position fixe dans la fenêtre.
 */

/** Contenu affiché dans une boîte (modale) au clic sur le bouton */
export type InteractionModalContent = {
  title?: string;
  /** Texte multiligne (retours à la ligne conservés) */
  body?: string;
  /** Vidéo : fichier mp4/webm ou lien YouTube / Vimeo */
  videoUrl?: string;
  /** Si `false`, la vidéo ne démarre pas toute seule à l’ouverture de la boîte (défaut : lecture auto). */
  videoAutoplay?: boolean;
  /** Fond de la boîte (CSS : hex, rgb, hsl…) */
  bgColor?: string;
  /** Couleur du texte (titre + corps) */
  textColor?: string;
  /** Couleur de la bordure du cadre */
  borderColor?: string;
  /** Voile plein écran derrière la boîte (clic pour fermer si activé) */
  backdropColor?: string;
  /** Largeur max. CSS (ex. min(520px, 100vw - 2rem)) */
  maxWidth?: string;
  /** Fermer en cliquant sur le voile (défaut : true) */
  closeOnBackdropClick?: boolean;
  /** Fermer avec Échap (défaut : true) */
  closeOnEscape?: boolean;
  /** Afficher le bouton « Fermer » (défaut : true) */
  showCloseButton?: boolean;
  /**
   * Afficher la bande d’en-tête (titre + zone du bouton Fermer) (défaut : true).
   * Si `false`, toute cette ligne est masquée (le titre n’apparaît pas, ni le Fermer).
   */
  showTitleBar?: boolean;
  /**
   * Si `true` : à l’ouverture (bouton ancré en sphère `ath`/`atv` uniquement), pivote uniquement la
   * caméra du panorama vers ce point (la boîte reste ancrée au bouton comme sans cette option).
   * À la fermeture, l’orientation précédente est restaurée.
   */
  centerViewForModal?: boolean;
};

/** Côté de la bulle « notification » au survol */
export type InteractionHoverHintPlacement =
  | "top"
  | "right"
  | "bottom"
  | "left";

export type SceneInteractionButtonBase = {
  id: string;
  /** Lien ouvert dans un nouvel onglet (souvent en complément de la boîte) */
  url?: string;
  /** Boîte au clic : texte, vidéo, etc. */
  modal?: InteractionModalContent;
  /** Couleurs CSS (hex, rgb, hsl…) — si au moins une est définie, le thème par défaut est remplacé */
  bgColor?: string;
  /** Texte, icônes Lucide, SVG : `currentColor` */
  fgColor?: string;
  /** Fond au survol (optionnel) */
  hoverBgColor?: string;
  /** Texte / icônes au survol (optionnel) */
  hoverFgColor?: string;
  /** Rotation de l’icône Lucide ou du SVG (degrés, sens horaire depuis le haut) */
  iconRotationDeg?: number;
  /** Rotation supplémentaire au survol du bouton (s’ajoute à `iconRotationDeg`) */
  iconHoverRotationDeg?: number;
  /** Durée de la transition de rotation (ms), défaut 250 */
  iconRotationDurationMs?: number;
  /** Délai avant la transition (ms), défaut 0 */
  iconRotationDelayMs?: number;
  /**
   * Angles krpano (deg), même référentiel que les hotspots — le bouton reste sur l’objet dans l’image.
   */
  ath?: number;
  atv?: number;
  /** Ancien mode : position en % du conteneur (si pas d’ancrage sphérique) */
  topPct?: number;
  leftPct?: number;
  /** Texte affiché dans une bulle au survol, à côté du bouton (pas à l’intérieur). */
  hoverHint?: string;
  /** Position de la bulle par rapport au bouton (défaut : haut). */
  hoverHintPlacement?: InteractionHoverHintPlacement;
  /**
   * Scène krpano à charger au clic (`loadscene`), comme les hotspots du tour.
   * Identifiants : voir `src/data/tour.json` (généré depuis `data/tour.xml`).
   */
  targetSceneId?: string;
  /**
   * Orientation à l’arrivée sur la scène cible (équivalent `linkedscene_lookat` dans le XML).
   * Sans `fov` : seuls h/v sont appliqués, le zoom reste celui de la scène (`view.fov`).
   */
  targetSceneLookAt?: {
    hlookat: number;
    vlookat: number;
    /** Champ de vision (°) — ne renseigner que si tu veux aussi modifier le zoom. */
    fov?: number;
  };
  /**
   * Si `true`, au clic on conserve l’orientation actuelle (h/v/fov) sur la scène de destination.
   * `targetSceneLookAt` est alors ignoré au moment du chargement.
   */
  preserveCurrentViewOnSceneChange?: boolean;
  /**
   * Échelle du bouton sur la scène (1 = taille de base du composant).
   */
  sceneBtnScale?: number;
  /** Inclinaison 3D / rotation (degrés). X et Y nécessitent une perspective. */
  sceneBtnRotateXDeg?: number;
  sceneBtnRotateYDeg?: number;
  /** Rotation dans le plan de l’écran (degrés). */
  sceneBtnRotateZDeg?: number;
  /** Rayon des coins (CSS), ex. `9999px`, `12px`, `0`. Surcharge le arrondi par défaut. */
  sceneBtnBorderRadius?: string;
  /**
   * Bordure du bouton sur la scène (px). `0` = pas de bordure.
   * Si absent et sans `sceneBtnBorderColor` : bordure par défaut (fine, discret).
   * Si seule la couleur est définie : équivalent à 1 px.
   */
  sceneBtnBorderWidthPx?: number;
  /** Couleur de la bordure (CSS). Utilisée si une épaisseur est définie ou seule (1 px). */
  sceneBtnBorderColor?: string;
  /**
   * Si `true`, le bouton apparaît dans le catalogue « équipements » (menu par zone / scène)
   * et peut être ouvert depuis ce menu comme un clic sur le bouton.
   */
  isEquipment?: boolean;
};

/** Texte classique */
export type SceneInteractionButtonText = SceneInteractionButtonBase & {
  contentType?: "text";
  label: string;
};

/** Icône Lucide (nom du symbole exporté, ex. Info, ExternalLink) */
export type SceneInteractionButtonLucide = SceneInteractionButtonBase & {
  contentType: "lucide";
  lucideIcon: string;
  /** Libellé optionnel (aria-label / titre) */
  label?: string;
};

/** Image (URL absolue ou chemin /public/…) */
export type SceneInteractionButtonImage = SceneInteractionButtonBase & {
  contentType: "image";
  imageSrc: string;
  imageAlt?: string;
};

/** Icône SVG embarquée (identifiant fixe, voir InteractionSvgIcons) */
export type InteractionSvgIconId = "cross" | "arrow" | "microniquePlay";

export type SceneInteractionButtonSvg = SceneInteractionButtonBase & {
  contentType: "svg";
  svgId: InteractionSvgIconId;
  label?: string;
};

export type SceneInteractionButton =
  | SceneInteractionButtonText
  | SceneInteractionButtonLucide
  | SceneInteractionButtonImage
  | SceneInteractionButtonSvg;

/** Clé = nom de scène krpano (ex. scene_micronique_1) */
export type SceneInteractionsMap = Record<string, SceneInteractionButton[]>;

/**
 * Paramètres des flèches / hotspots de navigation du tour XML (`style name="hotspot_custom_style"`).
 * Stockés dans le JSON PostgreSQL à côté de `map`, appliqués au viewer au chargement.
 */
export type KrpanoNavigationHotspotStyle = {
  /** Chemin relatif au basepath krpano (ex. `krpano-patches/hotspot.svg`). */
  url?: string;
  /** Échelle de base (le style XML utilise souvent une animation depuis 0). */
  scale?: number;
  /** Décalage vertical pixels (krpano `oy`). */
  oy?: number;
  /** `edge` du hotspot (ex. `top`). */
  edge?: string;
  zorder?: number;
};

/**
 * Surcharges par hotspot XML (nom krpano tel que dans `data/tour.xml`), par scène.
 * Appliquées après le style global `hotspot_custom_style`.
 */
export type KrpanoXmlHotspotOverride = {
  /** Texture du hotspot (relatif au basepath krpano). */
  url?: string;
  scale?: number;
  ox?: number;
  oy?: number;
  edge?: string;
  zorder?: number;
  /** Rotation dans le plan du hotspot (°) — krpano `rotate`. */
  rotateDeg?: number;
  ath?: number;
  atv?: number;
  /** Surcharge des actions (texte krpano), pour personnaliser hover / clic. */
  onover?: string;
  onout?: string;
  onclick?: string;
};

/** sceneId → hotspotName → override */
export type KrpanoXmlHotspotOverridesByScene = Record<
  string,
  Record<string, KrpanoXmlHotspotOverride>
>;

export function isLucideButton(
  b: SceneInteractionButton,
): b is SceneInteractionButtonLucide {
  return b.contentType === "lucide";
}

export function isImageButton(
  b: SceneInteractionButton,
): b is SceneInteractionButtonImage {
  return b.contentType === "image";
}

export function isSvgButton(
  b: SceneInteractionButton,
): b is SceneInteractionButtonSvg {
  return b.contentType === "svg";
}

export function isTextButton(
  b: SceneInteractionButton,
): b is SceneInteractionButtonText {
  return (
    b.contentType !== "lucide" &&
    b.contentType !== "image" &&
    b.contentType !== "svg"
  );
}

/** Ancrage 3D (panorama) — à jour pour les nouveaux boutons */
export function isSphereAnchored(b: SceneInteractionButton): boolean {
  return (
    typeof b.ath === "number" &&
    typeof b.atv === "number" &&
    !Number.isNaN(b.ath) &&
    !Number.isNaN(b.atv)
  );
}

/** Au moins un contenu utile dans la boîte */
export function hasModalContent(
  modal: InteractionModalContent | undefined,
): boolean {
  if (!modal) return false;
  const body = modal.body?.trim();
  const video = modal.videoUrl?.trim();
  const title = modal.title?.trim();
  return !!(body || video || title);
}

/** Libellé affiché dans la liste d’édition */
export function interactionSummary(b: SceneInteractionButton): string {
  let base: string;
  if (isLucideButton(b)) base = `Icône: ${b.lucideIcon}`;
  else if (isSvgButton(b))
    base =
      b.svgId === "cross"
        ? "SVG — croix"
        : b.svgId === "arrow"
          ? "SVG — flèche"
          : b.svgId === "microniquePlay"
            ? "SVG — Micronique (vidéo)"
            : `SVG: ${b.svgId}`;
  else if (isImageButton(b))
    base = `Image: ${b.imageSrc.slice(0, 48)}${b.imageSrc.length > 48 ? "…" : ""}`;
  else base = b.label;
  const hintTrim = b.hoverHint?.trim();
  const bubble = hintTrim
    ? `bulle ${b.hoverHintPlacement ?? "top"} (${hintTrim.slice(0, 24)}${hintTrim.length > 24 ? "…" : ""})`
    : "";
  const look = b.targetSceneLookAt;
  const lookStr =
    look &&
    Number.isFinite(look.hlookat) &&
    Number.isFinite(look.vlookat)
      ? `vue ${look.hlookat.toFixed(1)}° / ${look.vlookat.toFixed(1)}°${
          look.fov != null && Number.isFinite(look.fov)
            ? `, FOV ${look.fov.toFixed(0)}°`
            : ""
        }`
      : "";
  const preserve =
    b.preserveCurrentViewOnSceneChange === true
      ? " — garder la vue actuelle"
      : "";
  const sceneNav = b.targetSceneId?.trim()
    ? `scène → ${b.targetSceneId.trim()}${preserve}${
        !b.preserveCurrentViewOnSceneChange && lookStr ? ` (${lookStr})` : ""
      }`
    : "";
  const sceneLook: string[] = [];
  if (
    b.sceneBtnScale != null &&
    Number.isFinite(b.sceneBtnScale) &&
    Math.abs(b.sceneBtnScale - 1) > 0.001
  ) {
    sceneLook.push(`échelle ×${b.sceneBtnScale.toFixed(2)}`);
  }
  if (
    (b.sceneBtnRotateXDeg ?? 0) !== 0 ||
    (b.sceneBtnRotateYDeg ?? 0) !== 0 ||
    (b.sceneBtnRotateZDeg ?? 0) !== 0
  ) {
    sceneLook.push(
      `rot ${b.sceneBtnRotateXDeg ?? 0}° / ${b.sceneBtnRotateYDeg ?? 0}° / ${b.sceneBtnRotateZDeg ?? 0}°`,
    );
  }
  if (b.sceneBtnBorderRadius?.trim()) {
    sceneLook.push(`coins ${b.sceneBtnBorderRadius.trim().slice(0, 20)}`);
  }
  const bw = b.sceneBtnBorderWidthPx;
  const bc = b.sceneBtnBorderColor?.trim();
  if (typeof bw === "number" && Number.isFinite(bw)) {
    if (bw === 0) sceneLook.push("sans bordure");
    else if (bw > 0) {
      sceneLook.push(
        `bordure ${bw}px${bc ? ` ${bc.slice(0, 18)}` : ""}`,
      );
    }
  } else if (bc) {
    sceneLook.push(`bordure 1px ${bc.slice(0, 18)}`);
  }
  if (b.isEquipment) sceneLook.push("équipement");
  const sceneLookStr = sceneLook.length ? sceneLook.join(" — ") : "";
  const suffix = [bubble, sceneNav, sceneLookStr].filter(Boolean).join(" — ");
  if (hasModalContent(b.modal)) {
    const bits: string[] = [];
    if (b.modal?.title?.trim()) bits.push("titre");
    if (b.modal?.body?.trim()) bits.push("texte");
    if (b.modal?.videoUrl?.trim()) bits.push("vidéo");
    const box = `${base} — boîte (${bits.join(", ")})`;
    return suffix ? `${box} — ${suffix}` : box;
  }
  return suffix ? `${base} — ${suffix}` : base;
}

/** Titre court pour le catalogue équipements (modale ou résumé). */
export function equipmentCatalogLabel(b: SceneInteractionButton): string {
  const t = b.modal?.title?.trim();
  if (t) return t;
  const s = interactionSummary(b);
  return s.length > 100 ? `${s.slice(0, 100)}…` : s;
}

/**
 * Libellé du bouton tel qu’affiché sur la scène (texte, libellé d’icône, alt image…).
 * Utilisé pour les lignes du menu catalogue équipements — sans privilégier le titre de la boîte modale.
 */
export function buttonMenuLabel(b: SceneInteractionButton): string {
  if (isTextButton(b)) {
    const t = b.label?.trim();
    if (t) return t;
  }
  if (isLucideButton(b)) {
    const t = b.label?.trim();
    if (t) return t;
    const icon = b.lucideIcon?.trim();
    if (icon) return icon;
  }
  if (isSvgButton(b)) {
    const t = b.label?.trim();
    if (t) return t;
  }
  if (isImageButton(b)) {
    const t = b.imageAlt?.trim();
    if (t) return t;
    const src = b.imageSrc?.trim() || "";
    if (src) {
      const base = src.split("/").pop() || src;
      return base.length > 100 ? `${base.slice(0, 100)}…` : base;
    }
  }
  const s = interactionSummary(b);
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
}

/** Colonne « zones » : libellé = titre de scène (tour) ou identifiant technique. */
export type EquipmentCatalogZoneLabelMode = "sceneTitle" | "sceneId";

/** Colonne « équipements » : libellé = fiche équipement ou nom de la scène (répété par ligne). */
export type EquipmentCatalogItemLabelMode = "equipment" | "scene";

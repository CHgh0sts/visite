/**
 * Logique krpano multires (cube) partagée entre build-tour et download.
 * Tuiles par face : ceil(taille_face / tuile), tuile par défaut 512 px (comportement krpano).
 */
export const KRPANO_FACES = ["b", "d", "f", "l", "r", "u"];

export function parseMultires(csv) {
  return csv.split(",").map((s) => parseInt(s.trim(), 10));
}

/** Dossier type panos/Micronique_1.tiles/ */
export function tilesFolderPrefix(cubeUrlTemplate) {
  const i = cubeUrlTemplate.indexOf("%");
  return i === -1 ? cubeUrlTemplate : cubeUrlTemplate.slice(0, i);
}

/**
 * Remplace les placeholders krpano dans l’URL relative.
 * Ordre important : %0v / %0h avant %v / %h.
 */
export function fillCubeTemplate(template, { face, level, v, h, grid }) {
  const padW = Math.max(1, String(grid).length);
  const pad = (n) => String(n).padStart(padW, "0");
  let s = template;
  s = s.replace(/%0v/g, pad(v));
  s = s.replace(/%0h/g, pad(h));
  s = s.replace(/%s/g, face);
  s = s.replace(/%l/g, String(level));
  s = s.replace(/%v/g, String(v));
  s = s.replace(/%h/g, String(h));
  return s;
}

export function tileGridSize(faceSizePx, tileSizePx) {
  return Math.max(1, Math.ceil(faceSizePx / tileSizePx));
}

/**
 * Liste des chemins relatifs sous le dossier .tiles (ex. b/l1/1/l1_b_1_1.jpg).
 */
export function enumerateTileRelativePaths(cubeUrlTemplate, multiresSizes, tileSizePx) {
  const paths = [];
  const prefix = tilesFolderPrefix(cubeUrlTemplate);
  const levels = multiresSizes.length;
  for (let li = 0; li < levels; li++) {
    const faceSize = multiresSizes[li];
    const grid = tileGridSize(faceSize, tileSizePx);
    const levelIndex = li + 1;
    for (const face of KRPANO_FACES) {
      for (let v = 1; v <= grid; v++) {
        for (let h = 1; h <= grid; h++) {
          const full = fillCubeTemplate(cubeUrlTemplate, {
            face,
            level: levelIndex,
            v,
            h,
            grid,
          });
          paths.push(full.slice(prefix.length));
        }
      }
    }
  }
  return paths;
}

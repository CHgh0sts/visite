/**
 * Copie un export krpano complet (dossier contenant panos/) vers
 * public/images/panorama/[scene_id]/ en suivant tour.json.
 *
 * Usage:
 *   KRPANO_EXPORT_DIR=/chemin/vers/krpano node scripts/import-krpano-from-folder.mjs
 *
 * KRPANO_EXPORT_DIR doit contenir par ex. panos/Micronique_1.tiles/preview.jpg
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { tilesFolderPrefix } from "./krpano-tiles-shared.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const tourPath = path.join(root, "src", "data", "tour.json");
const destRoot = path.join(root, "public", "images", "panorama");

const exportDir = process.env.KRPANO_EXPORT_DIR;
if (!exportDir) {
  console.error(
    "Définissez KRPANO_EXPORT_DIR=/chemin/vers/le/dossier/krpano (avec sous-dossier panos/).",
  );
  process.exit(1);
}
if (!fs.existsSync(exportDir)) {
  console.error(`Dossier introuvable : ${exportDir}`);
  process.exit(1);
}

function copyDirContents(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (name === ".DS_Store") continue;
    const s = path.join(src, name);
    const d = path.join(dest, name);
    const st = fs.statSync(s);
    if (st.isDirectory()) copyDirContents(s, d);
    else fs.copyFileSync(s, d);
  }
}

const tour = JSON.parse(fs.readFileSync(tourPath, "utf8"));
let copied = 0;
let missing = 0;

for (const scene of tour.scenes) {
  const k = scene.krpanoCube;
  if (!k) continue;
  const prefix = tilesFolderPrefix(k.cubeUrlTemplate).replace(/\/$/, "");
  const srcTiles = path.join(exportDir, ...prefix.split("/"));
  const destScene = path.join(destRoot, scene.id);

  if (!fs.existsSync(srcTiles)) {
    console.warn(`[manquant] ${scene.id} ← ${srcTiles}`);
    missing++;
    continue;
  }
  copyDirContents(srcTiles, destScene);
  console.log(`[ok] ${scene.id} ← ${prefix}`);
  copied++;
}

console.log(
  `\n${copied} scène(s) copiée(s) vers ${destRoot}` +
    (missing ? `, ${missing} dossier(s) source absents.` : "."),
);

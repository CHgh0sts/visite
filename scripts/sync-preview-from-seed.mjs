/**
 * Copie public/panoramas/[id].jpg → public/images/panorama/[id]/preview.jpg
 * pour développer sans télécharger toutes les tuiles krpano.
 *
 * Usage: node scripts/sync-preview-from-seed.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const tourPath = path.join(root, "src", "data", "tour.json");
const fromDir = path.join(root, "public", "panoramas");
const toRoot = path.join(root, "public", "images", "panorama");

const tour = JSON.parse(fs.readFileSync(tourPath, "utf8"));
let n = 0;
for (const scene of tour.scenes) {
  const src = path.join(fromDir, scene.panoramaFile);
  if (!fs.existsSync(src)) continue;
  const destDir = path.join(toRoot, scene.id);
  const dest = path.join(destDir, "preview.jpg");
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  n++;
  console.log(`${scene.id} ← ${scene.panoramaFile}`);
}
console.log(`\n${n} preview(s) copiée(s) sous ${toRoot}`);

/**
 * Télécharge une image équirectangulaire de démo puis la copie pour chaque scène
 * (remplacez par les preview.jpg exportés depuis krpano si vous les avez en local).
 *
 * Usage: node scripts/seed-panoramas.mjs
 */
import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const tourPath = path.join(root, "src", "data", "tour.json");
const panoDir = path.join(root, "public", "panoramas");

const DEMO_PANO_URL =
  process.env.PANO_SEED_URL || "https://pannellum.org/images/alma.jpg";

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location;
          if (!loc) {
            reject(new Error("Redirect without location"));
            return;
          }
          download(loc, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", reject);
  });
}

async function main() {
  const tour = JSON.parse(fs.readFileSync(tourPath, "utf8"));
  fs.mkdirSync(panoDir, { recursive: true });
  const template = path.join(panoDir, "_seed.jpg");
  if (!fs.existsSync(template)) {
    console.log(`Téléchargement: ${DEMO_PANO_URL}`);
    await download(DEMO_PANO_URL, template);
  }
  for (const s of tour.scenes) {
    const dest = path.join(panoDir, s.panoramaFile);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(template, dest);
    }
  }
  console.log(
    `Panoramas prêts dans public/panoramas (${tour.scenes.length} fichiers).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

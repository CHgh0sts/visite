/**
 * Télécharge preview.jpg, thumb.jpg et toutes les tuiles cube multires depuis une base HTTP
 * vers public/images/panorama/[scene_micronique_X]/ (même arborescence que sous .tiles/).
 *
 * Usage:
 *   KRPANO_BASE_URL=https://exemple.com/krpano/ node scripts/download-krpano-tiles.mjs
 *   KRPANO_BASE_URLS="https://a/krpano/,https://b/krpano/" node scripts/download-krpano-tiles.mjs
 *   node scripts/download-krpano-tiles.mjs --scene=scene_micronique_1
 *   node scripts/download-krpano-tiles.mjs --skip-probe   (tente quand même si la sonde échoue)
 *
 * Important : sur https://micronique.juumo.fr/krpano/ le tour.xml et le skin sont servis,
 * mais les JPG sous panos/ (tuiles) renvoient 404 — ce déploiement ne contient pas les images.
 * Dans ce cas : export krpano local + npm run import:krpano
 */
import fs from "fs";
import https from "https";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import {
  enumerateTileRelativePaths,
  tilesFolderPrefix,
} from "./krpano-tiles-shared.mjs";
import { probeUrl } from "./krpano-probe-remote.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const tourPath = path.join(root, "src", "data", "tour.json");
const publicPanoramaRoot = path.join(root, "public", "images", "panorama");

const DEFAULT_BASE = "https://micronique.juumo.fr/krpano/";
const TILE_SIZE = parseInt(process.env.KRPANO_TILE_SIZE || "512", 10);
const CONCURRENCY = parseInt(process.env.KRPANO_DL_CONCURRENCY || "4", 10);

const sceneFilter = process.argv.find((a) => a.startsWith("--scene="))?.split("=")[1];
const skipProbe = process.argv.includes("--skip-probe");

function candidateBases() {
  const fromEnv = process.env.KRPANO_BASE_URLS || process.env.KRPANO_BASE_URL;
  if (fromEnv && fromEnv.includes(",")) {
    return fromEnv.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (fromEnv) return [fromEnv.endsWith("/") ? fromEnv : `${fromEnv}/`];
  return [DEFAULT_BASE];
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib
      .get(url, { headers: { "user-agent": "visite-micronique-downloader/1.0" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location;
          if (!loc) {
            reject(new Error("Redirect sans Location"));
            return;
          }
          const next = new URL(loc, url).href;
          fetchBuffer(next).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

async function downloadToFile(url, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const buf = await fetchBuffer(url);
  fs.writeFileSync(destPath, buf);
}

function printBlockedMessage(probeTarget, status) {
  console.error(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Impossible de récupérer les images depuis cette URL HTTP.
  Test : ${probeTarget}
  Réponse : ${status ?? "erreur réseau"}

  Sur micronique.juumo.fr, seuls tour.xml et skin/ sont déployés en public.
  Les chemins panos/Micronique_*.tiles/*.jpg ne sont pas servis (404).

  Pour avoir toutes les tuiles en local :
  1) Récupérer le dossier krpano complet (panos/) auprès de JUUMO / le projet source.
  2) Puis :
     KRPANO_EXPORT_DIR=/chemin/vers/krpano npm run import:krpano

  Pour forcer un téléchargement HTTP malgré la sonde :
     npm run download:tiles -- --skip-probe
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

async function pickWorkingBase(tour) {
  const bases = candidateBases();
  const firstScene = tour.scenes.find((s) => s.previewRelative);
  const rel = firstScene?.previewRelative || "panos/Micronique_1.tiles/preview.jpg";

  for (const b of bases) {
    const base = b.endsWith("/") ? b : `${b}/`;
    const url = new URL(rel, base).href;
    const r = await probeUrl(url);
    if (r.ok) {
      console.log(`Sonde OK : ${url}\n`);
      return base;
    }
    console.log(`Sonde échouée (${r.statusCode ?? "?"}): ${url}`);
  }
  const lastTry = new URL(rel, bases[bases.length - 1].endsWith("/") ? bases[bases.length - 1] : `${bases[bases.length - 1]}/`).href;
  printBlockedMessage(lastTry, "≠ 200");
  return null;
}

async function main() {
  const tour = JSON.parse(fs.readFileSync(tourPath, "utf8"));

  let base = candidateBases()[0];
  if (!skipProbe) {
    const picked = await pickWorkingBase(tour);
    if (!picked) process.exit(1);
    base = picked;
  } else {
    const b = candidateBases()[0];
    base = b.endsWith("/") ? b : `${b}/`;
    console.warn("Sonde ignorée (--skip-probe), utilisation de :", base);
  }

  let scenes = tour.scenes;
  if (sceneFilter) {
    scenes = scenes.filter((s) => s.id === sceneFilter);
    if (scenes.length === 0) {
      console.error(`Scène inconnue: ${sceneFilter}`);
      process.exit(1);
    }
  }

  let ok = 0;
  let fail = 0;

  for (const scene of scenes) {
    const outDir = path.join(publicPanoramaRoot, scene.id);
    const k = scene.krpanoCube;
    if (!k) {
      console.warn(`[skip] ${scene.id} : pas de cube dans tour.json`);
      continue;
    }

    const relTiles = enumerateTileRelativePaths(
      k.cubeUrlTemplate,
      k.multires,
      TILE_SIZE,
    );
    const prefix = tilesFolderPrefix(k.cubeUrlTemplate);

    function relUnderTiles(absPath) {
      if (!absPath || !absPath.startsWith(prefix)) return null;
      return absPath.slice(prefix.length);
    }

    const extra = [];
    const pr = relUnderTiles(scene.previewRelative);
    const tr = relUnderTiles(scene.thumbRelative);
    if (pr) extra.push(pr);
    if (tr) extra.push(tr);

    const relPaths = [...new Set([...extra, ...relTiles])];

    console.log(`\n${scene.id} : ${relPaths.length} fichiers (dont preview/thumb + tuiles)`);

    const tasks = relPaths.map((rel) => {
      const remoteUrl = new URL(prefix + rel, base).href;
      const localPath = path.join(outDir, rel.split("/").join(path.sep));
      return { remoteUrl, localPath, rel };
    });

    for (let i = 0; i < tasks.length; i += CONCURRENCY) {
      const batch = tasks.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (task) => {
          try {
            await downloadToFile(task.remoteUrl, task.localPath);
            ok++;
            process.stdout.write(".");
          } catch {
            fail++;
            process.stdout.write("x");
          }
        }),
      );
    }
    console.log("");
  }

  console.log(`\nTerminé : ${ok} OK, ${fail} échecs (souvent 404 si panos non servis publiquement).`);
  console.log(`Dossier : ${publicPanoramaRoot}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Parse data/tour.xml (krpano) → src/data/tour.json
 * Run: node scripts/build-tour.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const xmlPath = path.join(root, "data", "tour.xml");
const outPath = path.join(root, "src", "data", "tour.json");

function getAttr(str, name) {
  const m = str.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : undefined;
}

function parseSceneBlock(block) {
  const id = getAttr(block.split(">")[0] + ">", "name");
  if (!id || id === "scene_hi_") return null;
  if (!id.startsWith("scene_micronique")) return null;

  const title = getAttr(block, "title") || id;
  const thumbRel = getAttr(block, "thumburl");
  const previewM = block.match(/<preview\s+url="([^"]+)"/);
  const previewRel = previewM ? previewM[1] : null;

  const cubeM = block.match(
    /<cube\s+url="([^"]+)"\s+multires="([^"]+)"\s*\/>/,
  );
  let krpanoCube = null;
  if (cubeM) {
    const multires = cubeM[2].split(",").map((s) => parseInt(s.trim(), 10));
    krpanoCube = {
      cubeUrlTemplate: cubeM[1],
      multires,
    };
  }

  const hotspots = [];
  const lines = block.split("\n");
  for (const line of lines) {
    if (!line.includes("<hotspot")) continue;
    if (!line.includes('onclick="loadscene')) continue;
    const ath = getAttr(line, "ath");
    const atv = getAttr(line, "atv");
    const linked = getAttr(line, "linkedscene");
    const hname = getAttr(line, "name");
    if (!linked || !ath || !atv) continue;
    if (!linked.startsWith("scene_micronique")) continue;
    hotspots.push({
      id: `${id}__${hname}`,
      name: hname,
      ath: parseFloat(ath, 10),
      atv: parseFloat(atv, 10),
      targetSceneId: linked,
    });
  }

  /** Panorama équirectangulaire : preview krpano dans /images/panorama/[id]/ */
  const panoramaPreviewUrl = `/images/panorama/${id}/preview.jpg`;

  return {
    id,
    title,
    thumbRelative: thumbRel || null,
    previewRelative: previewRel,
    krpanoCube,
    panoramaPreviewUrl,
    /** Fallback si preview pas encore téléchargée (seed) */
    panoramaFile: `${id}.jpg`,
    hotspots,
  };
}

const xml = fs.readFileSync(xmlPath, "utf8");
const sceneBlocks = xml.split(/(?=<scene\s+)/).filter((b) => b.startsWith("<scene"));

const scenes = [];
for (const block of sceneBlocks) {
  const s = parseSceneBlock(block);
  if (s) scenes.push(s);
}

const tour = {
  meta: {
    source: "https://micronique.juumo.fr/krpano/tour.xml",
    krpanoBasePath: "/krpano",
    defaultSceneId: "scene_micronique_1",
    credit: "Développé par Guillaume Ducuing — https://meetguillaume.dev",
    panoramaImagesBase: "/images/panorama",
    krpanoTileSizePx: 512,
  },
  scenes,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(tour, null, 2), "utf8");
console.log(`Wrote ${scenes.length} scenes → ${outPath}`);

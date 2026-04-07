/**
 * Génère `public/krpano-patches/tour-vr-bottombar-generated.xml` depuis `src/data/scene-nav.json`.
 * Barre bas VR alignée sur SceneNavBar (mêmes icônes + navigation vers sceneId).
 * À lancer après modification de scene-nav.json : `node scripts/generate-krpano-vr-bottombar.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const navPath = path.join(root, "src", "data", "scene-nav.json");
const outPath = path.join(
  root,
  "public",
  "krpano-patches",
  "tour-vr-bottombar-generated.xml",
);

function escapeXmlAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** Espace → %20 uniquement — ne pas altérer tirets / caractères Unicode des noms de fichiers. */
function encodeIconUrlForXml(url) {
  const u = String(url).trim();
  return escapeXmlAttr(u.replace(/ /g, "%20"));
}

function escapeSceneIdForJscall(id) {
  return String(id).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

const raw = JSON.parse(fs.readFileSync(navPath, "utf8"));
const items = (raw.items ?? []).filter(
  (i) =>
    i.sceneId?.trim() &&
    i.label?.trim() &&
    typeof i.iconUrl === "string" &&
    i.iconUrl.trim().length > 0,
);

const n = items.length;
const athMin = -48;
const athMax = 48;
const atv = 58;
const lines = [];
lines.push(`<!-- Généré par scripts/generate-krpano-vr-bottombar.mjs — ne pas éditer -->`);
lines.push(`<krpano>`);
lines.push(
  `\t<style name="react_vr_bottombar_style" torigin="view" depth="1000" distorted="true" atv="${atv}" scale="0.36" alpha="0.92" />`,
);

for (let i = 0; i < n; i++) {
  const ath =
    n === 1 ? 0 : athMin + (i * (athMax - athMin)) / (n - 1);
  const sceneId = items[i].sceneId.trim();
  const iconUrl = encodeIconUrlForXml(items[i].iconUrl.trim());
  const sid = escapeSceneIdForJscall(sceneId);
  lines.push(
    `\t<hotspot name="react_vr_nav_${i}" keep="true" style="react_vr_bottombar_style" type="image" devices="webgl"`,
  );
  lines.push(`\t\turl="${iconUrl}"`);
  lines.push(`\t\tath="${ath.toFixed(3)}"`);
  lines.push(`\t\twidth="56" height="56"`);
  lines.push(
    `\t\tvr_timeout="750" onclick="jscall(reactKrpano.vrNavigateToScene('${sid}'));"`,
  );
  lines.push(`\t\tvisible="true" enabled="true" />`);
}

lines.push(`</krpano>`);
lines.push("");

fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`Wrote ${outPath} (${n} items)`);

/**
 * Génère `public/krpano-patches/tour-vr-bottombar-generated.xml` depuis `src/data/scene-nav.json`.
 * Un hotspot image par bouton (SVG dans public/images/navbar/vr/ — rendu type navbar 2D).
 * Pas de segments blancs séparés : la courbure vient du placement sphérique (ath).
 *
 * Usage : `node scripts/generate-krpano-vr-bottombar.mjs`
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

function iconUrlForVrHotspot(url) {
  const u = String(url).trim();
  const prefix = "/images/navbar/";
  if (!u.startsWith(prefix)) return u;
  const rest = u.slice(prefix.length);
  if (rest.startsWith("vr/")) return u;
  return prefix + "vr/" + rest;
}

function encodeIconUrlForXml(url) {
  return escapeXmlAttr(String(url).trim().replace(/ /g, "%20"));
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
/** Écart angulaire entre chaque bouton (plus grand = plus d’espace). */
const SPACING_DEG = 12;
const totalSpan = (n - 1) * SPACING_DEG;
const startAth = -totalSpan / 2;

const DEPTH = 1000;
const ICON_ATV = 26;

const ICON_W = 100;
const ICON_H = 132;

const L = [];
const allNames = [];

L.push(`<!-- Généré par scripts/generate-krpano-vr-bottombar.mjs — ne pas éditer manuellement -->`);
L.push(`<krpano>`);

for (let i = 0; i < n; i++) {
  const item = items[i];
  const sid = escapeSceneIdForJscall(item.sceneId.trim());
  const iconUrl = encodeIconUrlForXml(iconUrlForVrHotspot(item.iconUrl));
  const label = escapeXmlAttr(item.label.trim());
  const ath = (startAth + i * SPACING_DEG).toFixed(1);

  const iconName = `react_vr_nav_${i}`;
  allNames.push(iconName);

  L.push(``);
  L.push(`\t<!-- ${label} -->`);

  L.push(`\t<hotspot name="${iconName}" keep="true" vr="true" devices="webgl"`);
  L.push(`\t\ttype="image" ath="${ath}" atv="${ICON_ATV}" depth="${DEPTH}"`);
  L.push(`\t\turl="${iconUrl}"`);
  L.push(`\t\twidth="${ICON_W}" height="${ICON_H}" bgalpha="0"`);
  L.push(`\t\tzorder="20"`);
  L.push(`\t\tonclick="jscall(reactKrpano.vrNavigateToScene('${sid}'));"`);
  L.push(`\t\tenabled="false" visible="false" />`);
}

L.push(``);
L.push(`\t<!-- ═══════ Visibilité (JS : syncKrpanoVrNavbarVisibility) ═══════ -->`);
L.push(`\t<action name="react_vr_navbar_set_visibility" scope="local" args="v">`);

const show = allNames.map((h) => `\t\t\tset(hotspot[${h}].visible, true); set(hotspot[${h}].enabled, true);`).join("\n");
const hide = allNames.map((h) => `\t\t\tset(hotspot[${h}].visible, false); set(hotspot[${h}].enabled, false);`).join("\n");

L.push(`\t\tif(v == 1,`);
L.push(show);
L.push(`\t\t  ,`);
L.push(hide);
L.push(`\t\t);`);
L.push(`\t</action>`);

L.push(`</krpano>`);
L.push("");

fs.writeFileSync(outPath, L.join("\n"), "utf8");
console.log(`✓ ${outPath}\n  ${n} hotspots image (style navbar 2D, courbure ath)`);

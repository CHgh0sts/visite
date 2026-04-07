/**
 * Génère `public/krpano-patches/tour-vr-bottombar-generated.xml` depuis `src/data/scene-nav.json`.
 * Couches 2D (parent react_vr_nav_icons_row) : menu + recherche (sprites skin) + icônes zones (SVG).
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

/** Espace → %20 uniquement */
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
const menuW = 9;
const searchW = 9;
const gapAfterSearch = 2;
const startNavPct = menuW + searchW + gapAfterSearch;
const navW = n > 0 ? (100 - startNavPct) / n : 0;

const lines = [];
lines.push(`<!-- Généré par scripts/generate-krpano-vr-bottombar.mjs — ne pas éditer -->`);
lines.push(`<krpano>`);

/** Même sprite que la barre bas VT (style skin_base + crop) */
lines.push(
  `\t<layer name="react_vr_nav_menu_btn" keep="true" parent="react_vr_nav_icons_row" type="image" devices="webgl"`,
);
lines.push(`\t\tstyle="skin_base" crop="0|128|64|64" align="lefttop" edge="left" x="0%" y="8%"`);
lines.push(
  `\t\twidth="${menuW}%" height="84%" scalechildren="true" bgalpha="0"`,
);
lines.push(
  `\t\tonclick="jscall(reactKrpano.vrToggleMenu());" enabled="true" visible="true" />`,
);

lines.push(
  `\t<layer name="react_vr_nav_search_btn" keep="true" parent="react_vr_nav_icons_row" type="image" devices="webgl"`,
);
lines.push(`\t\tstyle="skin_base" crop="64|128|64|64" align="lefttop" edge="left" x="${menuW}%" y="8%"`);
lines.push(
  `\t\twidth="${searchW}%" height="84%" scalechildren="true" bgalpha="0"`,
);
lines.push(
  `\t\tonclick="jscall(reactKrpano.vrToggleSearch());" enabled="true" visible="true" />`,
);

for (let i = 0; i < n; i++) {
  const sceneId = items[i].sceneId.trim();
  const iconUrl = encodeIconUrlForXml(items[i].iconUrl.trim());
  const sid = escapeSceneIdForJscall(sceneId);
  const left = startNavPct + i * navW;
  const w = Math.max(4, navW - 0.8);
  lines.push(
    `\t<layer name="react_vr_nav_${i}" keep="true" parent="react_vr_nav_icons_row" type="image" devices="webgl"`,
  );
  lines.push(`\t\turl="${iconUrl}" align="lefttop" edge="left" x="${left.toFixed(2)}%" y="6%"`);
  lines.push(
    `\t\twidth="${w.toFixed(2)}%" height="88%" scalechildren="true" bgalpha="0"`,
  );
  lines.push(
    `\t\tonclick="jscall(reactKrpano.vrNavigateToScene('${sid}'));" enabled="true" visible="true" />`,
  );
}

lines.push(`</krpano>`);
lines.push("");

fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`Wrote ${outPath} (menu+search + ${n} zones)`);

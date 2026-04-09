/**
 * Génère `public/krpano-patches/tour-vr-bottombar-generated.xml` depuis `src/data/scene-nav.json`.
 *
 * - Un seul point (ath, atv) pour fond + icônes scène ; décalages horizontaux en `ox` (px).
 * - **Monde fixe** : `react_vr_followbar_sync` n’est appelé qu’à l’affichage de la barre (+ delayedcall),
 *   pas à chaque mouvement de caméra. Une fois les ath/atv posés, la barre reste fixe dans la scène ;
 *   le calcul initial utilise le bas de l’écran (screentosphere, moyenne SBS si dispo) pour un bon placement.
 *
 * Fond pilule blanc : image `vr-bottombar-bg.svg`, dimensions dans `tour.xml` (`react_vr_bottombar_panel`).
 *
 * À lancer : `node scripts/generate-krpano-vr-bottombar.mjs`
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

const BAR_W = 780;
/** Dock (même hauteur que `vr-bottombar-bg.svg` + hotspot panel dans tour.xml). */
const BAR_H = 96;
const PAD_X = 20;
const GAP_NAV_ICONS = 8;
/** Réduction légère vs 60 px (largeur des slots inchangée, hotspots plus petits, centrés). */
const ICON_SIZE_MUL = 0.9;
const ICON_ROW_H = Math.round(60 * ICON_SIZE_MUL);
const BAR_ATH = 0;
/** krpano : oy positif = vers le bas ; edge=bottom + même ath/atv que le fond → oy négatif pour remonter dans la pilule. */
const oyIcon = -Math.round((BAR_H - ICON_ROW_H) / 2);

function oxFromBarCenter(centerFromBarLeft) {
  return Math.round(centerFromBarLeft - BAR_W * 0.5);
}

function escapeXmlAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
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

const navZoneLeft = PAD_X;
const navZoneRight = BAR_W - PAD_X;
const navZoneW = Math.max(0, navZoneRight - navZoneLeft);
const navWpx =
  n > 0
    ? Math.max(1, Math.floor((navZoneW - (n - 1) * GAP_NAV_ICONS) / n))
    : 0;

const iconCentersFromBarLeft = [];
for (let i = 0; i < n; i++) {
  const slotLeft = navZoneLeft + i * (navWpx + GAP_NAV_ICONS);
  iconCentersFromBarLeft.push(slotLeft + navWpx * 0.5);
}

const oxIcons = iconCentersFromBarLeft.map((cx) => oxFromBarCenter(cx));

const hs = [];

for (let i = 0; i < n; i++) {
  const sceneId = items[i].sceneId.trim();
  const iconUrl = encodeIconUrlForXml(items[i].iconUrl.trim());
  const sid = escapeSceneIdForJscall(sceneId);
  const wi = Math.max(1, Math.floor(navWpx * ICON_SIZE_MUL));
  const oxi = oxIcons[i];
  hs.push(`\t<hotspot name="react_vr_nav_${i}" keep="true" type="image"`);
  hs.push(`\t\turl="${iconUrl}"`);
  hs.push(
    `\t\tdistorted="true" renderer="webgl" depth="1000" depthbuffer="false"`,
  );
  hs.push(
    `\t\ttorigin="world" ath="0" atv="0" edge="bottom" align="center" ox="${oxi}" oy="${oyIcon}"`,
  );
  hs.push(`\t\twidth="${wi}" height="${ICON_ROW_H}" scale="1" zoom="false"`);
  hs.push(
    `\t\tvr_timeout="750" zorder="101" capture="true" handcursor="true"`,
  );
  hs.push(
    `\t\tonclick="jscall(reactKrpano.vrNavigateToScene('${sid}'));" enabled="true" visible="true" />`,
  );
}

const MARGIN_BOTTOM = 14;

const js = [];
js.push(`\t<action name="react_vr_followbar_sync" type="Javascript"><![CDATA[`);
js.push(`\t\tvar k = krpano;`);
js.push(`\t\tif (k.get("webvr.isenabled") != true) return;`);
js.push(`\t\tif (k.get("hotspot[react_vr_bottombar_panel].visible") != true) return;`);
js.push(`\t\tvar sw = Number(k.get("stagewidth")) || 0;`);
js.push(`\t\tvar sh = Number(k.get("stageheight")) || 0;`);
js.push(`\t\tif (sw < 8 || sh < 8) return;`);
js.push(`\t\tif (typeof k.screentosphere != "function") return;`);
js.push(`\t\tvar baseY = sh - ${MARGIN_BOTTOM};`);
js.push(`\t\tvar stL = k.screentosphere(sw * 0.25, baseY);`);
js.push(`\t\tvar stR = k.screentosphere(sw * 0.75, baseY);`);
js.push(`\t\tvar baseAth, atv;`);
js.push(`\t\tif (stL && stR && !isNaN(stL.x) && !isNaN(stR.x) && !isNaN(stL.y) && !isNaN(stR.y)) {`);
js.push(`\t\t\tbaseAth = (stL.x + stR.x) * 0.5 + ${BAR_ATH};`);
js.push(`\t\t\tatv = (stL.y + stR.y) * 0.5;`);
js.push(`\t\t} else {`);
js.push(`\t\t\tvar stRef = k.screentosphere(sw * 0.5, baseY);`);
js.push(`\t\t\tif (!stRef) return;`);
js.push(`\t\t\tbaseAth = stRef.x + ${BAR_ATH};`);
js.push(`\t\t\tatv = stRef.y;`);
js.push(`\t\t}`);
js.push(`\t\tfunction placeHS(name) {`);
js.push(`\t\t\tvar h = k.get("hotspot[" + name + "]");`);
js.push(`\t\t\tif (h) { h.ath = baseAth; h.atv = atv; }`);
js.push(`\t\t}`);
js.push(`\t\tplaceHS("react_vr_bottombar_panel");`);
for (let i = 0; i < n; i++) {
  js.push(`\t\tplaceHS("react_vr_nav_${i}");`);
}
js.push(`\t]]></action>`);

const visOn = [
  `\t<action name="react_vr_navbar_set_visibility_children" scope="local" args="v">`,
];
for (let i = 0; i < n; i++) {
  visOn.push(`\t\tset(hotspot[react_vr_nav_${i}].visible, get(v));`);
  visOn.push(`\t\tset(hotspot[react_vr_nav_${i}].enabled, get(v));`);
}
visOn.push(`\t</action>`);

const visMain = [
  `\t<action name="react_vr_navbar_set_visibility" scope="local" args="v">`,
  `\t\tif(v == 1,`,
  `\t\t\tset(hotspot[react_vr_bottombar_panel].visible, true);`,
  `\t\t\tset(hotspot[react_vr_bottombar_panel].enabled, true);`,
  `\t\t\treact_vr_navbar_set_visibility_children(1);`,
  `\t\t\treact_vr_followbar_sync();`,
  `\t\t\tdelayedcall(0.2, react_vr_followbar_sync());`,
  `\t\t\tdelayedcall(0.5, react_vr_followbar_sync());`,
  `\t\t  ,`,
  `\t\t\tset(hotspot[react_vr_bottombar_panel].visible, false);`,
  `\t\t\tset(hotspot[react_vr_bottombar_panel].enabled, false);`,
  `\t\t\treact_vr_navbar_set_visibility_children(0);`,
  `\t\t);`,
  `\t</action>`,
];

const lines = [];
lines.push(`<!-- Généré par scripts/generate-krpano-vr-bottombar.mjs — ne pas éditer -->`);
lines.push(`<krpano>`);
lines.push(...hs);
lines.push(...js);
lines.push(...visOn);
lines.push(...visMain);
lines.push(`</krpano>`);
lines.push("");

fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`Wrote ${outPath} (${n} icônes, fond dans tour.xml)`);

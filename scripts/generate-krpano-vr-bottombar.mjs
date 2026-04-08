/**
 * Génère `public/krpano-patches/tour-vr-bottombar-generated.xml` depuis `src/data/scene-nav.json`.
 *
 * - **atv** : issu de `screentosphere(cx, baseY)` une fois — bas d’écran (comme avant).
 * - **ath** : **monde fixe**, ne suit pas le lacet : `BAR_ATH + pxFromBarCenterToAthDeg(offset depuis le centre barre)`.
 *   (Si tout l’ath venait de screentosphere par colonne, la barre collait au regard → suivi horizontal.)
 *
 * Hotspots WebGL dans la scène (`distorted` + `renderer="webgl"`).
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
/** Même échelle que l’ancien layout distordu : ~1000 px ≈ 90° en horizontal. */
const LAYOUT_W_REF = 1000;
const MENU_BTN_W = 90;
const SEARCH_BTN_W = 90;
const gapAfterSearch = 2;
const gapPx = Math.round((gapAfterSearch / 100) * BAR_W);
/** Longitude monde (°) du centre de la barre ; ajuster pour orienter la barre dans la scène. */
const BAR_ATH = 0;

function pxFromBarCenterToAthDeg(pxFromBarCenter) {
  return (pxFromBarCenter / LAYOUT_W_REF) * 90;
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
const navStartX = MENU_BTN_W + SEARCH_BTN_W + gapPx;
const navTotalW = Math.max(0, BAR_W - navStartX);
const navWpx = n > 0 ? Math.floor(navTotalW / n) : 0;

const hs = [];

hs.push(
  `\t<hotspot name="react_vr_nav_menu_btn" keep="true" type="image"`,
);
hs.push(`\t\tstyle="skin_base" crop="0|128|64|64"`);
hs.push(
  `\t\tdistorted="true" renderer="webgl" depth="1000" depthbuffer="false"`,
);
hs.push(
  `\t\ttorigin="world" ath="0" atv="0" edge="bottom" align="center" ox="0" oy="0"`,
);
hs.push(
  `\t\twidth="${MENU_BTN_W}" height="92" scale="1" zoom="false"`,
);
hs.push(
  `\t\tvr_timeout="750" zorder="101" capture="true" handcursor="true"`,
);
hs.push(
  `\t\tonclick="jscall(reactKrpano.vrToggleMenu());" enabled="true" visible="true" />`,
);

hs.push(
  `\t<hotspot name="react_vr_nav_search_btn" keep="true" type="image"`,
);
hs.push(`\t\tstyle="skin_base" crop="64|128|64|64"`);
hs.push(
  `\t\tdistorted="true" renderer="webgl" depth="1000" depthbuffer="false"`,
);
hs.push(
  `\t\ttorigin="world" ath="0" atv="0" edge="bottom" align="center" ox="0" oy="0"`,
);
hs.push(
  `\t\twidth="${SEARCH_BTN_W}" height="92" scale="1" zoom="false"`,
);
hs.push(
  `\t\tvr_timeout="750" zorder="101" capture="true" handcursor="true"`,
);
hs.push(
  `\t\tonclick="jscall(reactKrpano.vrToggleSearch());" enabled="true" visible="true" />`,
);

for (let i = 0; i < n; i++) {
  const sceneId = items[i].sceneId.trim();
  const iconUrl = encodeIconUrlForXml(items[i].iconUrl.trim());
  const sid = escapeSceneIdForJscall(sceneId);
  const wi = navWpx;
  hs.push(`\t<hotspot name="react_vr_nav_${i}" keep="true" type="image"`);
  hs.push(`\t\turl="${iconUrl}"`);
  hs.push(
    `\t\tdistorted="true" renderer="webgl" depth="1000" depthbuffer="false"`,
  );
  hs.push(
    `\t\ttorigin="world" ath="0" atv="0" edge="bottom" align="center" ox="0" oy="0"`,
  );
  hs.push(`\t\twidth="${wi}" height="88" scale="1" zoom="false"`);
  hs.push(
    `\t\tvr_timeout="750" zorder="101" capture="true" handcursor="true"`,
  );
  hs.push(
    `\t\tonclick="jscall(reactKrpano.vrNavigateToScene('${sid}'));" enabled="true" visible="true" />`,
  );
}

/** Pixels depuis le bord gauche de la barre : centre de chaque contrôle. */
const barCenterX = BAR_W * 0.5;
const menuCenterFromBarLeft = MENU_BTN_W * 0.5;
const searchCenterFromBarLeft = MENU_BTN_W + SEARCH_BTN_W * 0.5;
const iconCentersFromBarLeft = [];
let xWalk = navStartX;
for (let i = 0; i < n; i++) {
  iconCentersFromBarLeft.push(xWalk + navWpx * 0.5);
  xWalk += navWpx;
}

/** Offset ° monde depuis le centre barre (BAR_ATH). */
const athOffPanel = pxFromBarCenterToAthDeg(0);
const athOffMenu = pxFromBarCenterToAthDeg(menuCenterFromBarLeft - barCenterX);
const athOffSearch = pxFromBarCenterToAthDeg(searchCenterFromBarLeft - barCenterX);
const athOffIcons = iconCentersFromBarLeft.map((cx) =>
  pxFromBarCenterToAthDeg(cx - barCenterX),
);

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
js.push(`\t\tvar cx = sw * 0.5;`);
js.push(`\t\tvar baseY = sh - ${MARGIN_BOTTOM};`);
js.push(`\t\tvar stRef = k.screentosphere(cx, baseY);`);
js.push(`\t\tif (!stRef) return;`);
js.push(`\t\tvar atv = stRef.y;`);
js.push(`\t\tvar baseAth = ${BAR_ATH};`);
js.push(`\t\tfunction placeHS(name, athOff) {`);
js.push(`\t\t\tvar h = k.get("hotspot[" + name + "]");`);
js.push(`\t\t\tif (h) { h.ath = baseAth + athOff; h.atv = atv; }`);
js.push(`\t\t}`);
js.push(`\t\tplaceHS("react_vr_bottombar_panel", ${athOffPanel.toFixed(6)});`);
js.push(`\t\tplaceHS("react_vr_nav_menu_btn", ${athOffMenu.toFixed(6)});`);
js.push(`\t\tplaceHS("react_vr_nav_search_btn", ${athOffSearch.toFixed(6)});`);
for (let i = 0; i < n; i++) {
  js.push(
    `\t\tplaceHS("react_vr_nav_${i}", ${athOffIcons[i].toFixed(6)});`,
  );
}
js.push(`\t]]></action>`);

const visOn = [
  `\t<action name="react_vr_navbar_set_visibility_children" scope="local" args="v">`,
  `\t\tset(hotspot[react_vr_nav_menu_btn].visible, get(v));`,
  `\t\tset(hotspot[react_vr_nav_menu_btn].enabled, get(v));`,
  `\t\tset(hotspot[react_vr_nav_search_btn].visible, get(v));`,
  `\t\tset(hotspot[react_vr_nav_search_btn].enabled, get(v));`,
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
console.log(
  `Wrote ${outPath} (atv=screentosphere, ath=monde+offset, ${n} zones)`,
);

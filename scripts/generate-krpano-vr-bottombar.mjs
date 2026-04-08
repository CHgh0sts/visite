/**
 * Génère `public/krpano-patches/tour-vr-bottombar-generated.xml` + assets PNG
 * depuis `src/data/scene-nav.json` (même logique que `SceneNavBar` : loadscene vers `sceneId`).
 *
 * Placement VR :
 *   - Horizontal **fixe** : capturé une seule fois (`view.hlookat` à l'entrée VR).
 *   - Vertical **parallaxe** : suit `view.vlookat` avec un facteur < 1.
 *   - Fond = **hotspot polygonal** (fillcolor) dont les sommets sont sur la sphère
 *     → même courbure que les icônes, pas de texture plate qui diverge aux bords.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const sceneNavPath = path.join(root, "src", "data", "scene-nav.json");
const outXmlPath = path.join(
  root,
  "public",
  "krpano-patches",
  "tour-vr-bottombar-generated.xml",
);
const patchesDir = path.join(root, "public", "krpano-patches");
const iconsOutDir = path.join(patchesDir, "vr-nav-icons");

function xmlEscapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");
}

function escapeSceneIdForKrpano(s) {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function rasterizeNavIcon(svgAbsPath, outPngPath) {
  const buf = await fs.promises.readFile(svgAbsPath);
  await sharp(buf, {
    density: 120,
    limitInputPixels: false,
  })
    .resize(96, 96, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outPngPath);
}

/**
 * Génère les sommets du polygone (offsets en ° depuis l'ancre).
 * Rectangle arrondi : arcs aux 4 coins + segments droits haut/bas.
 */
function buildPolyOffsets(athMin, athMax, halfH, cornerR, cornerSteps) {
  const pts = [];
  const r = Math.min(cornerR, halfH, (athMax - athMin) / 2);
  const steps = cornerSteps;

  const topY = -halfH;
  const botY = +halfH;
  const left = athMin;
  const right = athMax;

  for (let s = steps; s >= 0; s--) {
    const a = (Math.PI / 2) * (s / steps);
    pts.push({ dh: left + r - r * Math.cos(a), dv: topY + r - r * Math.sin(a) });
  }
  for (let s = 0; s <= steps; s++) {
    const a = (Math.PI / 2) * (s / steps);
    pts.push({ dh: right - r + r * Math.cos(a), dv: topY + r - r * Math.sin(a) });
  }
  for (let s = steps; s >= 0; s--) {
    const a = (Math.PI / 2) * (s / steps);
    pts.push({ dh: right - r + r * Math.cos(a), dv: botY - r + r * Math.sin(a) });
  }
  for (let s = 0; s <= steps; s++) {
    const a = (Math.PI / 2) * (s / steps);
    pts.push({ dh: left + r - r * Math.cos(a), dv: botY - r + r * Math.sin(a) });
  }
  return pts;
}

async function main() {
  const raw = JSON.parse(await fs.promises.readFile(sceneNavPath, "utf8"));
  const items = (raw.items ?? []).filter(
    (i) =>
      i.sceneId?.trim() &&
      i.label?.trim() &&
      typeof i.iconUrl === "string" &&
      i.iconUrl.trim().length > 0,
  );

  await fs.promises.mkdir(iconsOutDir, { recursive: true });

  const iconUrls = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rel = item.iconUrl.trim().replace(/^\//, "");
    const svgPath = path.join(root, "public", rel);
    const pngName = `${i}.png`;
    const pngRel = `krpano-patches/vr-nav-icons/${pngName}`;
    const pngAbs = path.join(iconsOutDir, pngName);
    try {
      await rasterizeNavIcon(svgPath, pngAbs);
    } catch (e) {
      console.warn(
        `[generate-krpano-vr-bottombar] SVG → PNG échoué pour ${rel}:`,
        e?.message ?? e,
      );
      await sharp({
        create: { width: 96, height: 96, channels: 4, background: { r: 240, g: 240, b: 240, alpha: 1 } },
      }).png().toFile(pngAbs);
    }
    iconUrls.push(pngRel);
  }

  const n = items.length;
  const iconGapDeg = 6;
  const iconScale = 0.14;
  const baseAtvOffset = 38;
  const vParallax = 0.3;
  const padDeg = 4;
  const halfH = 3.8;
  const cornerR = 1.8;
  const cornerSteps = 5;

  const iconOffsets = [];
  for (let i = 0; i < n; i++) {
    iconOffsets.push(n <= 1 ? 0 : (i - (n - 1) / 2) * iconGapDeg);
  }

  const athMin = iconOffsets[0] - padDeg;
  const athMax = iconOffsets[n - 1] + padDeg;
  const polyPts = buildPolyOffsets(athMin, athMax, halfH, cornerR, cornerSteps);
  const ptCount = polyPts.length;

  const lines = [];
  lines.push(`<!-- Généré par scripts/generate-krpano-vr-bottombar.mjs — ne pas éditer à la main -->`);
  lines.push(`<krpano>`);
  lines.push(`\t<set var="vr_nav_anchor_h" val="0" />`);

  /* --- Polygon background --- */
  let bgAttrs = `name="vr_nav_bg" keep="true" distorted="true" renderer="webgl"`;
  bgAttrs += ` fillcolor="0xFFFFFF" fillalpha="0.92"`;
  bgAttrs += ` borderwidth="1.5" bordercolor="0xCBD5E1" borderalpha="0.7"`;
  bgAttrs += ` subdiv="true" zorder="2" depth="1000" visible="false" devices="webgl"`;
  bgAttrs += ` point.count="${ptCount}"`;
  for (let p = 0; p < ptCount; p++) {
    bgAttrs += ` point[${p}].ath="0" point[${p}].atv="0"`;
  }
  lines.push(`\t<hotspot ${bgAttrs} />`);

  /* --- Icon style --- */
  lines.push(`\t<style name="vr_navbar_icon_style"`);
  lines.push(`\t\tedge="center"`);
  lines.push(`\t\tdistorted="true"`);
  lines.push(`\t\trenderer="webgl"`);
  lines.push(`\t\tdepth="1000"`);
  lines.push(`\t\tzorder="10"`);
  lines.push(`\t\tscale="${iconScale}"`);
  lines.push(`\t\tvr_timeout="750"`);
  lines.push(`\t\tonover="tween(scale,${(iconScale * 1.18).toFixed(3)});"`);
  lines.push(`\t\tonout="tween(scale,${iconScale});"`);
  lines.push(`\t\tvisible="false"`);
  lines.push(`\t\tdevices="webgl"`);
  lines.push(`\t/>`);

  /* --- Icon hotspots --- */
  for (let i = 0; i < n; i++) {
    const sceneId = escapeSceneIdForKrpano(items[i].sceneId.trim());
    const onclick = `loadscene('${sceneId}', null, MERGE, BLEND(0.5));`;
    lines.push(
      `\t<hotspot name="vr_nav_icon_${i}" keep="true" style="vr_navbar_icon_style" url="${xmlEscapeAttr(iconUrls[i])}" ath="0" atv="0" onclick="${xmlEscapeAttr(onclick)}" />`,
    );
  }

  /* --- Events --- */
  lines.push(`\t<events name="vr_navbar_events" keep="true" onviewchange="vr_navbar_follow_update();" />`);

  /* --- Follow action (JS) --- */
  lines.push(`\t<action name="vr_navbar_follow_update" type="Javascript"><![CDATA[`);
  lines.push(`\t\ttry {`);
  lines.push(`\t\t\tif (!krpano || !krpano.get("webvr.isenabled")) return;`);
  lines.push(`\t\t\tvar bg = krpano.get("hotspot[vr_nav_bg]");`);
  lines.push(`\t\t\tif (!bg || !bg.visible) return;`);
  lines.push(`\t\t\tvar anchorH = 1.0 * krpano.get("vr_nav_anchor_h");`);
  lines.push(`\t\t\tvar camV = 1.0 * krpano.get("view.vlookat");`);
  lines.push(`\t\t\tvar atv = ${baseAtvOffset} + camV * ${vParallax};`);
  lines.push(``);
  // Polygon offsets baked in
  lines.push(`\t\t\tvar offH = [${polyPts.map((p) => p.dh.toFixed(4)).join(",")}];`);
  lines.push(`\t\t\tvar offV = [${polyPts.map((p) => p.dv.toFixed(4)).join(",")}];`);
  lines.push(`\t\t\tfor (var pi = 0; pi < ${ptCount}; pi++) {`);
  lines.push(`\t\t\t\tbg.point[pi].ath = anchorH + offH[pi];`);
  lines.push(`\t\t\t\tbg.point[pi].atv = atv + offV[pi];`);
  lines.push(`\t\t\t}`);
  lines.push(`\t\t\tbg.needredraw = true;`);
  lines.push(``);
  for (let i = 0; i < n; i++) {
    const off = iconOffsets[i];
    lines.push(`\t\t\tvar hs${i} = krpano.get("hotspot[vr_nav_icon_${i}]");`);
    lines.push(`\t\t\tif (hs${i}) { hs${i}.ath = anchorH + ${off.toFixed(4)}; hs${i}.atv = atv; }`);
  }
  lines.push(`\t\t} catch (e) {}`);
  lines.push(`\t]]></action>`);

  /* --- Show / Hide --- */
  lines.push(`\t<action name="vr_navbar_show">`);
  lines.push(`\t\tcopy(vr_nav_anchor_h, view.hlookat);`);
  lines.push(`\t\tset(hotspot[vr_nav_bg].visible, true);`);
  for (let i = 0; i < n; i++) {
    lines.push(`\t\tset(hotspot[vr_nav_icon_${i}].visible, true);`);
  }
  lines.push(`\t\tvr_navbar_follow_update();`);
  lines.push(`\t\tdelayedcall(0, vr_navbar_follow_update());`);
  lines.push(`\t</action>`);

  lines.push(`\t<action name="vr_navbar_hide">`);
  lines.push(`\t\tset(hotspot[vr_nav_bg].visible, false);`);
  for (let i = 0; i < n; i++) {
    lines.push(`\t\tset(hotspot[vr_nav_icon_${i}].visible, false);`);
  }
  lines.push(`\t</action>`);

  lines.push(`</krpano>`);
  lines.push(``);

  await fs.promises.writeFile(outXmlPath, lines.join("\n"), "utf8");
  console.log(`Wrote ${outXmlPath} (${n} icônes, ${ptCount} pts polygone)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

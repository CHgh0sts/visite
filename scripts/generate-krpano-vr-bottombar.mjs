/**
 * Génère `public/krpano-patches/tour-vr-bottombar-generated.xml` + assets PNG
 * depuis `src/data/scene-nav.json` (même logique que `SceneNavBar` : loadscene vers `sceneId`).
 *
 * Placement VR :
 *   - Horizontal **fixe** : capturé une seule fois (`view.hlookat` à l'entrée VR).
 *   - Vertical **parallaxe** : suit `view.vlookat` avec un facteur < 1 → barre en bas
 *     du champ mais qui bouge moins que la tête (pas collée, pas impossible à voir).
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

async function writeBarBgPng() {
  const w = 640;
  const h = 112;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="28" ry="28" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
</svg>`;
  const out = path.join(patchesDir, "vr-nav-bar-bg.png");
  await sharp(Buffer.from(svg)).png().toFile(out);
  return "krpano-patches/vr-nav-bar-bg.png";
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

  const bgUrl = await writeBarBgPng();

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
        create: {
          width: 96,
          height: 96,
          channels: 4,
          background: { r: 240, g: 240, b: 240, alpha: 1 },
        },
      })
        .png()
        .toFile(pngAbs);
    }
    iconUrls.push(pngRel);
  }

  const n = items.length;
  const barScale = 0.42;
  const iconScale = 0.18;
  /**
   * Espacement angulaire en degrés entre chaque icône (horizontal).
   * Le fond et les icônes sont centrés sur l'ancre `hlookat` capturée au show.
   */
  const iconGapDeg = 10.2;
  /** Position verticale de base de la barre (en ° sous l'axe de vue, positif = vers le bas). */
  const baseAtvOffset = 38;
  /** Facteur parallaxe vertical : 0 = fixe, 1 = suit parfaitement la caméra. ~0.3 = bonne parallaxe. */
  const vParallax = 0.3;

  const lines = [];
  lines.push(
    `<!-- Généré par scripts/generate-krpano-vr-bottombar.mjs — ne pas éditer à la main -->`,
  );
  lines.push(`<krpano>`);
  lines.push(`\t<!-- Ancre horizontale fixée à l'entrée VR -->`);
  lines.push(`\t<set var="vr_nav_anchor_h" val="0" />`);

  lines.push(`\t<style name="vr_navbar_bg_style"`);
  lines.push(`\t\turl="${xmlEscapeAttr(bgUrl)}"`);
  lines.push(`\t\tedge="center"`);
  lines.push(`\t\tdistorted="true"`);
  lines.push(`\t\trenderer="webgl"`);
  lines.push(`\t\tdepth="950"`);
  lines.push(`\t\tzorder="2"`);
  lines.push(`\t\tscale="${barScale}"`);
  lines.push(`\t\talpha="0.98"`);
  lines.push(`\t\tenabled="false"`);
  lines.push(`\t\tvisible="false"`);
  lines.push(`\t\tdevices="webgl"`);
  lines.push(`\t/>`);
  lines.push(`\t<style name="vr_navbar_icon_style"`);
  lines.push(`\t\tedge="center"`);
  lines.push(`\t\tdistorted="true"`);
  lines.push(`\t\trenderer="webgl"`);
  lines.push(`\t\tdepth="1000"`);
  lines.push(`\t\tzorder="10"`);
  lines.push(`\t\tscale="${iconScale}"`);
  lines.push(`\t\tvr_timeout="750"`);
  lines.push(
    `\t\tonover="tween(scale,${(iconScale * 1.2).toFixed(3)});"`,
  );
  lines.push(`\t\tonout="tween(scale,${iconScale});"`);
  lines.push(`\t\tvisible="false"`);
  lines.push(`\t\tdevices="webgl"`);
  lines.push(`\t/>`);

  lines.push(
    `\t<hotspot name="vr_nav_bg" keep="true" style="vr_navbar_bg_style" ath="0" atv="0" />`,
  );

  const iconOffsets = [];
  for (let i = 0; i < n; i++) {
    const offset =
      n <= 1 ? 0 : (i - (n - 1) / 2) * iconGapDeg;
    iconOffsets.push(offset);
    const sceneId = escapeSceneIdForKrpano(items[i].sceneId.trim());
    const onclick = `loadscene('${sceneId}', null, MERGE, BLEND(0.5));`;
    lines.push(
      `\t<hotspot name="vr_nav_icon_${i}" keep="true" style="vr_navbar_icon_style" url="${xmlEscapeAttr(iconUrls[i])}" ath="0" atv="0" onclick="${xmlEscapeAttr(onclick)}" />`,
    );
  }

  lines.push(
    `\t<events name="vr_navbar_events" keep="true" onviewchange="vr_navbar_follow_update();" />`,
  );

  lines.push(
    `\t<action name="vr_navbar_follow_update" type="Javascript"><![CDATA[`,
  );
  lines.push(`\t\ttry {`);
  lines.push(
    `\t\t\tif (!krpano || !krpano.get("webvr.isenabled")) return;`,
  );
  lines.push(`\t\t\tvar bg = krpano.get("hotspot[vr_nav_bg]");`);
  lines.push(`\t\t\tif (!bg || !bg.visible) return;`);
  lines.push(``);
  lines.push(`\t\t\tvar anchorH = 1.0 * krpano.get("vr_nav_anchor_h");`);
  lines.push(`\t\t\tvar camV = 1.0 * krpano.get("view.vlookat");`);
  lines.push(``);
  lines.push(
    `\t\t\tvar atv = ${baseAtvOffset} + camV * ${vParallax};`,
  );
  lines.push(``);
  lines.push(`\t\t\tbg.ath = anchorH;`);
  lines.push(`\t\t\tbg.atv = atv;`);
  lines.push(``);
  for (let i = 0; i < n; i++) {
    const off = iconOffsets[i];
    lines.push(
      `\t\t\tvar hs${i} = krpano.get("hotspot[vr_nav_icon_${i}]");`,
    );
    lines.push(
      `\t\t\tif (hs${i}) { hs${i}.ath = anchorH + ${off.toFixed(4)}; hs${i}.atv = atv; }`,
    );
  }
  lines.push(`\t\t} catch (e) {}`);
  lines.push(`\t]]></action>`);

  lines.push(`\t<action name="vr_navbar_show">`);
  lines.push(
    `\t\tcopy(vr_nav_anchor_h, view.hlookat);`,
  );
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
  console.log(`Wrote ${outXmlPath} (${n} icônes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

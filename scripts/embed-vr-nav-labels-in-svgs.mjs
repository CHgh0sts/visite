/**
 * SVG vr/ : rendu proche de la SceneNavBar 2D (fond pilule clair, bordure, inactif).
 * Libellés longs sur 2 lignes. Usage : node scripts/embed-vr-nav-labels-in-svgs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const navPath = path.join(root, "src", "data", "scene-nav.json");
const vrDir = path.join(root, "public", "images", "navbar", "vr");

const ACCENT = "#0e203d";
const BG = "#f8fafc";
const STROKE = "#e2e8f0";
const STROKE_W = 22;

/** Bande sous la zone icône — plus petit = carte moins haute, texte plus près de l’icône. */
const TEXT_BAND_1LINE = 520;
const TEXT_BAND_2LINES = 700;
/** Padding bas du texte dans la bande (distance au bord inférieur de la carte). */
const TEXT_PAD_BOTTOM = 52;
/** Réduction des seuls tracés d’icône (groupe path), sans modifier fontSize3600. */
const ICON_PATH_SCALE = 0.72;

function escapeXmlText(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function splitLabelLines(label) {
  const t = label.trim();
  if (t.length <= 13 || !/\s/.test(t)) return [t];
  const words = t.split(/\s+/);
  if (words.length < 2) return [t];
  const mid = Math.ceil(words.length / 2);
  const a = words.slice(0, mid).join(" ");
  const b = words.slice(mid).join(" ");
  if (a.length < 3 || b.length < 2) return [t];
  return [a, b];
}

function fontSize3600(lines) {
  const n = Math.max(lines[0].length, lines[1]?.length ?? 0);
  const mult = lines.length > 1 ? 0.82 : 1;
  let base;
  if (n <= 9) base = 265;
  else if (n <= 14) base = 220;
  else if (n <= 22) base = 180;
  else base = 145;
  return Math.round(base * mult);
}

function stripOldLabel(s) {
  return s.replace(/<text[^>]*id="vr-nav-label"[^>]*>[\s\S]*?<\/text>\s*/g, "");
}

/** Retire le groupe d’échelle sur l’icône pour pouvoir ré-embed sans double scale. */
function stripIconScaleWrapper(s) {
  let t = s;
  if (
    /<g transform="translate\(1800,\s*1800\) scale\([\d.]+\) translate\(-1800,\s*-1800\)"/.test(
      t,
    )
  ) {
    t = t.replace(
      /<g transform="translate\(1800,\s*1800\) scale\([\d.]+(?:,\s*[\d.]+)?\) translate\(-1800,\s*-1800\)">\s*/,
      "",
    );
    t = t.replace(/<\/g>\s*<\/g>\s*<\/svg>/, "</g>\n</svg>");
  }
  if (
    /<g transform="translate\(50,\s*50\) scale\([\d.]+\) translate\(-50,\s*-50\)"/.test(t)
  ) {
    t = t.replace(
      /<g transform="translate\(50,\s*50\) scale\([\d.]+(?:,\s*[\d.]+)?\) translate\(-50,\s*-50\)">\s*/,
      "",
    );
    t = t.replace(/<\/g>\s*<\/g>\s*<\/svg>/, "</g>\n</svg>");
  }
  return t;
}

/** Enveloppe le groupe de paths d’icône (échelle autour du centre de la zone dessin). */
function wrapIconPathGroup(s, scale) {
  const re3600 =
    /<g transform="translate\(0\.000000,3600\.000000\) scale\(0\.100000,-0\.100000\)"(\s[^>]*>)/;
  if (re3600.test(s)) {
    let out = s.replace(
      re3600,
      `<g transform="translate(1800, 1800) scale(${scale}) translate(-1800, -1800)">\n<g transform="translate(0.000000,3600.000000) scale(0.100000,-0.100000)"$1`,
    );
    out = out.replace(/<\/g>\s*<\/svg>/, "</g>\n</g>\n</svg>");
    return out;
  }
  const re100 =
    /<g transform="translate\(0\.000000,100\.000000\) scale\(0\.100000,-0\.100000\)"(\s[^>]*>)/;
  if (re100.test(s)) {
    let out = s.replace(
      re100,
      `<g transform="translate(50, 50) scale(${scale}) translate(-50, -50)">\n<g transform="translate(0.000000,100.000000) scale(0.100000,-0.100000)"$1`,
    );
    out = out.replace(/<\/g>\s*<\/svg>/, "</g>\n</g>\n</svg>");
    return out;
  }
  return s;
}

function insertAfterCardRect(s, textEl) {
  const re = /<rect[^>]*(?:fill="#(?:ffffff|f8fafc)"|fill='#ffffff')[^/]*\/>/;
  const m = s.match(re);
  if (!m) {
    console.warn("no card rect");
    return s;
  }
  return s.replace(re, m[0] + "\n" + textEl);
}

function cardRect3600(x0, y0, vw, nh) {
  return `<rect x="${x0}" y="${y0}" width="${vw}" height="${nh}" rx="420" ry="420" fill="${BG}" stroke="${STROKE}" stroke-width="${STROKE_W}"/>`;
}

function cardRectSmall(x0, y0, vw, nh, rx) {
  return `<rect x="${x0}" y="${y0}" width="${vw}" height="${nh}" rx="${rx}" ry="${rx}" fill="${BG}" stroke="${STROKE}" stroke-width="${Math.max(2, Math.round(rx * 0.15))}"/>`;
}

function patchSvg(content, label) {
  let s = stripIconScaleWrapper(stripOldLabel(content));
  const lines = splitLabelLines(label);

  if (!s.includes('viewBox="')) {
    const wm = s.match(/\bwidth="(\d+)(?:\.\d+)?(?:pt)?"/);
    const hm = s.match(/\bheight="(\d+)(?:\.\d+)?(?:pt)?"/);
    if (wm && hm) {
      s = s.replace(/<svg([^>]+)>/, (full, inner) => {
        if (/viewBox=/.test(inner)) return full;
        return `<svg${inner} viewBox="0 0 ${wm[1]} ${hm[1]}">`;
      });
    }
  }

  const vbMatch = s.match(/viewBox="([^"]+)"/);
  if (!vbMatch) {
    console.warn("no viewBox, skip");
    return content;
  }
  const parts = vbMatch[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length < 4) return content;
  const x0 = parts[0],
    y0 = parts[1],
    vw = parts[2],
    vh = parts[3];

  if (vw <= 200 && vh <= 200) {
    const band = lines.length > 1 ? 88 : 72;
    const nh = Math.min(vh, 200) + band;
    const fs = vw < 120 ? 10 : 12;
    const tx = x0 + vw / 2;
    const rx = Math.max(4, Math.round(vw * 0.12));
    s = s.replace(/viewBox="[^"]+"/, `viewBox="${x0} ${y0} ${vw} ${nh}"`);
    s = s.replace(/width="[^"]*"/, `width="${vw}.000000pt"`);
    s = s.replace(/height="[^"]*"/, `height="${nh}.000000pt"`);
    s = s.replace(/<rect[^>]*\/>/, cardRectSmall(x0, y0, vw, nh, rx));
    let inner;
    if (lines.length === 1) {
      const ty = y0 + nh - 8;
      inner = `<text id="vr-nav-label" x="${tx}" y="${ty}" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Arial, sans-serif" font-size="${fs}" font-weight="500" fill="${ACCENT}" letter-spacing="0.04em">${escapeXmlText(lines[0])}</text>`;
    } else {
      const ty = y0 + nh - 8 - fs * 1.1;
      inner = `<text id="vr-nav-label" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Arial, sans-serif" font-size="${fs}" font-weight="500" fill="${ACCENT}" letter-spacing="0.04em"><tspan x="${tx}" y="${ty}">${escapeXmlText(lines[0])}</tspan><tspan x="${tx}" dy="1.12em">${escapeXmlText(lines[1])}</tspan></text>`;
    }
    return wrapIconPathGroup(insertAfterCardRect(s, inner), ICON_PATH_SCALE);
  }

  const textBand = lines.length > 1 ? TEXT_BAND_2LINES : TEXT_BAND_1LINE;
  const nh = vh + textBand;
  const fs = fontSize3600(lines);
  const tx = x0 + vw / 2;

  s = s.replace(/viewBox="[^"]+"/, `viewBox="${x0} ${y0} ${vw} ${nh}"`);
  s = s.replace(/<rect[^>]*fill="#ffffff"[^/]*\/>/, cardRect3600(x0, y0, vw, nh));
  s = s.replace(/width="[^"]*pt"/, `width="${vw}.000000pt"`);
  s = s.replace(/height="[^"]*pt"/, `height="${nh}.000000pt"`);

  let yText;
  if (lines.length === 1) {
    yText = y0 + vh + textBand - TEXT_PAD_BOTTOM;
    const inner = `<text id="vr-nav-label" x="${tx}" y="${yText}" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Arial, sans-serif" font-size="${fs}" font-weight="500" fill="${ACCENT}" letter-spacing="0.04em">${escapeXmlText(lines[0])}</text>`;
    return wrapIconPathGroup(insertAfterCardRect(s, inner), ICON_PATH_SCALE);
  }
  yText = y0 + vh + textBand - TEXT_PAD_BOTTOM - fs * 0.9;
  const inner = `<text id="vr-nav-label" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Arial, sans-serif" font-size="${fs}" font-weight="500" fill="${ACCENT}" letter-spacing="0.04em"><tspan x="${tx}" y="${yText}">${escapeXmlText(lines[0])}</tspan><tspan x="${tx}" dy="1.14em">${escapeXmlText(lines[1])}</tspan></text>`;
  return wrapIconPathGroup(insertAfterCardRect(s, inner), ICON_PATH_SCALE);
}

const raw = JSON.parse(fs.readFileSync(navPath, "utf8"));
const items = raw.items ?? [];

for (const item of items) {
  const url = item.iconUrl?.trim();
  const label = item.label?.trim();
  if (!url || !label) continue;
  const base = path.basename(url);
  const fp = path.join(vrDir, base);
  if (!fs.existsSync(fp)) {
    console.warn("missing file", fp);
    continue;
  }
  const before = fs.readFileSync(fp, "utf8");
  const after = patchSvg(before, label);
  if (after !== before) {
    fs.writeFileSync(fp, after, "utf8");
    console.log("embedded label:", base);
  } else {
    console.log("unchanged:", base);
  }
}

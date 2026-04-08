/**
 * Ajoute un <rect> blanc arrondi derrière le contenu des SVG dans public/images/navbar/vr/.
 * Le rectangle suit le viewBox (ex. 100×100 pour PREPARATION, 3600×3600 pour les autres).
 * Usage : node scripts/add-white-bg-to-vr-nav-svgs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "..", "public", "images", "navbar", "vr");

function whiteRectMarkup(s) {
  const vb = s.match(/viewBox="([^"]+)"/);
  if (vb) {
    const parts = vb[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
      const w = parts[2];
      const h = parts[3];
      const rx = Math.max(4, Math.round(Math.min(w, h) * 0.12));
      return `<rect x="0" y="0" width="${w}" height="${h}" rx="${rx}" ry="${rx}" fill="#ffffff"/>`;
    }
  }
  return '<rect width="3600" height="3600" rx="420" ry="420" fill="#ffffff"/>';
}

function alreadyHasWhiteBg(s) {
  return /<\s*rect[^>]*fill="#ffffff"/.test(s);
}

function patch(s) {
  const rect = whiteRectMarkup(s);
  if (alreadyHasWhiteBg(s)) {
    // Corriger un ancien rect 3600×3600 si viewBox ne correspond pas
    const wrong = /<rect width="3600" height="3600" rx="420" ry="420" fill="#ffffff"\/>/;
    if (wrong.test(s) && !s.includes('viewBox="0 0 3600')) {
      return s.replace(wrong, rect);
    }
    return s;
  }
  const a = `preserveAspectRatio="xMidYMid meet">\n`;
  if (s.includes(a)) return s.replace(a, a + rect + "\n");
  const b = /<svg([^>]+)>/;
  if (s.match(b)) return s.replace(b, (full) => `${full}\n${rect}`, 1);
  return s;
}

for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith(".svg")) continue;
  const p = path.join(dir, name);
  const before = fs.readFileSync(p, "utf8");
  const after = patch(before);
  if (after !== before) {
    fs.writeFileSync(p, after, "utf8");
    console.log("patched", name);
  } else {
    console.log("skip", name);
  }
}

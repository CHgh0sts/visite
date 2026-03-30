/**
 * Vérifie si une base URL sert réellement les JPG sous panos/ (pas seulement tour.xml).
 */
import https from "https";
import http from "http";

/**
 * @param {string} absoluteUrl URL complète d’un fichier (ex. preview.jpg)
 * @returns {Promise<{ ok: boolean, statusCode?: number }>}
 */
export function probeUrl(absoluteUrl) {
  return new Promise((resolve) => {
    const lib = absoluteUrl.startsWith("https") ? https : http;
    const req = lib.request(
      absoluteUrl,
      {
        method: "GET",
        headers: { "user-agent": "visite-micronique-probe/1.0" },
      },
      (res) => {
        res.resume();
        resolve({
          ok: res.statusCode === 200,
          statusCode: res.statusCode,
        });
      },
    );
    req.on("error", () => resolve({ ok: false }));
    req.end();
  });
}

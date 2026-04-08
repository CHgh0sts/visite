import type { NextConfig } from "next";

/** Même contenu que le worker Micronique, servi en same-origin pour krpano (sinon « External Access Denied » sur localhost). */
const MICRONIQUE_PUBLIC =
  "https://micronique-public.tech-47e.workers.dev";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      /* Carte : le worker n’a pas plugins/krpanomaps.xml (404) → tour local avec maps désactivé */
      {
        source: "/micronique-assets/tour.xml",
        destination: "/krpano-patches/tour.xml",
      },
      {
        source: "/micronique-assets/tour-visite.xml",
        destination: "/krpano-patches/tour-visite.xml",
      },
      /* Barre VR (générée depuis scene-nav.json) — sinon le catch-all pointe vers le worker → 404 */
      {
        source: "/micronique-assets/tour-vr-bottombar-generated.xml",
        destination: "/krpano-patches/tour-vr-bottombar-generated.xml",
      },
      /* Skin du worker : blocs UI commentés → skin_startup casse ; version décommentée dans public/ */
      {
        source: "/micronique-assets/skin/vtourskin.xml",
        destination: "/krpano-patches/vtourskin.xml",
      },
      {
        source: "/micronique-assets/:path*",
        destination: `${MICRONIQUE_PUBLIC}/:path*`,
      },
    ];
  },
};

export default nextConfig;

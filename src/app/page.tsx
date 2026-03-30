import Image from "next/image";
import Link from "next/link";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accueil",
  description: "Micronique — accès à la visite virtuelle des ateliers.",
};

const STATS = [
  "25 COLLABORATEURS",
  "2500M²",
  "ISO9001 V2015",
  "EN9100 V2018",
  "EMS ÎLE-DE-FRANCE",
] as const;

/** Vidéo de fond Vimeo (mode background, sans contrôles). */
const HOME_BACKGROUND_VIMEO =
  "https://player.vimeo.com/video/1177304579?autoplay=1&muted=1&playsinline=1&controls=0&background=1";

export default function HomePage() {
  return (
    <main className="relative min-h-dvh w-full overflow-hidden bg-[#172239] text-white">
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        aria-hidden
      >
        <iframe
          src={HOME_BACKGROUND_VIMEO}
          title="Micronique — vidéo de fond"
          className="absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 border-0"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
        />
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-[1] flex min-h-full min-w-full items-stretch justify-stretch"
        aria-hidden
      >
        <svg
          viewBox="0 0 2832 1793"
          fill="none"
          className="h-full min-h-full w-full min-w-full"
          preserveAspectRatio="xMidYMid slice"
        >
          <path
            d="M2832 1792.85H0V0H2832V1792.85ZM694.965 272.696C659.27 272.696 598.297 257.896 598.297 364.746V504.63C598.297 541.683 598.298 585.826 694.965 585.826H810.062C840.192 585.826 887.096 583.093 891.309 663.808V1111.19C891.309 1148.65 891.309 1208.87 966.912 1208.87H1108.34C1134.71 1208.87 1181.31 1211.04 1181.31 1287.25V1457.69C1181.31 1484.29 1187.86 1522 1265.19 1522H1725.58C1740.38 1518.25 1769.97 1500.13 1769.97 1457.69V1286.56C1769.96 1262.56 1769.95 1208.87 1830.15 1208.87H2303.71C2321.42 1208.87 2353.88 1197.53 2355.99 1128.08V663.808C2358.5 637.814 2346.81 585.826 2280.01 585.826H2138.96C2114.17 585.826 2055.08 571.829 2055.08 529.953V339.824C2055.08 318.19 2055.08 272.696 1992.26 272.696H694.965Z"
            fill="#172239"
          />
        </svg>
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 min-h-dvh">
        {/* Logo, baseline, badges — haut droite (zone bleue de la maquette) */}
        <div className="pointer-events-auto absolute right-[clamp(0.75rem,8vw,4rem)] top-[clamp(1rem,3vh,1.75rem)] z-20 flex max-w-[min(92vw,22rem)] flex-col items-end gap-2.5 sm:gap-3">
          <img
            src="/images/global/micronique.webp"
            alt="Micronique"
            width={420}
            height={140}
            className="h-auto w-[min(72vw,16rem)] sm:w-[min(64vw,18rem)] md:max-w-[20rem] object-contain"
            decoding="async"
            fetchPriority="high"
          />
          <p className="max-w-[18rem] text-right text-[10px] font-semibold uppercase leading-tight tracking-[0.18em] text-white sm:text-[11px] md:text-xs">
            L&apos;EXPÉRIENCE EN MOUVEMENT
          </p>
          <div className="flex flex-row items-stretch gap-2.5 sm:gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white shadow-md sm:h-12 sm:w-12 md:h-14 md:w-14">
              <Image
                src="/images/global/b1.avif"
                alt="French Fab"
                fill
                sizes="(max-width: 768px) 44px, 56px"
                className="object-cover"
              />
            </div>
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white p-1 shadow-md sm:h-12 sm:w-12 sm:p-1.5 md:h-14 md:w-14 md:p-1.5">
              <Image
                src="/images/global/b2.avif"
                alt="French Tech"
                fill
                sizes="(max-width: 768px) 44px, 56px"
                className="object-contain"
              />
            </div>
          </div>
        </div>

        {/* Texte — bandeau gauche, ancré vers le bas de l’écran */}
        <div className="pointer-events-auto absolute inset-y-0 left-0 z-20 flex w-[min(100%,22rem)] flex-col justify-end px-5 pb-[clamp(4rem,10vh,7.5rem)] pt-8 sm:w-[min(100%,26rem)] sm:px-8 sm:pb-[clamp(4.5rem,11vh,8.5rem)] md:w-[min(100%,30rem)] md:px-10 md:pb-12 md:pl-12 lg:w-[min(100%,34rem)] lg:pb-14 lg:pl-14 xl:pl-20">
          <ul className="space-y-1.5 text-left text-[11px] font-bold uppercase leading-snug tracking-[0.06em] text-white sm:space-y-2 sm:text-xs md:text-[13px] lg:text-sm">
            {STATS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-6 max-w-xl text-left text-[11px] font-normal leading-relaxed text-white/95 sm:mt-8 sm:text-xs md:mt-10 md:text-[13px] md:leading-relaxed lg:text-[14px]">
            Créée en 1975, Micronique est un EMS indépendant français situé en
            Île-de-France et spécialisé dans la fabrication et l&apos;intégration
            de cartes électroniques, du prototype à la série.
          </p>
          <p className="mt-4 max-w-xl text-left text-[11px] font-normal leading-relaxed text-white/95 sm:mt-5 sm:text-xs md:mt-6 md:text-[13px] md:leading-relaxed lg:text-[14px]">
            Micronique s&apos;appuie sur 50 ans d&apos;expérience, des équipements
            récents et une organisation flexible pour garantir qualité, innovation,
            maîtrise des délais et satisfaction client, à des coûts compétitifs.
          </p>
        </div>

        {/* VISITE — bas à droite */}
        <div className="pointer-events-auto absolute bottom-6 right-5 z-20 sm:bottom-8 sm:right-8 md:bottom-12 md:right-12 lg:bottom-14 lg:right-16">
          <Link
            href="/visite"
            className="group inline-flex items-baseline gap-2 text-xl font-bold uppercase tracking-[0.12em] text-white transition hover:text-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#172239] sm:text-2xl md:text-3xl lg:text-4xl"
          >
            <span>VISITE</span>
            <span
              className="inline-block translate-y-[-0.05em] text-xl font-light transition group-hover:translate-x-0.5 sm:text-2xl md:text-3xl lg:text-4xl"
              aria-hidden
            >
              →
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}

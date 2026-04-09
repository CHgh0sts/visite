import { VisiteShell } from "@/components/VisiteShell";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Visite virtuelle",
  description:
    "Visite panoramique 360° (krpano), mêmes ressources que micronique.juumo.fr.",
};

export default function VisitePage() {
  return <VisiteShell />;
}

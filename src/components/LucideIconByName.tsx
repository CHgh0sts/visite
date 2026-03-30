"use client";

import type { ComponentType } from "react";
import * as Lucide from "lucide-react";

type Props = {
  /** Nom du symbole exporté par lucide-react (ex. Info, ExternalLink). */
  name: string;
  size?: number;
  className?: string;
};

/**
 * Résout dynamiquement une icône Lucide par nom. Icône inconnue → CircleHelp.
 */
export function LucideIconByName({ name, size = 22, className }: Props) {
  const Icon = (
    Lucide as unknown as Record<
      string,
      ComponentType<{ size?: number; className?: string }>
    >
  )[name.trim()];
  if (typeof Icon !== "function") {
    return <Lucide.CircleHelp size={size} className={className} aria-hidden />;
  }
  return <Icon size={size} className={className} aria-hidden />;
}

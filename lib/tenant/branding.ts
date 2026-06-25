import type { CSSProperties } from "react";
import type { Project, WordmarkPart } from "@/lib/db/schema";
import { GREETING, SUGGESTIONS } from "@/lib/llm/prompts";

/**
 * Branding sérialisable d'un tenant, passé du serveur au client.
 * Toutes les valeurs ont un fallback sur l'identité « Ask by La Wine Tech »
 * historique, de sorte qu'un projet sans config reste pleinement fonctionnel.
 */
export type Branding = {
  name: string;
  description: string;
  logoUrl: string;
  faviconUrl: string;
  /** true → héro sans titre « Bonjour ! », logo agrandi. */
  heroLogoOnly: boolean;
  greeting: string;
  suggestions: string[];
  /** Absent → le Wordmark rend sa version par défaut figée. */
  wordmark: { parts: WordmarkPart[] } | null;
};

const DEFAULT_DESCRIPTION =
  "Une IA Souveraine pour répondre à toutes les questions des vignerons.";

export const DEFAULT_BRANDING: Branding = {
  name: "Ask by La Wine Tech",
  description: DEFAULT_DESCRIPTION,
  logoUrl: "/logo.png",
  faviconUrl: "/icon.png",
  heroLogoOnly: false,
  greeting: GREETING,
  suggestions: SUGGESTIONS,
  wordmark: null,
};

/** Construit le branding d'un projet (avec fallbacks sur le défaut). */
export function getBranding(project: Project | null): Branding {
  if (!project) return DEFAULT_BRANDING;
  const cfg = project.config ?? {};
  const theme = project.theme ?? {};
  return {
    name: project.name || DEFAULT_BRANDING.name,
    // Pas encore de description par projet : tagline par défaut pour l'instant.
    description: DEFAULT_DESCRIPTION,
    logoUrl: theme.logoUrl || DEFAULT_BRANDING.logoUrl,
    faviconUrl: theme.faviconUrl || DEFAULT_BRANDING.faviconUrl,
    heroLogoOnly: theme.heroLogoOnly ?? false,
    greeting: cfg.greeting || DEFAULT_BRANDING.greeting,
    suggestions:
      cfg.suggestions && cfg.suggestions.length
        ? cfg.suggestions
        : DEFAULT_BRANDING.suggestions,
    wordmark: theme.wordmark ?? null,
  };
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Mélange une couleur vers une cible (0 = noir, 255 = blanc) d'un facteur t. */
function mix(hex: string, target: number, t: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(...(rgb.map((c) => c + (target - c) * t) as [
    number,
    number,
    number,
  ]));
}
const darken = (hex: string, t: number) => mix(hex, 0, t);
const lighten = (hex: string, t: number) => mix(hex, 255, t);

/**
 * Variables CSS de couleur à poser en inline sur <html> pour surcharger les
 * tokens Tailwind (@theme) par tenant. À partir des 3 couleurs de marque
 * (navy/rose/roseLight) on DÉRIVE toute l'échelle (700/600/100…) pour qu'aucun
 * token Wine Tech par défaut ne « bave » sur un autre tenant.
 */
export function brandingColorVars(project: Project | null): CSSProperties {
  const colors = project?.theme?.colors;
  if (!colors) return {};
  const vars: Record<string, string> = {};
  const set = (k: string, v?: string) => {
    if (v) vars[k] = v;
  };

  const { navy, rose, roseLight } = colors;
  if (navy) {
    set("--color-navy", navy);
    set("--color-ink", navy);
    set("--color-navy-700", lighten(navy, 0.18));
  }
  if (rose) {
    set("--color-rose", rose);
    set("--color-rose-600", darken(rose, 0.12));
    set("--color-rose-700", darken(rose, 0.24));
  }
  if (roseLight) {
    set("--color-rose-50", roseLight);
    set("--color-rose-100", darken(roseLight, 0.06));
  }
  // Clés additionnelles éventuelles → passe-through.
  for (const [key, value] of Object.entries(colors)) {
    if (key !== "navy" && key !== "rose" && key !== "roseLight") {
      set(`--color-${key}`, value);
    }
  }
  return vars as CSSProperties;
}

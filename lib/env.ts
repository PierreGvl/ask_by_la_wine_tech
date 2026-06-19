import { z } from "zod";

/**
 * Validation centralisée des variables d'environnement.
 * Échoue tôt (au démarrage) plutôt qu'au premier appel runtime.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().url(),

  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.string().url().optional(),

  MISTRAL_API_KEY: z.string().min(1),
  CHAT_MODEL: z.string().default("mistral-large-latest"),
  TITLE_MODEL: z.string().default("mistral-small-latest"),
  EMBED_MODEL: z.string().default("mistral-embed"),

  RAG_MAX_DISTANCE: z.coerce.number().default(0.7),
  RAG_TOP_K: z.coerce.number().int().positive().default(8),

  // Multi-tenant : domaine racine pour le routing par sous-domaine
  // (winetech.ask.fr → slug 'winetech'). Le slug par défaut sert au
  // domaine apex, à www et au dev local.
  APP_BASE_DOMAIN: z.string().default("ask.fr"),
  DEFAULT_PROJECT_SLUG: z.string().default("winetech"),

  // Console d'administration sur un hôte dédié (ex. console.obsidio.fr).
  // Si défini : la console n'est servie QUE sur cet hôte ; /admin renvoie 404
  // sur les domaines tenants. Si vide : console accessible via /admin partout.
  CONSOLE_HOST: z.string().optional(),

  // Recherche web de secours (souveraine EU). 'none' = désactivée globalement.
  //  - 'brave'   : Brave Search API (BRAVE_API_KEY requis)
  //  - 'searxng' : instance SearxNG auto-hébergée (SEARXNG_URL requis)
  WEB_SEARCH_PROVIDER: z.enum(["none", "brave", "searxng"]).default("none"),
  BRAVE_API_KEY: z.string().optional(),
  SEARXNG_URL: z.string().url().optional(),

  // Rate-limiting (requêtes par minute). 0 = désactivé.
  WIDGET_RATE_LIMIT_PER_MIN: z.coerce.number().int().nonnegative().default(30),
  GUEST_RATE_LIMIT_PER_MIN: z.coerce.number().int().nonnegative().default(20),

  // Facturation Stripe (optionnel ; le webhook renvoie 501 si absent).
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Variables d'environnement invalides :\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;

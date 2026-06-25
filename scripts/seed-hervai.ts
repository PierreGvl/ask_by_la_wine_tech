/**
 * Seed du tenant HervAI (négociant en vins) — projet PRIVÉ, tier Domaine.
 *
 * Usage : npm run seed:hervai
 *
 * Idempotent (upsert par slug). Branding/prompt = placeholders à affiner via la
 * console ; l'essentiel ici est de monter un projet privé pour valider le RBAC
 * (accès réservé aux membres) et préparer l'ingestion du corpus HervAI.
 */
import { config } from "dotenv";

config({ path: ".env" });

const SYSTEM_PROMPT = `Tu es l'assistant interne de HervAI, négociant en vins.
Tu réponds aux questions sur le négoce, la réglementation douanière et viticole,
les déclarations (douanes, accises) et les documents d'accompagnement.
Appuie-toi EN PRIORITÉ sur les documents internes fournis (corpus du projet) et
cite tes sources. N'invente jamais une référence réglementaire.`;

const GREETING =
  "Bonjour 👋 Posez-moi vos questions sur le négoce, les douanes ou vos déclarations.";

const SUGGESTIONS = [
  "Quels documents pour une expédition intracommunautaire ?",
  "Comment remplir une déclaration d'accises ?",
  "Quelles mentions obligatoires sur un DAE ?",
  "Quelles démarches pour exporter du vin hors UE ?",
];

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");
  const { projects, subscriptions } = await import("@/lib/db/schema");

  const hervai = {
    slug: "hervai",
    name: "HervAI",
    tier: "domaine" as const,
    accessMode: "private" as const,
    status: "active" as const,
    // Branding placeholder (bordeaux/or) — à affiner dans la console.
    theme: {
      colors: { navy: "#3b1f2b", rose: "#a3324b", roseLight: "#f6e9ec" },
      wordmark: {
        parts: [
          { text: "Herv", color: "#3b1f2b" },
          { text: "AI", color: "#a3324b" },
        ],
      },
    },
    config: {
      systemPrompt: SYSTEM_PROMPT,
      greeting: GREETING,
      suggestions: SUGGESTIONS,
      locale: "fr",
      defaultDomain: "negoce",
    },
  };

  const existing = await db.query.projects.findFirst({
    where: eq(projects.slug, hervai.slug),
    columns: { id: true, theme: true },
  });

  let projectId: string;
  if (existing) {
    // Préserve les assets gérés depuis la console (logo/favicon uploadés) :
    // le seed ne doit jamais effacer ce qui a été personnalisé en prod.
    const theme = {
      ...hervai.theme,
      ...(existing.theme?.logoUrl ? { logoUrl: existing.theme.logoUrl } : {}),
      ...(existing.theme?.faviconUrl
        ? { faviconUrl: existing.theme.faviconUrl }
        : {}),
    };
    await db
      .update(projects)
      .set({
        name: hervai.name,
        tier: hervai.tier,
        accessMode: hervai.accessMode,
        status: hervai.status,
        theme,
        config: hervai.config,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, existing.id));
    projectId = existing.id;
    console.log(`✓ Projet « ${hervai.slug} » mis à jour (privé, domaine).`);
  } else {
    const [row] = await db
      .insert(projects)
      .values(hervai)
      .returning({ id: projects.id });
    projectId = row.id;
    console.log(`✓ Projet « ${hervai.slug} » créé (privé, domaine).`);
  }

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.projectId, projectId),
    columns: { id: true },
  });
  if (!sub) {
    await db
      .insert(subscriptions)
      .values({ projectId, tier: "domaine", provider: "manual" });
    console.log("✓ Abonnement hervai (domaine) créé.");
  }

  console.log(`\n✅ Seed HervAI terminé. projectId=${projectId}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Seed HervAI échoué :", err);
  process.exit(1);
});

import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/** Colonne binaire Postgres (bytea) — stockage des petits assets (logos). */
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const PROJECT_ROLES = ["owner", "admin", "member"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

// Type commercial du projet → pilote l'accès (WL & B2C = public ; B2B = privé).
export const PROJECT_TYPES = ["white_label", "b2b", "b2c"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];
// Mode de livraison : interface web hébergée, ou widget (clé API à intégrer).
export const DELIVERY_MODES = ["hosted", "widget"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];
// Modèle de facturation : l'entreprise paie, ou les utilisateurs (paliers).
export const BILLING_MODELS = ["company", "end_user"] as const;
export type BillingModel = (typeof BILLING_MODELS)[number];

/** Une source citée dans une réponse de l'assistant. */
export type Citation = {
  n: number;
  title: string;
  url: string | null;
  reference: string | null;
  /** Provenance : extrait du corpus du projet, ou résultat de recherche web. */
  kind?: "doc" | "web";
};

export type LicenseTier = "free" | "pro" | "domaine";

/** Drapeaux de fonctionnalités résolus depuis le tier (cf. lib/features/tiers.ts). */
export type ProjectFeatures = {
  customRag: boolean;
  webSearch: boolean;
  pdfGeneration: boolean;
  widget: boolean;
};

/** Identité visuelle d'un projet (dé-hardcoding du branding). */
export type WordmarkPart = {
  text: string;
  color?: string;
  dim?: boolean; // segment atténué (plus petit/discret), ex. « By La »
};

export type ProjectTheme = {
  colors?: Record<string, string>; // ex. { navy: "#141934", rose: "#e33170" }
  logoUrl?: string | null;
  faviconUrl?: string | null; // icône onglet/apple, servie par /api/assets
  // Héro du chat : true → masque le titre « Bonjour ! » et agrandit le logo.
  heroLogoOnly?: boolean;
  wordmark?: { parts: WordmarkPart[] };
  fonts?: { sans?: string; serif?: string };
};

/** Configuration métier d'un projet (dé-hardcoding du prompt/persona). */
export type ProjectConfig = {
  systemPrompt?: string; // persona/cadrage métier (les garde-fous restent en base partagée)
  greeting?: string;
  suggestions?: string[];
  locale?: string;
  defaultDomain?: string;
  ragMaxDistance?: number;
  ragTopK?: number;
  searchToolDescription?: string; // description de search_documents, agnostique du métier
};

export type ToolCallTrace = {
  name: string;
  args: Record<string, unknown>;
  resultCount?: number;
};

// --- Projets (tenants) : le cœur du multi-tenant ---
// Chaque projet = un client/déclinaison (Ask by La Wine Tech, HervAI, imprimeur…).
// projectId est la frontière d'isolation dure ; `domain` reste un sous-corpus intra-tenant.
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(), // routing sous-domaine : winetech, hervai…
  name: text("name").notNull(),
  // Numéro lisible par ordre de création (#1 = winetech).
  number: integer("number"),
  status: text("status", { enum: ["active", "suspended"] })
    .notNull()
    .default("active"),
  // Type commercial → pilote accessMode (white_label/b2c = public ; b2b = privé).
  type: text("type", { enum: PROJECT_TYPES }).notNull().default("b2c"),
  // Contrôle d'accès au chat tenant : 'public' = ouvert à tous ; 'private' =
  // login + appartenance requis. Dérivé de `type` à l'enregistrement.
  accessMode: text("access_mode", { enum: ["public", "private"] })
    .notNull()
    .default("public"),
  // Livraison : site web hébergé, ou widget (clé API sur un site existant).
  deliveryMode: text("delivery_mode", { enum: DELIVERY_MODES })
    .notNull()
    .default("hosted"),
  // Facturation : abonnement entreprise, ou paliers utilisateur.
  billingModel: text("billing_model", { enum: BILLING_MODELS })
    .notNull()
    .default("end_user"),
  // DORMANT : ancien tier free/pro/domaine, remplacé par les paliers (project_plans).
  tier: text("tier", { enum: ["free", "pro", "domaine"] })
    .notNull()
    .default("free"),
  customDomain: text("custom_domain").unique(), // ex. ask.hervai.fr
  theme: jsonb("theme").$type<ProjectTheme>(),
  config: jsonb("config").$type<ProjectConfig>(),
  // overrides de features par-dessus les défauts du tier (cf. lib/features/tiers.ts)
  features: jsonb("features").$type<Partial<ProjectFeatures>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// --- Paliers d'offre d'un projet (remplacent le tier free/pro/domaine) ---
// Catalogue : un plan « entreprise » (B2B/WL), ou N paliers utilisateur (B2C/WL).
// `features` = fonctionnalités incluses ; `isDefault` = palier invité/widget.
export const projectPlans = pgTable(
  "project_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    description: text("description"),
    features: jsonb("features").$type<Partial<ProjectFeatures>>(),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("project_plans_project_idx").on(t.projectId)],
);

// --- Assets binaires d'un projet (logo, etc.) stockés en base ---
// Un asset par (projet, kind) — upsert à chaque téléversement. Le binaire vit
// dans Postgres (inclus au dump, survit aux redéploiements) et est servi par
// /api/assets/<projectId>/<kind>. theme.logoUrl pointe vers cette route.
export const projectAssets = pgTable(
  "project_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("logo"), // logo, favicon…
    mime: text("mime").notNull(),
    bytes: bytea("bytes").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("project_assets_project_kind_unique").on(t.projectId, t.kind),
  ],
);

// --- Comptes utilisateurs : CLOISONNÉS PAR TENANT (marque blanche) ---
// Identité = (projectId, email). Le même email peut exister, indépendamment,
// sur plusieurs tenants. Le rôle (owner/admin/member) vit ici (plus de table
// d'appartenance séparée : 1 compte = 1 projet).
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name"),
    role: text("role", { enum: PROJECT_ROLES }).notNull().default("member"),
    // Palier souscrit (null → palier par défaut du projet).
    planId: uuid("plan_id").references(() => projectPlans.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("users_project_email_unique").on(t.projectId, t.email),
    index("users_project_idx").on(t.projectId),
  ],
);

// --- Admins console (staff Obsidio) : identité GLOBALE séparée des tenants ---
export const platformAdmins = pgTable("platform_admins", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// --- Invitations par email à rejoindre un projet (avec rôle) ---
// Le token n'est jamais stocké en clair : on garde son SHA-256 (tokenHash) ;
// le secret transite uniquement dans l'URL d'invitation envoyée par email.
export const projectInvitations = pgTable(
  "project_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    email: text("email").notNull(), // toujours stocké en minuscules
    role: text("role", { enum: PROJECT_ROLES }).notNull().default("member"),
    tokenHash: text("token_hash").notNull(), // SHA-256 du token, jamais le secret
    invitedBy: uuid("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("project_invitations_project_email_idx").on(t.projectId, t.email),
    index("project_invitations_token_idx").on(t.tokenHash),
  ],
);

// --- Corpus : unité RAG first-class (documents/chunks) ---
// ownerProjectId = null → corpus PARTAGÉ (bibliothèque de domaine : vin, agri…) ;
// ownerProjectId = <tenant> → corpus PRIVÉ du tenant (ses propres données).
export const corpora = pgTable("corpora", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(), // cible de `npm run ingest --corpus <slug>`
  name: text("name").notNull(),
  description: text("description"),
  ownerProjectId: uuid("owner_project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// --- Corpus LUS par un tenant : son corpus privé + les partagés auxquels il s'abonne ---
export const projectCorpora = pgTable(
  "project_corpora",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    corpusId: uuid("corpus_id")
      .notNull()
      .references(() => corpora.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.corpusId] })],
);

// --- Abonnements (source de vérité du tier ; projects.tier en est le cache) ---
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    tier: text("tier", { enum: ["free", "pro", "domaine"] }).notNull(),
    status: text("status", {
      enum: ["active", "trialing", "past_due", "canceled"],
    })
      .notNull()
      .default("active"),
    provider: text("provider", { enum: ["manual", "stripe"] })
      .notNull()
      .default("manual"),
    externalId: text("external_id"), // id abonnement Stripe, nullable
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("subscriptions_project_idx").on(t.projectId)],
);

// --- Sources de données d'un CORPUS (panneau de pilotage de la console) ---
export const dataSources = pgTable(
  "data_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    corpusId: uuid("corpus_id")
      .notNull()
      .references(() => corpora.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: [
        "public_corpus",
        "upload",
        "url_crawl",
        "prestashop_feed",
        "web_search",
      ],
    }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    domain: text("domain"), // sous-corpus alimenté (lie documents.domain)
    status: text("status", { enum: ["idle", "syncing", "error"] })
      .notNull()
      .default("idle"),
    docCount: integer("doc_count").notNull().default(0),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastError: text("last_error"),
    config: jsonb("config").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("data_sources_corpus_idx").on(t.corpusId)],
);

// --- Clés API (auth du widget embarquable, scopées projet) ---
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(), // hash de la clé, jamais le secret en clair
    prefix: text("prefix").notNull(), // préfixe visible pour la console (ask_pk_ab12)
    allowedOrigins: jsonb("allowed_origins").$type<string[]>(), // CORS
    scopes: jsonb("scopes").$type<string[]>(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("api_keys_project_idx").on(t.projectId)],
);

// --- Conversations (historique) ---
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Nouvelle conversation"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("conversations_project_user_idx").on(
      t.projectId,
      t.userId,
      t.updatedAt,
    ),
  ],
);

// --- Messages ---
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role", {
      enum: ["user", "assistant", "system", "tool"],
    }).notNull(),
    content: text("content").notNull(),
    citations: jsonb("citations").$type<Citation[]>(),
    toolCalls: jsonb("tool_calls").$type<ToolCallTrace[]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("messages_conv_idx").on(t.conversationId, t.createdAt)],
);

// --- Documents source du RAG (appartiennent à un CORPUS) ---
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    corpusId: uuid("corpus_id")
      .notNull()
      .references(() => corpora.id, { onDelete: "cascade" }),
    source: text("source").notNull(), // 'legifrance' | 'inao' | 'eurlex' | 'upload'
    domain: text("domain").notNull().default("reglementaire"),
    title: text("title").notNull(),
    url: text("url"),
    reference: text("reference"), // n° article/règlement
    contentHash: text("content_hash").notNull(), // dédup / ré-ingestion idempotente
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("documents_corpus_domain_idx").on(t.corpusId, t.domain)],
);

// --- Chunks vectorisés ---
export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // corpusId dénormalisé : filtre d'isolation dans le chemin ANN chaud (pas de join)
    corpusId: uuid("corpus_id")
      .notNull()
      .references(() => corpora.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count"),
    // mistral-embed produit des vecteurs de dimension 1024
    embedding: vector("embedding", { dimensions: 1024 }).notNull(),
    domain: text("domain").notNull().default("reglementaire"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (t) => [
    // Index ANN HNSW (cosine) : meilleur compromis rappel/latence
    index("chunks_emb_hnsw").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
    // Recherche plein texte française pour la branche lexicale (hybride)
    index("chunks_fts").using(
      "gin",
      sql`to_tsvector('french', ${t.content})`,
    ),
    // Isolation par corpus + filtre sous-corpus
    index("chunks_corpus_domain_idx").on(t.corpusId, t.domain),
  ],
);

export type User = typeof users.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type Chunk = typeof chunks.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type PlatformAdmin = typeof platformAdmins.$inferSelect;
export type ProjectPlan = typeof projectPlans.$inferSelect;
export type ProjectAsset = typeof projectAssets.$inferSelect;
export type ProjectInvitation = typeof projectInvitations.$inferSelect;
export type Corpus = typeof corpora.$inferSelect;
export type ProjectCorpus = typeof projectCorpora.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type DataSource = typeof dataSources.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;

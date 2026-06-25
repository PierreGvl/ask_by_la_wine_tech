"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/admin/guard";
import { generateApiKey } from "@/lib/admin/api-keys";
import * as pa from "@/lib/admin/platform-admins";
import * as q from "@/lib/admin/queries";
import {
  BILLING_MODELS,
  type BillingModel,
  DELIVERY_MODES,
  type DeliveryMode,
  PROJECT_TYPES,
  type ProjectConfig,
  type ProjectFeatures,
  type ProjectTheme,
  type ProjectType,
} from "@/lib/db/schema";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

function asType(v: FormDataEntryValue | null): ProjectType {
  const s = String(v);
  return (PROJECT_TYPES as readonly string[]).includes(s)
    ? (s as ProjectType)
    : "b2c";
}

function asDelivery(v: FormDataEntryValue | null): DeliveryMode {
  const s = String(v);
  return (DELIVERY_MODES as readonly string[]).includes(s)
    ? (s as DeliveryMode)
    : "hosted";
}

function asBilling(v: FormDataEntryValue | null): BillingModel {
  const s = String(v);
  return (BILLING_MODELS as readonly string[]).includes(s)
    ? (s as BillingModel)
    : "end_user";
}

const FEATURE_KEYS = [
  "customRag",
  "webSearch",
  "pdfGeneration",
  "widget",
] as const;

function readFeatures(formData: FormData): Partial<ProjectFeatures> {
  const f: Partial<ProjectFeatures> = {};
  for (const k of FEATURE_KEYS) f[k] = formData.get(`feat_${k}`) === "on";
  return f;
}

export async function createProjectAction(formData: FormData) {
  await requirePlatformAdmin();
  const slug = str(formData.get("slug"));
  const name = str(formData.get("name"));
  if (!slug || !name) throw new Error("slug et name requis");
  const id = await q.createProject({
    slug,
    name,
    type: asType(formData.get("type")),
    deliveryMode: asDelivery(formData.get("deliveryMode")),
    customDomain: str(formData.get("customDomain")) || null,
  });
  revalidatePath("/admin/projects");
  redirect(`/admin/projects/${id}`);
}

export async function updateProjectAction(formData: FormData) {
  await requirePlatformAdmin();
  const id = str(formData.get("id"));
  const existing = await q.getProjectById(id);
  if (!existing) throw new Error("projet introuvable");

  // Theme : on met à jour les couleurs ; logo/favicon/wordmark sont gérés
  // ailleurs (uploaders) et préservés par le spread de l'existant.
  const colors: Record<string, string> = {};
  for (const key of ["navy", "rose", "roseLight"]) {
    const v = str(formData.get(`color_${key}`));
    if (v) colors[key] = v;
  }
  const theme: ProjectTheme = {
    ...(existing.theme ?? {}),
    colors: Object.keys(colors).length ? colors : existing.theme?.colors,
    heroLogoOnly: formData.get("heroLogoOnly") === "on",
  };

  const suggestions = str(formData.get("suggestions"))
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const config: ProjectConfig = {
    ...(existing.config ?? {}),
    systemPrompt: str(formData.get("systemPrompt")) || undefined,
    greeting: str(formData.get("greeting")) || undefined,
    suggestions: suggestions.length ? suggestions : undefined,
    defaultDomain: str(formData.get("defaultDomain")) || undefined,
    searchToolDescription:
      str(formData.get("searchToolDescription")) || undefined,
  };

  const type = asType(formData.get("type"));
  await q.updateProject(id, {
    name: str(formData.get("name")) || existing.name,
    slug: str(formData.get("slug")) || existing.slug,
    customDomain: str(formData.get("customDomain")) || null,
    status: formData.get("status") === "suspended" ? "suspended" : "active",
    type,
    accessMode: q.accessModeForType(type), // dérivé du type commercial
    deliveryMode: asDelivery(formData.get("deliveryMode")),
    billingModel: asBilling(formData.get("billingModel")),
    theme,
    config,
  });
  revalidatePath(`/admin/projects/${id}`);
}

const MAX_ASSET_BYTES = 2 * 1024 * 1024; // 2 Mo

/**
 * Téléverse un asset image d'un projet (logo ou favicon), stocké en base, et
 * pointe le champ de thème correspondant (logoUrl/faviconUrl) vers la route
 * /api/assets avec un cache-bust `?v=`.
 */
export async function uploadProjectImageAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requirePlatformAdmin();
    const projectId = str(formData.get("projectId"));
    const kind = str(formData.get("kind")) === "favicon" ? "favicon" : "logo";
    const label = kind === "favicon" ? "Le favicon" : "Le logo";
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Fichier requis." };
    }
    if (!file.type.startsWith("image/")) {
      return { ok: false, error: `${label} doit être une image.` };
    }
    if (file.size > MAX_ASSET_BYTES) {
      return { ok: false, error: `${label} est trop lourd (max 2 Mo).` };
    }
    const project = await q.getProjectById(projectId);
    if (!project) return { ok: false, error: "Projet introuvable." };

    const bytes = Buffer.from(await file.arrayBuffer());
    await q.upsertProjectAsset({ projectId, kind, mime: file.type, bytes });
    // `?v=` (mtime) force le rafraîchissement des caches navigateur/Image.
    const url = `/api/assets/${projectId}/${kind}?v=${Date.now()}`;
    const themeKey = kind === "favicon" ? "faviconUrl" : "logoUrl";
    await q.updateProject(projectId, {
      theme: { ...(project.theme ?? {}), [themeKey]: url },
    });
    revalidatePath(`/admin/projects/${projectId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur inattendue.",
    };
  }
}

export async function deleteProjectAction(formData: FormData) {
  await requirePlatformAdmin();
  await q.deleteProject(str(formData.get("id")));
  revalidatePath("/admin/projects");
  redirect("/admin/projects");
}

// --- Paliers d'offre ---

export async function createPlanAction(formData: FormData) {
  await requirePlatformAdmin();
  const projectId = str(formData.get("projectId"));
  const name = str(formData.get("name"));
  if (!name) throw new Error("nom requis");
  await q.createPlan({
    projectId,
    name,
    priceCents: Math.max(0, Math.round(Number(formData.get("priceEur")) * 100) || 0),
    description: str(formData.get("description")) || null,
    features: readFeatures(formData),
  });
  revalidatePath(`/admin/projects/${projectId}`);
}

export async function updatePlanAction(formData: FormData) {
  await requirePlatformAdmin();
  const projectId = str(formData.get("projectId"));
  await q.updatePlan(str(formData.get("id")), {
    name: str(formData.get("name")) || undefined,
    priceCents: Math.max(0, Math.round(Number(formData.get("priceEur")) * 100) || 0),
    description: str(formData.get("description")) || null,
    features: readFeatures(formData),
  });
  revalidatePath(`/admin/projects/${projectId}`);
}

export async function deletePlanAction(formData: FormData) {
  await requirePlatformAdmin();
  const projectId = str(formData.get("projectId"));
  await q.deletePlan(str(formData.get("id")));
  revalidatePath(`/admin/projects/${projectId}`);
}

export async function setDefaultPlanAction(formData: FormData) {
  await requirePlatformAdmin();
  const projectId = str(formData.get("projectId"));
  await q.setDefaultPlan(projectId, str(formData.get("id")));
  revalidatePath(`/admin/projects/${projectId}`);
}

/** Assigne un palier à un utilisateur (depuis la console). */
export async function setUserPlanAction(
  projectId: string,
  userId: string,
  planId: string,
): Promise<{ ok: boolean }> {
  await requirePlatformAdmin();
  await q.setUserPlan(userId, planId || null);
  revalidatePath(`/admin/projects/${projectId}`);
  return { ok: true };
}

/** Clé API de test éphémère pour prévisualiser le widget dans la console. */
export async function mintWidgetTestKeyAction(
  projectId: string,
): Promise<{ key: string }> {
  await requirePlatformAdmin();
  const key = generateApiKey();
  await q.insertApiKey({
    projectId,
    name: "[console-test]",
    keyHash: key.keyHash,
    prefix: key.prefix,
    allowedOrigins: [], // vide = toutes origines (iframe console)
  });
  return { key: key.plaintext };
}

export async function createPlatformAdminAction(formData: FormData) {
  await requirePlatformAdmin();
  const email = str(formData.get("email")).toLowerCase();
  const password = str(formData.get("password"));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 12) {
    throw new Error("Email valide et mot de passe (≥ 12 caractères) requis.");
  }
  await pa.createPlatformAdmin({
    email,
    name: str(formData.get("name")) || null,
    password,
  });
  revalidatePath("/admin/users");
}

export async function resetPlatformAdminPasswordAction(formData: FormData) {
  await requirePlatformAdmin();
  const password = str(formData.get("password"));
  if (password.length < 12) {
    throw new Error("Mot de passe ≥ 12 caractères requis.");
  }
  await pa.setPlatformAdminPassword(str(formData.get("id")), password);
  revalidatePath("/admin/users");
}

export async function deletePlatformAdminAction(formData: FormData) {
  await requirePlatformAdmin();
  // Ne jamais supprimer le dernier admin console.
  if ((await pa.countPlatformAdmins()) <= 1) {
    throw new Error("Impossible de supprimer le dernier admin console.");
  }
  await pa.deletePlatformAdmin(str(formData.get("id")));
  revalidatePath("/admin/users");
}

export async function createCorpusAction(formData: FormData) {
  await requirePlatformAdmin();
  const slug = str(formData.get("slug"));
  const name = str(formData.get("name"));
  if (!slug || !name) throw new Error("slug et name requis");
  await q.createSharedCorpus({
    slug,
    name,
    description: str(formData.get("description")) || null,
  });
  revalidatePath("/admin/corpus");
}

export async function createDataSourceAction(formData: FormData) {
  await requirePlatformAdmin();
  await q.createDataSource({
    corpusId: str(formData.get("corpusId")),
    kind: str(formData.get("kind")) as never,
    name: str(formData.get("name")),
    description: str(formData.get("description")) || null,
    domain: str(formData.get("domain")) || null,
  });
  revalidatePath("/admin/corpus");
}

export async function resyncDataSourceAction(formData: FormData) {
  await requirePlatformAdmin();
  await q.markDataSourceSyncing(str(formData.get("id")));
  revalidatePath("/admin/corpus");
}

export async function deleteDataSourceAction(formData: FormData) {
  await requirePlatformAdmin();
  await q.deleteDataSource(str(formData.get("id")));
  revalidatePath("/admin/corpus");
}

export async function revokeApiKeyAction(formData: FormData) {
  await requirePlatformAdmin();
  await q.revokeApiKey(str(formData.get("id")));
  revalidatePath(`/admin/projects/${str(formData.get("projectId"))}`);
}

/** Abonne un tenant à un corpus (son privé est déjà lié). */
export async function linkCorpusAction(formData: FormData) {
  await requirePlatformAdmin();
  const projectId = str(formData.get("projectId"));
  const corpusId = str(formData.get("corpusId"));
  if (corpusId) await q.linkProjectCorpus(projectId, corpusId);
  revalidatePath(`/admin/projects/${projectId}`);
}

export async function unlinkCorpusAction(formData: FormData) {
  await requirePlatformAdmin();
  const projectId = str(formData.get("projectId"));
  await q.unlinkProjectCorpus(projectId, str(formData.get("corpusId")));
  revalidatePath(`/admin/projects/${projectId}`);
}

/** Crée une clé API et RENVOIE le secret en clair (affiché une seule fois). */
export async function createApiKeyAction(
  projectId: string,
  name: string,
  origins: string,
): Promise<{ plaintext: string }> {
  await requirePlatformAdmin();
  const key = generateApiKey();
  await q.insertApiKey({
    projectId,
    name: name.trim() || "Clé widget",
    keyHash: key.keyHash,
    prefix: key.prefix,
    allowedOrigins: origins
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean),
  });
  revalidatePath(`/admin/projects/${projectId}`);
  return { plaintext: key.plaintext };
}

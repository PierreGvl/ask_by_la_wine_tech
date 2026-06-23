import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import {
  deleteProjectAction,
  linkCorpusAction,
  revokeApiKeyAction,
  unlinkCorpusAction,
  updateProjectAction,
} from "@/app/(admin)/admin/actions";
import { ApiKeyCreator } from "@/components/admin/ApiKeyCreator";
import { PlansEditor } from "@/components/admin/PlansEditor";
import { ProjectTabs } from "@/components/admin/ProjectTabs";
import { MembersPanel } from "@/components/projects/MembersPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/Table";
import { Textarea } from "@/components/ui/Textarea";
import { ToastForm } from "@/components/ui/ToastForm";
import {
  getProjectById,
  listApiKeys,
  listProjectCorpora,
  listProjectPlans,
  listSharedCorpora,
  projectStats,
} from "@/lib/admin/queries";
import {
  listPendingInvitations,
  listProjectMembers,
} from "@/lib/projects/queries";

const TYPE_LABEL = {
  white_label: "White Label",
  b2b: "B2B",
  b2c: "B2C",
} as const;
const TYPE_BADGE = {
  white_label: "accent",
  b2b: "warning",
  b2c: "neutral",
} as const;

export default async function ProjectDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const project = await getProjectById(id);
  if (!project) notFound();

  const [
    apiKeys,
    stats,
    members,
    invitations,
    readCorpora,
    sharedCorpora,
    plans,
    session,
  ] = await Promise.all([
    listApiKeys(id),
    projectStats(id),
    listProjectMembers(id),
    listPendingInvitations(id),
    listProjectCorpora(id),
    listSharedCorpora(),
    listProjectPlans(id),
    auth(),
  ]);
  // Candidats à l'abonnement : corpus partagés que le tenant ne lit pas encore.
  const readIds = new Set(readCorpora.map((c) => c.corpusId));
  const candidateCorpora = sharedCorpora.filter((c) => !readIds.has(c.id));
  const cfg = project.config ?? {};
  const colors = project.theme?.colors ?? {};

  // --- Contenu des onglets (rendus serveur, basculés côté client) ---

  const identityTab = (
    <Card>
      <CardBody>
        <ToastForm
          action={updateProjectAction}
          className="grid gap-3 sm:grid-cols-2"
          success="Projet enregistré"
        >
          <input type="hidden" name="id" value={project.id} />
          <TextField name="name" label="Nom" defaultValue={project.name} />
          <TextField name="slug" label="Slug" defaultValue={project.slug} />
          <TextField
            name="customDomain"
            label="Domaine personnalisé"
            defaultValue={project.customDomain ?? ""}
          />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-faint">Statut</span>
            <Select name="status" defaultValue={project.status}>
              <option value="active">active</option>
              <option value="suspended">suspended</option>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-faint">
              Type (pilote l&apos;accès : B2B = privé)
            </span>
            <Select name="type" defaultValue={project.type}>
              <option value="b2c">B2C (public)</option>
              <option value="white_label">White Label (public)</option>
              <option value="b2b">B2B (privé)</option>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-faint">Mode de livraison</span>
            <Select name="deliveryMode" defaultValue={project.deliveryMode}>
              <option value="hosted">Site hébergé</option>
              <option value="widget">Widget (clé API)</option>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-faint">Modèle de facturation</span>
            <Select name="billingModel" defaultValue={project.billingModel}>
              <option value="end_user">Paliers utilisateur</option>
              <option value="company">Abonnement entreprise</option>
            </Select>
          </label>
          <TextField
            name="color_navy"
            label="Couleur principale (navy)"
            defaultValue={colors.navy ?? ""}
            placeholder="#141934"
          />
          <TextField
            name="color_rose"
            label="Couleur accent (rose)"
            defaultValue={colors.rose ?? ""}
            placeholder="#e33170"
          />
          <TextField
            name="color_roseLight"
            label="Fond clair (roseLight)"
            defaultValue={colors.roseLight ?? ""}
            placeholder="#fdeef4"
          />
          <TextField
            name="logoUrl"
            label="URL du logo"
            defaultValue={project.theme?.logoUrl ?? ""}
            placeholder="/logo.png"
          />
          <TextField
            name="defaultDomain"
            label="Sous-corpus par défaut"
            defaultValue={cfg.defaultDomain ?? ""}
            placeholder="reglementaire"
          />
          <AreaField
            name="greeting"
            label="Message d'accueil"
            defaultValue={cfg.greeting ?? ""}
          />
          <AreaField
            name="systemPrompt"
            label="Prompt système (persona métier)"
            defaultValue={cfg.systemPrompt ?? ""}
            rows={5}
            full
          />
          <AreaField
            name="searchToolDescription"
            label="Description de l'outil de recherche"
            defaultValue={cfg.searchToolDescription ?? ""}
            full
          />
          <AreaField
            name="suggestions"
            label="Suggestions (une par ligne)"
            defaultValue={(cfg.suggestions ?? []).join("\n")}
            rows={4}
            full
          />
          <div className="sm:col-span-2">
            <Button type="submit">Enregistrer</Button>
          </div>
        </ToastForm>
      </CardBody>
    </Card>
  );

  const plansTab = (
    <Card>
      <CardBody>
        <PlansEditor
          projectId={project.id}
          billingModel={project.billingModel}
          plans={plans}
        />
      </CardBody>
    </Card>
  );

  const corpusTab = (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <p className="text-xs text-faint">
          Le chat de ce tenant puise dans les corpus ci-dessous : son corpus
          privé + les corpus partagés abonnés. La gestion des sources de données
          se fait dans l&apos;onglet{" "}
          <Link href="/admin/corpus" className="text-rose hover:underline">
            Corpus
          </Link>
          .
        </p>
        <Table>
          <THead>
            <tr>
              <TH>Corpus</TH>
              <TH>Type</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {readCorpora.map((c) => {
              const isPrivate = c.ownerProjectId === project.id;
              return (
                <TR key={c.corpusId}>
                  <TD className="font-medium text-navy-700">{c.name}</TD>
                  <TD>
                    <Badge variant={isPrivate ? "neutral" : "accent"}>
                      {isPrivate ? "privé" : "partagé"}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    {!isPrivate && (
                      <ToastForm
                        action={unlinkCorpusAction}
                        className="inline"
                        success="Désabonné"
                      >
                        <input
                          type="hidden"
                          name="projectId"
                          value={project.id}
                        />
                        <input
                          type="hidden"
                          name="corpusId"
                          value={c.corpusId}
                        />
                        <button
                          type="submit"
                          className="text-xs text-faint hover:text-rose"
                        >
                          Désabonner
                        </button>
                      </ToastForm>
                    )}
                  </TD>
                </TR>
              );
            })}
            {readCorpora.length === 0 && (
              <TR>
                <TD colSpan={3} className="py-5 text-center text-faint">
                  Aucun corpus.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
        {candidateCorpora.length > 0 && (
          <ToastForm
            action={linkCorpusAction}
            className="flex flex-wrap items-end gap-3 border-t border-line pt-4"
            success="Abonné au corpus"
          >
            <input type="hidden" name="projectId" value={project.id} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-faint">Abonner à un corpus partagé</span>
              <Select name="corpusId" className="w-56">
                {candidateCorpora.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </label>
            <Button type="submit" variant="outline">
              Abonner
            </Button>
          </ToastForm>
        )}
      </CardBody>
    </Card>
  );

  const keysTab = (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <Table>
          <THead>
            <tr>
              <TH>Nom</TH>
              <TH>Préfixe</TH>
              <TH>Origines</TH>
              <TH>État</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {apiKeys.map((k) => (
              <TR key={k.id}>
                <TD className="font-medium text-navy-700">{k.name}</TD>
                <TD className="font-mono text-xs">{k.prefix}…</TD>
                <TD className="text-xs text-faint">
                  {(k.allowedOrigins ?? []).join(", ") || "—"}
                </TD>
                <TD>
                  {k.revokedAt ? (
                    <Badge>révoquée</Badge>
                  ) : (
                    <Badge variant="success">active</Badge>
                  )}
                </TD>
                <TD className="text-right">
                  {!k.revokedAt && (
                    <ToastForm
                      action={revokeApiKeyAction}
                      className="inline"
                      success="Clé révoquée"
                    >
                      <input type="hidden" name="id" value={k.id} />
                      <input type="hidden" name="projectId" value={project.id} />
                      <button
                        type="submit"
                        className="text-xs text-faint hover:text-rose"
                      >
                        Révoquer
                      </button>
                    </ToastForm>
                  )}
                </TD>
              </TR>
            ))}
            {apiKeys.length === 0 && (
              <TR>
                <TD colSpan={5} className="py-5 text-center text-faint">
                  Aucune clé.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
        <div className="border-t border-line pt-4">
          <ApiKeyCreator projectId={project.id} />
        </div>
      </CardBody>
    </Card>
  );

  const membersTab = (
    <Card>
      <CardBody>
        <MembersPanel
          projectId={project.id}
          members={members}
          invitations={invitations}
          currentUserId={session?.user?.id ?? null}
          plans={plans.map((p) => ({ id: p.id, name: p.name }))}
        />
      </CardBody>
    </Card>
  );

  const content: Record<string, ReactNode> = {
    identity: identityTab,
    plans: plansTab,
    corpus: corpusTab,
    members: membersTab,
    // L'onglet Clés API n'a de sens que pour une livraison par widget.
    ...(project.deliveryMode === "widget" ? { keys: keysTab } : {}),
  };
  const tabs = [
    { key: "identity", label: "Identité & configuration" },
    { key: "plans", label: "Offre & paliers" },
    { key: "corpus", label: "Corpus lus par ce tenant" },
    ...(project.deliveryMode === "widget"
      ? [{ key: "keys", label: "Clés API (widget)" }]
      : []),
    { key: "members", label: "Membres & invitations" },
  ];
  const active = tab && content[tab] ? tab : "identity";

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-navy">
            {project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono text-faint">
              #{project.number} · {project.slug}
            </span>
            <Badge variant={TYPE_BADGE[project.type]}>
              {TYPE_LABEL[project.type]}
            </Badge>
            <Badge variant={project.status === "active" ? "success" : "warning"}>
              {project.status}
            </Badge>
            <Badge
              variant={project.accessMode === "private" ? "accent" : "neutral"}
            >
              {project.accessMode === "private" ? "privé" : "public"}
            </Badge>
            <Badge variant="neutral">
              {project.deliveryMode === "widget" ? "widget" : "hébergé"}
            </Badge>
            <span className="text-faint">
              {stats.documents} docs · {stats.chunks} chunks
            </span>
          </div>
        </div>
        <form action={deleteProjectAction}>
          <input type="hidden" name="id" value={project.id} />
          <Button variant="outline" size="sm" type="submit">
            Supprimer
          </Button>
        </form>
      </div>

      <ProjectTabs
        basePath={`/admin/projects/${project.id}`}
        active={active}
        tabs={tabs}
      />
      <div>{content[active]}</div>
    </div>
  );
}

function TextField({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-faint">{label}</span>
      <Input name={name} defaultValue={defaultValue} placeholder={placeholder} />
    </label>
  );
}

function AreaField({
  name,
  label,
  defaultValue,
  rows = 2,
  full,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  rows?: number;
  full?: boolean;
}) {
  return (
    <label
      className={`flex flex-col gap-1 text-sm ${full ? "sm:col-span-2" : ""}`}
    >
      <span className="text-faint">{label}</span>
      <Textarea name={name} defaultValue={defaultValue} rows={rows} />
    </label>
  );
}

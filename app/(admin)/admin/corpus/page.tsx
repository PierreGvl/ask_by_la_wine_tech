import {
  createCorpusAction,
  createDataSourceAction,
  deleteDataSourceAction,
  resyncDataSourceAction,
} from "@/app/(admin)/admin/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/Table";
import { ToastForm } from "@/components/ui/ToastForm";
import {
  corpusReaders,
  corpusStats,
  listCorpora,
  listCorpusDataSources,
} from "@/lib/admin/queries";

const DATA_SOURCE_KINDS = [
  "public_corpus",
  "upload",
  "url_crawl",
  "prestashop_feed",
  "web_search",
] as const;

function fmtDate(d: Date | null) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}

export default async function CorpusPage() {
  const list = await listCorpora();
  const corpora = await Promise.all(
    list.map(async (c) => ({
      ...c,
      stats: await corpusStats(c.id),
      readers: await corpusReaders(c.id),
      sources: await listCorpusDataSources(c.id),
    })),
  );

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-navy">
          Corpus
        </h1>
        <p className="text-sm text-faint">
          Chaque corpus (partagé par domaine, ou privé d&apos;un tenant) est
          alimenté par une ou plusieurs sources de données.
        </p>
      </div>

      {corpora.map((c) => {
        const shared = c.ownerProjectId === null;
        return (
          <Card key={c.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{c.name}</CardTitle>
                <Badge variant={shared ? "accent" : "neutral"}>
                  {shared ? "partagé" : "privé"}
                </Badge>
                {!shared && c.ownerName && (
                  <span className="text-xs text-faint">
                    propriétaire : {c.ownerName}
                  </span>
                )}
                <span className="font-mono text-xs text-faint">{c.slug}</span>
              </div>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              {c.description && (
                <p className="text-sm text-faint">{c.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-faint">
                <span>
                  {c.stats.documents} docs · {c.stats.chunks} chunks
                </span>
                <span>
                  Dernière ingestion : {fmtDate(c.stats.lastIngestedAt)}
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  Lu par :
                  {c.readers.length === 0 ? (
                    <span>—</span>
                  ) : (
                    c.readers.map((r) => (
                      <Badge key={r.id} variant="neutral">
                        {r.name}
                      </Badge>
                    ))
                  )}
                </span>
              </div>

              <Table>
                <THead>
                  <tr>
                    <TH>Source de données</TH>
                    <TH>Type</TH>
                    <TH>Description</TH>
                    <TH>Sous-corpus</TH>
                    <TH>Docs</TH>
                    <TH>Statut</TH>
                    <TH>Dernière sync</TH>
                    <TH />
                  </tr>
                </THead>
                <TBody>
                  {c.sources.map((s) => (
                    <TR key={s.id}>
                      <TD className="font-medium text-navy-700">{s.name}</TD>
                      <TD className="font-mono text-xs">{s.kind}</TD>
                      <TD className="max-w-[16rem] text-xs text-faint">
                        {s.description ?? "—"}
                      </TD>
                      <TD className="text-xs text-faint">{s.domain ?? "—"}</TD>
                      <TD>{s.docCount}</TD>
                      <TD>
                        <Badge
                          variant={
                            s.status === "error"
                              ? "danger"
                              : s.status === "syncing"
                                ? "accent"
                                : "neutral"
                          }
                        >
                          {s.status}
                        </Badge>
                      </TD>
                      <TD className="text-xs text-faint">
                        {fmtDate(s.lastSyncedAt)}
                      </TD>
                      <TD className="whitespace-nowrap text-right">
                        <ToastForm
                          action={resyncDataSourceAction}
                          className="inline"
                          success="Source marquée à resynchroniser"
                        >
                          <input type="hidden" name="id" value={s.id} />
                          <button
                            type="submit"
                            className="mr-3 text-xs font-medium text-navy-700 hover:text-rose hover:underline"
                          >
                            Re-sync
                          </button>
                        </ToastForm>
                        <ToastForm
                          action={deleteDataSourceAction}
                          className="inline"
                          success="Source supprimée"
                        >
                          <input type="hidden" name="id" value={s.id} />
                          <button
                            type="submit"
                            className="text-xs text-faint hover:text-rose"
                          >
                            Suppr.
                          </button>
                        </ToastForm>
                      </TD>
                    </TR>
                  ))}
                  {c.sources.length === 0 && (
                    <TR>
                      <TD colSpan={8} className="py-4 text-center text-faint">
                        Aucune source de données.
                      </TD>
                    </TR>
                  )}
                </TBody>
              </Table>

              <ToastForm
                action={createDataSourceAction}
                className="grid gap-3 border-t border-line pt-4 sm:grid-cols-4"
                success="Source ajoutée"
              >
                <input type="hidden" name="corpusId" value={c.id} />
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-faint">Nom</span>
                  <Input name="name" placeholder="Légifrance AOC" required />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-faint">Type</span>
                  <Select name="kind">
                    {DATA_SOURCE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-faint">Sous-corpus</span>
                  <Input name="domain" placeholder="reglementaire" />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-faint">Description</span>
                  <Input name="description" placeholder="Articles AOC…" />
                </label>
                <div className="sm:col-span-4">
                  <Button type="submit" variant="outline">
                    Ajouter une source à ce corpus
                  </Button>
                </div>
              </ToastForm>
              <p className="text-xs text-faint">
                « Re-sync » marque la source à resynchroniser ; l&apos;ingestion
                réelle est CLI :{" "}
                <code className="font-mono">
                  npm run ingest -- --corpus {c.slug}
                </code>
                .
              </p>
            </CardBody>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle>Nouveau corpus partagé</CardTitle>
        </CardHeader>
        <CardBody>
          <ToastForm
            action={createCorpusAction}
            className="grid gap-3 sm:grid-cols-2"
            success="Corpus créé"
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-faint">Nom</span>
              <Input
                name="name"
                placeholder="Réglementation agriculture"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-faint">Slug</span>
              <Input name="slug" placeholder="agriculture" required />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-faint">Description</span>
              <Input
                name="description"
                placeholder="Réglementation agricole française et européenne"
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit">Créer le corpus</Button>
            </div>
          </ToastForm>
        </CardBody>
      </Card>
    </div>
  );
}

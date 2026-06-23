import {
  createPlanAction,
  deletePlanAction,
  setDefaultPlanAction,
  updatePlanAction,
} from "@/app/(admin)/admin/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ToastForm } from "@/components/ui/ToastForm";
import type { BillingModel, ProjectPlan } from "@/lib/db/schema";

const FEATURES = [
  { key: "customRag", label: "RAG perso" },
  { key: "webSearch", label: "Web search" },
  { key: "pdfGeneration", label: "Génération PDF" },
  { key: "widget", label: "Widget" },
] as const;

function FeatureChecks({ plan }: { plan?: ProjectPlan }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {FEATURES.map((f) => (
        <label key={f.key} className="flex items-center gap-1.5 text-xs text-ink">
          <input
            type="checkbox"
            name={`feat_${f.key}`}
            defaultChecked={Boolean(plan?.features?.[f.key])}
            className="accent-rose"
          />
          {f.label}
        </label>
      ))}
    </div>
  );
}

/**
 * Édition des paliers d'offre d'un projet (catalogue). Tout par formulaire +
 * server actions (pas d'état client). Le palier « par défaut » sert aux
 * invités / au widget. `billingModel` se règle dans « Identité & configuration ».
 */
export function PlansEditor({
  projectId,
  billingModel,
  plans,
}: {
  projectId: string;
  billingModel: BillingModel;
  plans: ProjectPlan[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-faint">
        {billingModel === "company"
          ? "Abonnement payé par l'entreprise (B2B / White Label)."
          : "Paliers proposés aux utilisateurs finaux (B2C / White Label)."}{" "}
        Le palier « par défaut » s&apos;applique aux invités et au widget. Les
        cases définissent les fonctionnalités incluses.
      </p>

      {plans.map((plan) => (
        <div
          key={plan.id}
          className="flex flex-col gap-3 rounded-lg border border-line p-3"
        >
          <ToastForm
            action={updatePlanAction}
            className="flex flex-col gap-3"
            success="Palier enregistré"
          >
            <input type="hidden" name="id" value={plan.id} />
            <input type="hidden" name="projectId" value={projectId} />
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-faint">Nom</span>
                <Input name="name" defaultValue={plan.name} className="w-44" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-faint">Prix €/mois</span>
                <Input
                  name="priceEur"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={plan.priceCents / 100}
                  className="w-24"
                />
              </label>
              {plan.isDefault && <Badge variant="accent">par défaut</Badge>}
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-faint">Description</span>
              <Input
                name="description"
                defaultValue={plan.description ?? ""}
                placeholder="Personnalisation RAG, génération de démarches…"
              />
            </label>
            <FeatureChecks plan={plan} />
            <div>
              <Button type="submit" variant="outline" size="sm">
                Enregistrer
              </Button>
            </div>
          </ToastForm>
          <div className="flex items-center gap-3 border-t border-line pt-2 text-xs">
            {!plan.isDefault && (
              <ToastForm action={setDefaultPlanAction} success="Palier par défaut mis à jour">
                <input type="hidden" name="id" value={plan.id} />
                <input type="hidden" name="projectId" value={projectId} />
                <button
                  type="submit"
                  className="font-medium text-navy-700 hover:text-rose hover:underline"
                >
                  Définir par défaut
                </button>
              </ToastForm>
            )}
            {!plan.isDefault && (
              <ToastForm action={deletePlanAction} success="Palier supprimé">
                <input type="hidden" name="id" value={plan.id} />
                <input type="hidden" name="projectId" value={projectId} />
                <button type="submit" className="text-faint hover:text-rose">
                  Supprimer
                </button>
              </ToastForm>
            )}
          </div>
        </div>
      ))}

      {/* Nouveau palier */}
      <ToastForm
        action={createPlanAction}
        className="flex flex-col gap-3 border-t border-line pt-4"
        success="Palier ajouté"
      >
        <input type="hidden" name="projectId" value={projectId} />
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-faint">Nom du palier</span>
            <Input name="name" placeholder="Premium" required className="w-44" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-faint">Prix €/mois</span>
            <Input
              name="priceEur"
              type="number"
              min="0"
              step="1"
              placeholder="49"
              className="w-24"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-faint">Description</span>
          <Input
            name="description"
            placeholder="Personnalisation RAG avec ses propres données…"
          />
        </label>
        <FeatureChecks />
        <div>
          <Button type="submit" variant="outline">
            Ajouter un palier
          </Button>
        </div>
      </ToastForm>
    </div>
  );
}

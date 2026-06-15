#!/usr/bin/env bash
# Télécharge le socle réglementaire vitivinicole de l'UE (versions FR) depuis
# EUR-Lex dans corpus/, avec un descripteur .meta.json par texte (titre + lien
# pour les citations). Idempotent : relancer écrase les fichiers.
#
# Usage : bash scripts/fetch-corpus-eu.sh
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)/corpus"
mkdir -p "$DIR"

# CELEX | nom de fichier | titre | référence
texts=(
  "32013R1308|reglement-ue-1308-2013-ocm.html|Règlement (UE) n° 1308/2013 — OCM (organisation commune des marchés agricoles)|Règlement (UE) n° 1308/2013"
  "32019R0033|reglement-ue-2019-33-aop-igp-etiquetage.html|Règlement délégué (UE) 2019/33 — AOP, IGP, mentions et étiquetage des produits vitivinicoles|Règlement délégué (UE) 2019/33"
  "32019R0034|reglement-ue-2019-34-procedures-aop-igp.html|Règlement d'exécution (UE) 2019/34 — procédures AOP/IGP et contrôles|Règlement d'exécution (UE) 2019/34"
  "32019R0934|reglement-ue-2019-934-pratiques-oenologiques.html|Règlement délégué (UE) 2019/934 — pratiques œnologiques et restrictions|Règlement délégué (UE) 2019/934"
  "32011R1169|reglement-ue-1169-2011-information-consommateurs.html|Règlement (UE) n° 1169/2011 — information des consommateurs sur les denrées (étiquetage, allergènes)|Règlement (UE) n° 1169/2011"
  "32018R0273|reglement-ue-2018-273-casier-viticole-declarations.html|Règlement délégué (UE) 2018/273 — casier viticole, déclarations, documents d'accompagnement, autorisations de plantation|Règlement délégué (UE) 2018/273"
  "32018R0274|reglement-ue-2018-274-execution-casier-declarations.html|Règlement d'exécution (UE) 2018/274 — casier viticole et déclarations (modalités)|Règlement d'exécution (UE) 2018/274"
)

for entry in "${texts[@]}"; do
  IFS="|" read -r celex file title ref <<< "$entry"
  url="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:$celex"
  echo "→ $file"
  curl -sL --max-time 90 \
    "https://eur-lex.europa.eu/legal-content/FR/TXT/HTML/?uri=CELEX:$celex" \
    -o "$DIR/$file"
  cat > "$DIR/$file.meta.json" <<EOF
{
  "title": "$title",
  "url": "$url",
  "reference": "$ref",
  "source": "eurlex",
  "domain": "reglementaire"
}
EOF
done

echo "✓ Corpus UE téléchargé dans $DIR"
echo "  Ingestion : npm run ingest -- --path ./corpus"

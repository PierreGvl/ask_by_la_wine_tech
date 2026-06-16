# Ask By la Wine Tech — Point d'avancement

> **Une IA Souveraine pour répondre à toutes les questions des vignerons.**
> Document de synthèse — état du projet, fonctionnement, et perspectives.

---

## 1. En une phrase

**Ask By la Wine Tech** est un assistant conversationnel (type ChatGPT/Claude)
**spécialisé dans le vin**, qui répond aux questions des vignerons **en
s'appuyant sur des textes officiels** et en **citant ses sources**. Il est
**souverain** (technologie 100 % européenne) et conçu pour **s'enrichir en
continu** sans jamais être limité dans son périmètre.

🔗 **En ligne et fonctionnel : https://ask.obsidio.fr**

---

## 2. Ce qui fonctionne aujourd'hui

L'application est **déployée en production** et pleinement opérationnelle.

| Fonctionnalité | État |
|---|---|
| Interface de chat (style Claude/ChatGPT) | ✅ |
| Réponses en **streaming** (mot à mot) | ✅ |
| **Comptes utilisateurs** (inscription email / mot de passe) | ✅ |
| **Historique** des conversations (création, renommage, suppression) | ✅ |
| Mode **invité** (utilisable sans compte, incitation à se connecter) | ✅ |
| **RAG réglementaire** avec réponses **sourcées et citées** | ✅ |
| Identité visuelle (logo, palette, typographie de la marque) | ✅ |
| HTTPS, nom de domaine dédié | ✅ |

**Démonstration possible en rendez-vous** : poser une question comme
« Quelles mentions sont obligatoires sur une étiquette de vin AOP ? » ou
« Quels allergènes doivent figurer sur l'étiquette ? » → l'assistant répond
précisément **en citant les règlements concernés**.

---

## 3. Fonctionnement global

### Le principe en 4 étapes

```
1. L'utilisateur pose une question
        ↓
2. L'assistant recherche les passages pertinents dans une base
   documentaire vectorielle (textes officiels du vin)
        ↓
3. Il rédige une réponse fondée UNIQUEMENT sur ces passages
        ↓
4. Il affiche la réponse + les SOURCES citées (liens cliquables)
```

### La technologie (souveraine)

- **Moteur IA : Mistral** (entreprise française) — c'est l'argument de
  **souveraineté** : aucune dépendance aux acteurs américains, données
  traitées en Europe.
- **Application web : Next.js** (framework moderne, rapide, évolutif).
- **Base de données : PostgreSQL** auto-hébergée, avec moteur de **recherche
  vectorielle** (pgvector) — héberge à la fois les comptes, l'historique et la
  base documentaire.
- **Hébergement : VPS européen + Coolify** (déploiement maîtrisé, pas de cloud
  US).

---

## 4. Le RAG — le cœur de la fiabilité

Le **RAG** (Retrieval-Augmented Generation, « génération augmentée par
récupération ») est ce qui distingue ce projet d'un simple chatbot.

### Pourquoi ce choix

Une IA classique « invente » parfois des réponses (hallucinations) —
**inacceptable sur des questions réglementaires**. Trois approches étaient
possibles :

| Approche | Verdict |
|---|---|
| IA seule (sans sources) | ❌ risque d'erreurs, pas de preuve |
| Ré-entraîner un modèle (fine-tuning) | ❌ coûteux, figé, sans citations, périmé dès qu'une loi change |
| **RAG (retenu)** | ✅ exact, **cite ses sources**, **mis à jour en ajoutant un document**, extensible |

### Comment la fiabilité est garantie

- **Réponses ancrées** : l'assistant répond à partir des textes récupérés, pas
  de sa « mémoire ».
- **Citations cliquables** : chaque réponse renvoie aux sources officielles
  (ex. liens EUR-Lex).
- **Garde-fou anti-erreur** : si aucune source fiable ne couvre la question,
  l'assistant le **dit explicitement** au lieu d'inventer.
- **Recherche hybride** : combine recherche *sémantique* (sens) et *lexicale*
  (mots-clés) pour ne rien rater.

### Ce qui est déjà en base

**Socle réglementaire européen du vin** — 8 textes officiels, ~870 extraits
indexés :

| Texte | Couvre |
|---|---|
| Règlement (UE) 1308/2013 | Cadre général (OCM), vigne & vin |
| Règlement délégué (UE) 2019/33 | AOP/IGP, **étiquetage**, présentation |
| Règlement d'exécution (UE) 2019/34 | Procédures AOP/IGP, contrôles |
| Règlement délégué (UE) 2019/934 | **Pratiques œnologiques**, intrants |
| Règlement (UE) 1169/2011 | Information consommateurs, **allergènes** |
| Règlement délégué (UE) 2018/273 | **Casier viticole, déclarations**, plantations |
| Règlement d'exécution (UE) 2018/274 | Casier & déclarations (modalités) |
| Règlement (UE) 2018/848 | **Production biologique** |

→ Couvre déjà l'étiquetage, les appellations, les pratiques œnologiques, les
déclarations, le bio et l'information du consommateur.

### Conçu pour évoluer (architecture « agentique »)

- La recherche documentaire est un **outil** que l'IA mobilise elle-même, et
  peut **décomposer une question complexe en plusieurs recherches**.
- **Ajouter un domaine = ajouter des documents** : œnologie, commercial, RH
  viticole, fiscalité… **aucune refonte nécessaire**.
- Chaque document est étiqueté par **domaine**, ce qui permettra de spécialiser
  ou filtrer les réponses à terme.

---

## 5. Infrastructure & exploitation

- **Code versionné** (Git/GitHub), **déploiement automatique** à chaque mise à
  jour (push → build → mise en ligne).
- **Sauvegardes** possibles via la base de données managée.
- **Coûts maîtrisés** : moteur IA facturé à l'usage (très faible pour les
  embeddings), hébergement à prix fixe.

---

## 6. Pistes pour la suite

### Enrichissement du corpus (priorité métier)

- **Droit national français via l'API officielle Légifrance (PISTE)** →
  intégration du **Code rural**, etc., avec **mises à jour automatiques** quand
  les textes évoluent. *(Approche retenue.)*
- **Cahiers des charges INAO** (règles par appellation : AOP/IGP) — la donnée la
  plus demandée par les vignerons.
- **Fiscalité / douanes** (accises, DRM, CRD) via documents officiels.
- **Œnologie pratique** (au-delà du réglementaire) : itinéraires techniques,
  guides.

### Automatisation

- **Mise à jour automatique de la base** documentaire (ingestion programmée),
  pour que le corpus reste toujours à jour sans intervention.

### Produit

- Retour utilisateur sur les réponses (pouce haut/bas), export de conversation.
- Spécialisation par **domaine** (réglementaire, œnologie, commercial…).
- Tableau de bord d'usage.

---

## 7. Pérennité — « et quand les IA sauront tout ? »

Objection légitime : *les LLM ne vont-ils pas bientôt « connaître » tout le
droit, rendant l'outil inutile ?* Réponse : **non — la valeur tient, parce
qu'elle ne dépend pas de la puissance du modèle** mais de l'ancrage documentaire.

- **Fraîcheur** : un modèle a une date de coupure ; le droit change en
  permanence. Ancrer sur un corpus **maintenu** garantit des réponses **à
  jour** — un problème structurel que « plus de puissance » ne résout pas.
- **Traçabilité** : en juridique, il faut **citer la source**. Un modèle plus
  puissant se trompe plus rarement mais de façon **plus crédible** — donc plus
  dangereuse. La citation vérifiable reste **indispensable**.
- **Précision de la longue traîne** : récupérer le **texte exact** (un cahier
  des charges précis, un seuil) bat la mémoire approximative d'un modèle.
- **Données privées** : ingérer les documents **propres** à un domaine / une
  coopérative — un LLM générique n'y aura jamais accès.

**Analogie** : les avocats ont un cerveau brillant *et* utilisent Légifrance au
quotidien. Le LLM = le cerveau ; le RAG = la bibliothèque juridique à jour. On a
besoin des deux. Et comme l'architecture est **agnostique au modèle**, chaque
nouveau modèle Mistral **améliore** le produit au lieu de le rendre obsolète.

> En clair : ce qui se banalise, c'est la connaissance *générale* ; ce qui reste
> précieux, c'est le **socle sourcé, à jour et vérifiable** + la **distribution**.

## 8. Arguments clés pour la commercialisation

- 🇪🇺 **Souverain** : IA française (Mistral), données hébergées en Europe, zéro
  dépendance américaine.
- 🎯 **Fiable** : répond **avec sources officielles citées**, refuse d'inventer
  — crucial sur le réglementaire.
- 🔄 **Toujours à jour** : la connaissance s'enrichit en ajoutant des documents
  (et automatiquement via l'API Légifrance à venir).
- 🌿 **Spécialisé filière vin**, pensé **pour et avec** l'écosystème de la Wine
  Tech.
- 🚀 **Déjà en ligne et démontrable**, évolutif sans limite de périmètre.

---

*Document généré le 2026-06-15 — projet en production sur https://ask.obsidio.fr*

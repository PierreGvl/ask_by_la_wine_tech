/**
 * Pipeline d'ingestion RAG (CLI).
 *
 * Usage :
 *   npm run ingest -- --path ./corpus [--source upload] [--domain reglementaire]
 *
 * Parcourt un dossier de fichiers (.pdf, .html, .txt, .md), les parse,
 * les découpe, calcule les embeddings Mistral et les upsert dans pgvector.
 * Idempotent : un fichier inchangé (même hash) est ignoré.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env" });

const SUPPORTED = new Set([".pdf", ".html", ".htm", ".txt", ".md"]);

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1]?.startsWith("--") ? "true" : argv[++i];
      args[key] = val ?? "true";
    }
  }
  return args;
}

type DocMeta = {
  title?: string;
  url?: string;
  reference?: string;
  source?: string;
  domain?: string;
};

/** Lit un descripteur optionnel `<fichier>.meta.json` à côté du document. */
async function readMeta(file: string): Promise<DocMeta> {
  try {
    const raw = await readFile(`${file}.meta.json`, "utf8");
    return JSON.parse(raw) as DocMeta;
  } catch {
    return {};
  }
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) files.push(...(await listFiles(full)));
    else if (e.name.toLowerCase() === "readme.md") continue; // doc, pas du corpus
    else if (SUPPORTED.has(extname(e.name).toLowerCase())) files.push(full);
  }
  return files;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = resolve(args.path ?? "./corpus");
  const source = args.source ?? "upload";
  const domain = args.domain ?? "reglementaire";

  // Imports différés (après chargement de .env, validé par lib/env).
  const { parseFile } = await import("./parse");
  const { chunkText } = await import("./chunk");
  const { upsertDocument } = await import("./embed-upsert");

  const files = await listFiles(dir);
  if (files.length === 0) {
    console.log(`Aucun fichier supporté trouvé dans ${dir}`);
    return;
  }
  console.log(`${files.length} fichier(s) à traiter depuis ${dir}\n`);

  let ingested = 0;
  let skipped = 0;
  for (const file of files) {
    console.log(`• ${file}`);
    const { title: parsedTitle, text } = await parseFile(file);
    if (!text) {
      console.log("  (vide, ignoré)");
      continue;
    }
    const meta = await readMeta(file);
    const contentHash = createHash("sha256").update(text).digest("hex");
    const docChunks = await chunkText(text);
    console.log(`  ${docChunks.length} chunk(s)`);

    const status = await upsertDocument({
      source: meta.source ?? source,
      domain: meta.domain ?? domain,
      title: meta.title ?? parsedTitle,
      url: meta.url ?? null,
      reference: meta.reference ?? null,
      contentHash,
      chunks: docChunks,
    });
    if (status === "skipped") {
      skipped++;
      console.log("  ↪ inchangé, ignoré");
    } else {
      ingested++;
      console.log("  ✓ ingéré");
    }
  }

  console.log(`\n✅ Terminé : ${ingested} ingéré(s), ${skipped} ignoré(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Ingestion échouée :", err);
  process.exit(1);
});

/* npm run db:encrypt-docs [-- --dry-run] — seal every identity document under the
   CURRENT DOC_ENCRYPTION_KEY.

   Two jobs, one pass over verification_docs:
     1. documents stored before encryption at rest existed (plain files) are sealed;
     2. documents sealed with DOC_ENCRYPTION_KEY_PREVIOUS are re-sealed with the
        current key — the second half of a key rotation (DEPLOY.md, "Rotating the
        document key").
   A document already sealed with the current key is left alone, so re-running is
   harmless. Each object is written atomically by the store; a crash mid-run leaves
   every document either old-sealed or new-sealed, never torn.

   Prints counts only: no path, no file name, no tutor id. Exits 1 on any error. */
import { loadEnv } from "./_paths";
loadEnv();

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { asc } from "drizzle-orm";
import { verificationDocs } from "../src/schema";
import { objectStore } from "../src/storage";
import { docEncryptionConfigured, isSealedDoc, openDoc, sealDoc } from "../src/doc-crypto";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`Tnajem db:encrypt-docs${dryRun ? " — DRY RUN (nothing is written)" : ""}`);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!docEncryptionConfigured()) throw new Error("DOC_ENCRYPTION_KEY is not set");

  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client);
  const store = objectStore();
  const counts = { total: 0, alreadyCurrent: 0, sealedPlain: 0, resealedPrevious: 0, missing: 0, errors: 0 };

  try {
    const rows = await db
      .select({ id: verificationDocs.id, storagePath: verificationDocs.storagePath })
      .from(verificationDocs)
      .orderBy(asc(verificationDocs.createdAt));

    for (const row of rows) {
      counts.total++;
      try {
        const stored = await store.get(row.storagePath);
        if (!stored) {
          counts.missing++;
          continue;
        }
        /* openDoc refuses plaintext in production. This script is the one place that
           must read it there, so plaintext is recognised before openDoc is asked. */
        if (!isSealedDoc(stored)) {
          if (!dryRun) await store.put(row.storagePath, sealDoc(row.storagePath, stored));
          counts.sealedPlain++;
          continue;
        }
        const opened = openDoc(row.storagePath, stored);
        if (opened.sealedWith === "current") {
          counts.alreadyCurrent++;
          continue;
        }
        if (!dryRun) await store.put(row.storagePath, sealDoc(row.storagePath, opened.plaintext));
        counts.resealedPrevious++;
      } catch (e) {
        counts.errors++;
        console.error(`  ✗ document ${counts.total}: ${(e as { code?: string }).code ?? (e as Error).name}`);
      }
    }
  } finally {
    await client.end({ timeout: 2 });
  }

  const verb = dryRun ? "would be" : "were";
  console.log(`  documents:                         ${counts.total}`);
  console.log(`  already sealed with the current key: ${counts.alreadyCurrent}`);
  console.log(`  plain files that ${verb} sealed:    ${counts.sealedPlain}`);
  console.log(`  old-key documents that ${verb} re-sealed: ${counts.resealedPrevious}`);
  console.log(`  rows whose object is missing:       ${counts.missing}`);
  console.log(`  errors:                             ${counts.errors}`);
  if (counts.errors > 0) process.exit(1);
  console.log(`\n✓ done${dryRun ? " (dry run)" : ""}`);
}

main().catch((e) => {
  console.error(`✗ db:encrypt-docs: ${(e as Error).message}`);
  process.exit(1);
});

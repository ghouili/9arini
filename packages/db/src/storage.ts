import { join, resolve, sep } from "node:path";

/* Where identity documents live, and how a stored path is resolved back to a
   file. ONE implementation, imported by every process that touches the store:
   the uploader, the admin doc route, and the retention purge.

   There used to be three copies of `STORAGE_DIR || join(process.cwd(),
   ".storage")`, and they agreed only because all three happened to run with the
   same cwd. In a monorepo they do not: `npm run db:purge -w @tnajem/web` runs
   with cwd apps/web, Next's standalone server.js chdir()s to its own folder, and
   a container entrypoint sets whatever it likes. That already bit once — moving
   the app into apps/ repointed the purge at apps/web/.storage while the real
   scans were still at the repo root. */

/** Absolute root of the document store. */
export function storageBase(): string {
  const dir = process.env.STORAGE_DIR?.trim();
  if (dir) return resolve(dir);

  /* STORAGE_DIR is REQUIRED in production, and this throw is a data-protection
     control rather than a config nicety.

     The purge treats a missing file as non-fatal: it counts the document
     "already gone" and DELETES THE ROW ANYWAY. So a job that starts with the
     wrong base directory finds nothing, deletes every row, and reports success —
     leaving orphaned national ID scans on disk with nothing pointing at them,
     forever. Guessing from cwd is not an acceptable default for that. */
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "STORAGE_DIR is required in production — refusing to fall back to a " +
        "cwd-relative path for identity documents.",
    );
  }
  return join(process.cwd(), ".storage");
}

/** The tutor-scoped subdirectory a document belongs in. */
export function tutorDocDir(tutorId: string): string {
  return join(storageBase(), "verification", tutorId);
}

/* Containment check for a stored path. The value comes from our own database
   (written by submitVerification, which sanitises), so this is defence in depth
   rather than a live hole — but the caller reads arbitrary bytes off disk and
   returns them, so one bad row (a bad migration, a manual edit, a future writer
   that forgets to sanitise) must not become "read any file on the box".

   Splits on BOTH separators deliberately. scripts/sql/0006 canonicalised the
   stored values to "/", but a restored backup or a row written by an older build
   can still carry "\", and such a row must stay readable rather than silently
   404. Do not "simplify" this to a single separator. */
export function resolveDocPath(baseDir: string, storagePath: string): string | null {
  const parts = storagePath.split(/[\\/]+/).filter((p) => p && p !== ".");
  if (parts.length === 0 || parts.some((p) => p === "..")) return null;
  const root = resolve(baseDir);
  const abs = resolve(root, ...parts);
  return abs === root || abs.startsWith(root + sep) ? abs : null;
}

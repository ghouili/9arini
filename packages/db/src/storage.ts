import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { Readable } from "node:stream";

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

/* ══════════════════════════════════════════════════════════════════════════════
   THE OBJECT STORE — every upload read, write and delete goes through this.

   Four modules (the verification upload, the admin doc route, materials +
   avatars, the retention purge) used to call node:fs directly, each with
   their own mkdir/writeFile/createReadStream/rm. That tied the product to one
   box's disk: a second API instance, a container without the volume, or object
   storage (R2/S3/MinIO) would each have meant finding and rewriting all of them.

   KEYS are POSIX relative paths — exactly what the database already stores
   (verification_docs.storage_path, materials.storage_path, tutors.avatar_path +
   "-md.webp"). A key never starts with "/", never contains "..". Legacy
   backslash values (pre-0006 rows, restored backups) are accepted on READ and
   DELETE and normalised; a WRITE always takes a clean POSIX key.

   DRIVERS
     local  (default) files under STORAGE_DIR, layout unchanged, so existing files
            and rows keep working with no migration. Writes are ATOMIC (temp file +
            rename): a crash mid-upload leaves no half-written ID scan behind.
     s3     not built yet — it needs a bucket and credentials (production
            readiness Stage 3 stop point). STORAGE_DRIVER=s3 fails loudly at first
            use rather than silently writing to local disk.

   Nothing here ever produces a public URL: every read is streamed through an
   authorised route. */

export type StoredObject = { stream: Readable; size: number };

export interface ObjectStore {
  readonly driver: "local";
  /** Write (or replace) an object. Resolves once it is durably in place. */
  put(key: string, bytes: Uint8Array): Promise<void>;
  /** The whole object, or null if it does not exist. For small objects (ID scans). */
  get(key: string): Promise<Buffer | null>;
  /** A stream of the object and its size, or null if it does not exist. */
  open(key: string): Promise<StoredObject | null>;
  /** Does it exist, and how big is it? */
  stat(key: string): Promise<{ size: number } | null>;
  /** Remove an object. Missing is not an error. */
  delete(key: string): Promise<"deleted" | "missing">;
  /** Drop an empty "folder" left behind by deletes (a no-op for object stores). */
  pruneEmpty(prefix: string): Promise<void>;
}

/** Normalise and validate a key. Throws on anything that could escape the store. */
export function storageKey(raw: string, opts: { legacy?: boolean } = {}): string {
  const s = opts.legacy ? raw.replace(/\\/g, "/") : raw;
  if (!opts.legacy && s.includes("\\")) throw new Error("storage key must use '/' separators");
  const parts = s.split("/").filter((p) => p !== "");
  if (s.startsWith("/") || parts.length === 0 || parts.some((p) => p === "." || p === "..")) {
    throw new Error("unsafe storage key");
  }
  return parts.join("/");
}

/* rename() over an existing file is atomic on POSIX. Windows refuses it with
   EPERM/EACCES/EBUSY while another process or another rename holds the target
   (measured: 8 concurrent puts to one key failed here). Bounded retry, the same
   remedy graceful-fs applies on win32; elsewhere the first error is final. */
async function renameReplacing(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await rename(from, to);
    } catch (e) {
      const code = (e as { code?: string }).code;
      const transient = process.platform === "win32" && (code === "EPERM" || code === "EACCES" || code === "EBUSY");
      if (!transient || attempt >= 20) throw e;
      await new Promise((r) => setTimeout(r, 5 + attempt * 5));
    }
  }
}

function isNotFound(e: unknown): boolean {
  const code = (e as { code?: string }).code;
  return code === "ENOENT" || code === "ENOTDIR";
}

/** Files under a base directory — the default driver. */
export function localStore(baseDir: string = storageBase()): ObjectStore {
  const pathOf = (key: string, legacy: boolean) => {
    const abs = resolveDocPath(baseDir, storageKey(key, { legacy }));
    if (!abs) throw new Error("unsafe storage key");
    return abs;
  };
  return {
    driver: "local",
    async put(key, bytes) {
      const abs = pathOf(key, false);
      await mkdir(dirname(abs), { recursive: true });
      /* Atomic: readers see the old object or the new one, never a torn write. The
         temp name is unique per call, so two concurrent puts cannot interleave. */
      const tmp = `${abs}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
      try {
        await writeFile(tmp, bytes, { mode: 0o600 });
        await renameReplacing(tmp, abs);
      } catch (e) {
        await rm(tmp, { force: true }).catch(() => {});
        throw e;
      }
    },
    async get(key) {
      try {
        return await readFile(pathOf(key, true));
      } catch (e) {
        if (isNotFound(e)) return null;
        throw e;
      }
    },
    async open(key) {
      const abs = pathOf(key, true);
      try {
        const s = await stat(abs);
        if (!s.isFile()) return null;
        return { stream: createReadStream(abs), size: s.size };
      } catch (e) {
        if (isNotFound(e)) return null;
        throw e;
      }
    },
    async stat(key) {
      try {
        const s = await stat(pathOf(key, true));
        return s.isFile() ? { size: s.size } : null;
      } catch (e) {
        if (isNotFound(e)) return null;
        throw e;
      }
    },
    async delete(key) {
      const abs = pathOf(key, true);
      try {
        await stat(abs);
      } catch (e) {
        if (isNotFound(e)) return "missing";
        throw e;
      }
      await rm(abs, { force: true });
      return "deleted";
    },
    async pruneEmpty(prefix) {
      try {
        const dir = pathOf(prefix, true);
        if ((await readdir(dir)).length === 0) await rmdir(dir);
      } catch {
        /* already gone, not empty, or not a folder — never fatal */
      }
    },
  };
}

/** The store this process uses, chosen by STORAGE_DRIVER (default "local"). */
export function objectStore(): ObjectStore {
  const driver = (process.env.STORAGE_DRIVER ?? "local").trim().toLowerCase() || "local";
  if (driver === "local") return localStore();
  throw new Error(
    `STORAGE_DRIVER=${driver} is not available in this build. Only "local" is implemented; ` +
      "an S3-compatible driver needs a bucket and credentials first.",
  );
}

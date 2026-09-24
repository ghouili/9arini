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
     s3     any S3-compatible bucket (AWS S3, Cloudflare R2, MinIO), same keys
            under an optional S3_PREFIX. Configured by S3_* (see .env.example);
            missing configuration throws at first use, and the bucket is proven
            reachable before any operation — see s3Store().
   Any other STORAGE_DRIVER value throws: never a silent fallback to local disk.

   Nothing here ever produces a public URL: every read is streamed through an
   authorised route, and the bucket must stay private. */

export type StoredObject = { stream: Readable; size: number };

export interface ObjectStore {
  readonly driver: "local" | "s3";
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
  /* phase-a lane L4 (A11): delete EVERY object under a folder-like prefix
     ("avatars/<tutorId>"), including ones no row points at any more. Bounded to the
     folder (never "avatars/<id>xyz"), and refused for a single-segment prefix, so a
     bug cannot wipe a whole namespace. Throws on a storage failure. */
  deletePrefix(prefix: string): Promise<{ deleted: number }>;
}

/** A prefix deletePrefix accepts: a clean key of at least two segments. */
function folderPrefix(prefix: string): string {
  const k = storageKey(prefix, { legacy: true });
  if (k.split("/").length < 2) throw new Error("deletePrefix needs a folder, not a whole namespace");
  return k;
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
    // phase-a lane L4 (A11)
    async deletePrefix(prefix) {
      const root = pathOf(folderPrefix(prefix), true);
      let deleted = 0;
      const walk = async (dir: string): Promise<void> => {
        let entries;
        try {
          entries = await readdir(dir, { withFileTypes: true });
        } catch (e) {
          if (isNotFound(e)) return;
          throw e;
        }
        for (const entry of entries) {
          const abs = join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(abs);
            await rmdir(abs).catch(() => {});
          } else {
            await rm(abs, { force: true });
            deleted++;
          }
        }
      };
      await walk(root);
      await rmdir(root).catch(() => {}); // the folder itself, once empty
      return { deleted };
    },
  };
}

/* ── S3-compatible driver ──────────────────────────────────────────────────── */

export type S3Config = {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  prefix: string;
};

const S3_REQUIRED = ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const;

/** S3 settings from the environment. Throws naming the MISSING keys, never a value. */
export function s3ConfigFromEnv(env: NodeJS.ProcessEnv = process.env): S3Config {
  const missing = S3_REQUIRED.filter((k) => !env[k]?.trim());
  if (missing.length) throw new Error(`STORAGE_DRIVER=s3 needs ${missing.join(", ")} (not set)`);
  const prefix = (env.S3_PREFIX ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (prefix) {
    try {
      storageKey(prefix);
    } catch {
      throw new Error("S3_PREFIX is not a valid key prefix");
    }
  }
  return {
    bucket: env.S3_BUCKET!.trim(),
    /* us-east-1 is what MinIO expects and R2 accepts as "auto". AWS needs the
       bucket's real region, or every call fails with a redirect. */
    region: env.S3_REGION?.trim() || "us-east-1",
    endpoint: env.S3_ENDPOINT?.trim() || undefined,
    accessKeyId: env.S3_ACCESS_KEY_ID!.trim(),
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!.trim(),
    forcePathStyle: env.S3_FORCE_PATH_STYLE?.trim() === "true",
    prefix,
  };
}

type S3Sdk = typeof import("@aws-sdk/client-s3");
type S3Error = { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };

const s3Status = (e: unknown) => (e as S3Error).$metadata?.httpStatusCode;
const s3Missing = (e: unknown) => {
  const name = (e as S3Error).name ?? (e as S3Error).Code;
  return name === "NoSuchKey" || name === "NotFound" || (s3Status(e) === 404 && name !== "NoSuchBucket");
};
/** An SDK error reduced to its kind and status. The message can carry the bucket
    and key (a tutor id); neither belongs in a log line. */
export function describeS3Error(e: unknown): string {
  const err = e as S3Error & { code?: string };
  return [err.name ?? err.Code ?? err.code ?? "Error", s3Status(e) ? String(s3Status(e)) : ""].filter(Boolean).join(" ");
}

/** phase-a lane L4 (A11): the one method of an S3 client the store calls — so a unit
    test can hand s3Store a stub and prove the S3 path without a bucket. */
export type S3ClientLike = { send(command: unknown): Promise<unknown> };

export function s3Store(cfg: S3Config, opts: { client?: S3ClientLike } = {}): ObjectStore {
  /* The SDK is imported on first use, so a deployment on the local driver never
     loads it. */
  let conn: Promise<{ sdk: S3Sdk; client: InstanceType<S3Sdk["S3Client"]> }> | null = null;
  let bucketChecked: Promise<void> | null = null;

  const connect = () =>
    (conn ??= import("@aws-sdk/client-s3").then((sdk) => ({
      sdk,
      // phase-a lane L4 (A11): an injected client (tests) replaces the real one.
      client: (opts.client as InstanceType<S3Sdk["S3Client"]> | undefined) ?? new sdk.S3Client({
        region: cfg.region,
        endpoint: cfg.endpoint,
        forcePathStyle: cfg.forcePathStyle,
        credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
        maxAttempts: 3,
        // Bounded, like the SMTP transport: a hung bucket must not hang an upload forever.
        requestHandler: { connectionTimeout: 5_000, requestTimeout: 30_000 },
      }),
    })));

  /* THE BUCKET IS PROVEN BEFORE ANY OPERATION, once per process.
     A HEAD on a key answers 404 both for "no such object" and — HEAD has no body
     to say otherwise — for "no such bucket". With a mistyped S3_BUCKET the
     retention purge would therefore see every document as already gone and
     delete every row, orphaning the real scans: the same hazard storageBase()
     refuses for a missing STORAGE_DIR. HeadBucket fails loudly instead. A failure
     is not cached, so the next call retries. */
  const ready = async () => {
    const c = await connect();
    bucketChecked ??= c.client.send(new c.sdk.HeadBucketCommand({ Bucket: cfg.bucket })).then(
      () => undefined,
      (e) => {
        bucketChecked = null;
        throw Object.assign(new Error(`object store bucket is not reachable (${describeS3Error(e)})`), {
          code: "BUCKET_UNREACHABLE",
        });
      },
    );
    await bucketChecked;
    return c;
  };
  const objectKey = (key: string, legacy: boolean) => (cfg.prefix ? `${cfg.prefix}/` : "") + storageKey(key, { legacy });

  const head = async (key: string): Promise<{ size: number } | null> => {
    const k = objectKey(key, true);
    const { sdk, client } = await ready();
    try {
      const res = await client.send(new sdk.HeadObjectCommand({ Bucket: cfg.bucket, Key: k }));
      return { size: Number(res.ContentLength ?? 0) };
    } catch (e) {
      /* 403 is NOT "missing". Without s3:ListBucket, S3 answers 403 for an absent
         key; treating that as missing would let the purge drop rows it cannot
         see. It throws, and the purge keeps the row. */
      if (s3Missing(e)) return null;
      throw e;
    }
  };

  return {
    driver: "s3",
    async put(key, bytes) {
      const k = objectKey(key, false);
      const { sdk, client } = await ready();
      // A PUT is atomic in S3: readers see the old object or the new one.
      await client.send(
        new sdk.PutObjectCommand({
          Bucket: cfg.bucket,
          Key: k,
          Body: bytes,
          ContentLength: bytes.byteLength,
          ContentType: "application/octet-stream",
        }),
      );
    },
    async get(key) {
      const k = objectKey(key, true);
      const { sdk, client } = await ready();
      try {
        const res = await client.send(new sdk.GetObjectCommand({ Bucket: cfg.bucket, Key: k }));
        return res.Body ? Buffer.from(await res.Body.transformToByteArray()) : Buffer.alloc(0);
      } catch (e) {
        if (s3Missing(e)) return null;
        throw e;
      }
    },
    async open(key) {
      const k = objectKey(key, true);
      const { sdk, client } = await ready();
      try {
        const res = await client.send(new sdk.GetObjectCommand({ Bucket: cfg.bucket, Key: k }));
        if (!res.Body) return null;
        return { stream: res.Body as Readable, size: Number(res.ContentLength ?? 0) };
      } catch (e) {
        if (s3Missing(e)) return null;
        throw e;
      }
    },
    stat: head,
    async delete(key) {
      // DeleteObject succeeds for an absent key, so HEAD first for an honest count.
      const existed = await head(key);
      if (!existed) return "missing";
      const { sdk, client } = await ready();
      await client.send(new sdk.DeleteObjectCommand({ Bucket: cfg.bucket, Key: objectKey(key, true) }));
      return "deleted";
    },
    async pruneEmpty() {
      /* An object store has no folders to leave behind. */
    },
    /* phase-a lane L4 (A11): list the folder (page by page) and delete each object.
       One DeleteObject per key rather than DeleteObjects: a person's photos are a
       handful of objects, and every S3-compatible store implements this call the
       same way. A 403 on the listing throws — never "nothing there". */
    async deletePrefix(prefix) {
      const folder = `${cfg.prefix ? `${cfg.prefix}/` : ""}${folderPrefix(prefix)}/`;
      const { sdk, client } = await ready();
      let deleted = 0;
      let token: string | undefined;
      do {
        const page = await client.send(
          new sdk.ListObjectsV2Command({ Bucket: cfg.bucket, Prefix: folder, ContinuationToken: token }),
        );
        for (const obj of page.Contents ?? []) {
          if (!obj.Key || !obj.Key.startsWith(folder)) continue;
          await client.send(new sdk.DeleteObjectCommand({ Bucket: cfg.bucket, Key: obj.Key }));
          deleted++;
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      return { deleted };
    },
  };
}

/* ── selection ─────────────────────────────────────────────────────────────── */

export const STORAGE_DRIVERS = ["local", "s3"] as const;

/** The configured driver name, or null when STORAGE_DRIVER names no known driver. */
export function storageDriverName(env: NodeJS.ProcessEnv = process.env): (typeof STORAGE_DRIVERS)[number] | null {
  const d = (env.STORAGE_DRIVER ?? "").trim().toLowerCase() || "local";
  return (STORAGE_DRIVERS as readonly string[]).includes(d) ? (d as (typeof STORAGE_DRIVERS)[number]) : null;
}

/* One store per process and configuration: an S3 client holds a connection pool,
   and Next/tsx can evaluate this module more than once (same reason as the mail
   transport). The cache key never leaves this process. */
const g = globalThis as unknown as { __tnajemStore?: { sig: string; store: ObjectStore } };

/** The store this process uses, chosen by STORAGE_DRIVER (default "local"). Throws
    on an unknown driver or incomplete configuration — never falls back. */
export function objectStore(): ObjectStore {
  const driver = storageDriverName();
  if (!driver) throw new Error("STORAGE_DRIVER is set to an unknown driver (expected local or s3)");
  const e = process.env;
  const sig = [driver, e.STORAGE_DIR, e.S3_BUCKET, e.S3_REGION, e.S3_ENDPOINT, e.S3_PREFIX, e.S3_FORCE_PATH_STYLE, e.S3_ACCESS_KEY_ID, e.S3_SECRET_ACCESS_KEY].join(" ");
  if (g.__tnajemStore?.sig === sig) return g.__tnajemStore.store;
  const store = driver === "local" ? localStore() : s3Store(s3ConfigFromEnv());
  g.__tnajemStore = { sig, store };
  return store;
}

/* The object store the API under test reads and writes, for specs that seed a
   file or check what was stored.

   Local by default: files under E2E_STORAGE_DIR, which the API is started with as
   STORAGE_DIR. With E2E_STORAGE_DRIVER=s3 (and the API started with
   STORAGE_DRIVER=s3), the same specs run against the bucket configured by S3_*.

   DELIBERATELY NOT the product's driver (packages/db/src/storage.ts). A spec that
   checks "the stored bytes are exactly the upload" through the same code that
   wrote them only proves the driver agrees with itself. This reads the key the
   database row names with a plain filesystem read or a plain S3 GetObject — the
   layout contract, checked from outside. */
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { STORAGE_DIR } from "./env";

export type E2EStore = {
  get(key: string): Promise<Buffer | null>;
  put(key: string, bytes: Uint8Array): Promise<void>;
};

let store: E2EStore | null = null;

export function e2eStore(): E2EStore {
  store ??= process.env.E2E_STORAGE_DRIVER === "s3" ? bucket() : disk();
  return store;
}

function disk(): E2EStore {
  const path = (key: string) => join(STORAGE_DIR, ...key.split("/"));
  return {
    async get(key) {
      try {
        return await readFile(path(key));
      } catch (e) {
        if ((e as { code?: string }).code === "ENOENT") return null;
        throw e;
      }
    },
    async put(key, bytes) {
      await mkdir(dirname(path(key)), { recursive: true });
      await writeFile(path(key), bytes);
    },
  };
}

function bucket(): E2EStore {
  const need = (k: string) => {
    const v = process.env[k]?.trim();
    if (!v) throw new Error(`E2E_STORAGE_DRIVER=s3 needs ${k}`);
    return v;
  };
  const Bucket = need("S3_BUCKET");
  const prefix = (process.env.S3_PREFIX ?? "").trim().replace(/^\/+|\/+$/g, "");
  const Key = (key: string) => (prefix ? `${prefix}/${key}` : key);
  const client = new S3Client({
    region: process.env.S3_REGION?.trim() || "us-east-1",
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE?.trim() === "true",
    credentials: { accessKeyId: need("S3_ACCESS_KEY_ID"), secretAccessKey: need("S3_SECRET_ACCESS_KEY") },
  });
  return {
    async get(key) {
      try {
        const res = await client.send(new GetObjectCommand({ Bucket, Key: Key(key) }));
        return res.Body ? Buffer.from(await res.Body.transformToByteArray()) : Buffer.alloc(0);
      } catch (e) {
        if ((e as { name?: string }).name === "NoSuchKey") return null;
        throw e;
      }
    },
    async put(key, bytes) {
      await client.send(new PutObjectCommand({ Bucket, Key: Key(key), Body: bytes }));
    },
  };
}

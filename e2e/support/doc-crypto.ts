/* The document format and link signature, implemented AGAIN for the suite.

   Deliberately not imported from packages/db or apps/api: a spec that seals with
   the product's own code and opens with the product's own code proves only that
   the code agrees with itself. These are written from the format description in
   packages/db/src/doc-crypto.ts and apps/api/src/lib/doc-links.ts; if either
   changes, the specs fail here first. */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { AUTH_SECRET, E2E_DOC_KEY } from "./env";

const MAGIC = Buffer.from("TNJE1", "ascii");
const key = () => Buffer.from(E2E_DOC_KEY, "hex");
const keyId = () => createHash("sha256").update("tnajem-doc-key:").update(key()).digest().subarray(0, 8);

export function sealForE2E(storagePath: string, plaintext: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(storagePath, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([MAGIC, keyId(), iv, cipher.getAuthTag(), ct]);
}

export function openForE2E(storagePath: string, stored: Buffer): Buffer {
  if (!stored.subarray(0, 5).equals(MAGIC)) throw new Error("not a sealed document");
  const id = stored.subarray(5, 13);
  if (!id.equals(keyId())) throw new Error("sealed with a different key than the suite's");
  const iv = stored.subarray(13, 25);
  const tag = stored.subarray(25, 41);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv, { authTagLength: 16 });
  decipher.setAAD(Buffer.from(storagePath, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(stored.subarray(41)), decipher.final()]);
}

/** A document link with a chosen expiry — signed exactly as the API signs. */
export function signedDocLink(docId: string, adminProfileId: string, exp: number): string {
  const linkKey = createHmac("sha256", AUTH_SECRET).update("tnajem:doc-link:v1").digest();
  const sig = createHmac("sha256", linkKey).update(`${docId}\n${adminProfileId}\n${exp}`).digest("hex");
  return `/api/admin/doc/${docId}?exp=${exp}&sig=${sig}`;
}

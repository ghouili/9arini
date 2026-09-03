import type { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { eq } from "drizzle-orm";
import { db, dbReady } from "@/lib/db";
import { verificationDocs } from "@/lib/db/schema";
import { isAdmin } from "@/lib/admin";
import { isUuid, safeFileName } from "@/lib/validation";

/* Protected viewer for uploaded verification documents — national ID scans.
   Files live outside /public; only an admin session may stream them.

   This is the single highest-value endpoint in the product: it is the one URL that
   returns a Tunisian national ID card. Everything below is deliberate. */

export const runtime = "nodejs";        // needs node:fs
export const dynamic = "force-dynamic"; // never cached or prerendered

/* The admin check is lib/admin.ts::isAdmin() — the SAME implementation the
   verification queue uses. This file used to carry its own phone-only copy,
   which was the live bug: login is email OTP (lib/auth.ts::otpChannel defaults
   to "email"), so an admin who signed up by email has profile.phone === null
   and this returned false every time. An admin could see the pending queue and
   then get 403 on every ID scan in it. It failed CLOSED — never a hole, just a
   welded-shut door — but the queue could not be worked at all. */

/* Containment check for storage_path. The value comes from our own DB (written by
   submitVerification, which sanitizes), so this is defence in depth rather than a
   live hole — but this handler reads arbitrary bytes off disk and returns them, so
   a single bad row (bad migration, manual edit, future writer that forgets to
   sanitize) must not become "read any file on the box". Mirrors lib/retention.ts. */
function resolveDocPath(baseDir: string, storagePath: string): string | null {
  const parts = storagePath.split(/[\\/]+/).filter((p) => p && p !== ".");
  if (parts.length === 0 || parts.some((p) => p === "..")) return null;
  const root = resolve(baseDir);
  const abs = resolve(root, ...parts);
  return abs === root || abs.startsWith(root + sep) ? abs : null;
}

/* Only ever hand back a type we know is inert-ish, and never one the CLIENT chose.
   submitVerification now sniffs magic bytes and stores the SNIFFED type, but rows
   written before that fix still carry the uploader's claimed Content-Type, so
   re-validate on the way out too. Anything unrecognised is downloaded, not rendered. */
const SAFE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"]);

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!dbReady) return new Response("Not available", { status: 404 });

  if (!(await isAdmin())) {
    return new Response("Forbidden", { status: 403 });
  }

  // A non-uuid id would hit a uuid column and throw 22P02 → a 500 instead of a 404.
  if (!isUuid(params.id)) return new Response("Not found", { status: 404 });

  const [doc] = await db.select().from(verificationDocs).where(eq(verificationDocs.id, params.id)).limit(1);
  if (!doc) return new Response("Not found", { status: 404 });

  const base = process.env.STORAGE_DIR || join(process.cwd(), ".storage");
  const abs = resolveDocPath(base, doc.storagePath);
  if (!abs) {
    console.error(`[Tnajem] refusing unsafe storage_path on doc ${doc.id}`);
    return new Response("Not found", { status: 404 });
  }

  let buf: Buffer;
  try {
    buf = await readFile(abs);
  } catch {
    return new Response("File missing", { status: 404 });
  }

  const mime = doc.mime && SAFE_MIME.has(doc.mime) ? doc.mime : "application/octet-stream";
  const inline = mime !== "application/octet-stream"; // unknown type → force a download

  /* Header hardening. The stored bytes are attacker-supplied (a tutor uploads them)
     and this response is rendered inside an ADMIN's authenticated origin, so a file
     that sniffs as HTML would be stored XSS with the worst possible blast radius —
     the session that can read every ID scan in the system.
       • nosniff        — the browser must honour Content-Type, not guess from bytes.
       • CSP sandbox    — even if something does render, it runs with no origin, no
                          scripts, no forms. Neutralises the payload.
       • filename       — sanitized: the raw client filename could carry CR/LF and
                          split the header. safeFileName() strips everything outside
                          [a-zA-Z0-9._-].
       • no-store       — an ID scan must not sit in a shared/browser cache.
       • Referrer-Policy— don't leak the doc id to any embedded/linked origin. */
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeFileName(doc.fileName, 60)}"`,
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; object-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    },
  });
}

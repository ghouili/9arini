import type { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db, dbReady } from "@/lib/db";
import { verificationDocs } from "@/lib/db/schema";
import { getSession, normalizePhone } from "@/lib/auth";

/* Protected viewer for uploaded verification documents.
   Files live outside /public; only an admin session may stream them. */
function admins(): string[] {
  return (process.env.ADMIN_PHONES ?? "").split(",").map((s) => normalizePhone(s.trim())).filter(Boolean);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!dbReady) return new Response("Not available", { status: 404 });
  const session = await getSession();
  if (!session || !admins().includes(normalizePhone(session.profile.phone ?? ""))) {
    return new Response("Forbidden", { status: 403 });
  }
  const [doc] = await db.select().from(verificationDocs).where(eq(verificationDocs.id, params.id)).limit(1);
  if (!doc) return new Response("Not found", { status: 404 });
  try {
    const base = process.env.STORAGE_DIR || join(process.cwd(), ".storage");
    const buf = await readFile(join(base, doc.storagePath));
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": doc.mime || "application/octet-stream",
        "Content-Disposition": `inline; filename="${doc.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("File missing", { status: 404 });
  }
}

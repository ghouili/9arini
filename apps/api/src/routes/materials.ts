import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createReadStream } from "node:fs";
import { stat, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  and, desc, eq, isNull, sql as raw,
  bookings, classes, materials, materialTakedowns, tutorStrikes, tutors,
  storageBase, resolveDocPath,
} from "@tnajem/db";
import {
  isUuid,
  isMinorBirthYear,
  parseYouTubeId,
  safeFileName,
  vText,
  vOptionalText,
  vUuid,
  isValidEmail,
  normalizeEmail,
  type MaterialItem,
} from "@tnajem/shared";
import { db } from "../db";
import { getSession } from "../lib/session";
import { readUploadPart } from "../lib/uploads";
import { processAvatar, AVATAR_SIZES } from "../lib/avatar";
import { assertNoContactInfo, CONTACT_ERROR } from "../lib/contact-guard";
import { checkRateLimit } from "../lib/rate-limit";
import { requireAdmin } from "../lib/admin";

/* MATERIALS (Step 10) — worksheets, corrections and videos a tutor attaches.

   ══════════════════════════════════════════════════════════════════════════════
   THE ACCESS DECISION LIVES HERE, AND ONLY HERE.
   ══════════════════════════════════════════════════════════════════════════════
   Files are written under STORAGE_DIR, never public/, for one reason: a static
   directory cannot ask "did this student actually book the class?". Serving a
   `students` worksheet from public/ would make the visibility column a
   decoration — the file would be one guessed URL away from anyone.

     public    anyone, signed in or not
     students  the tutor, plus a student with a LIVE booking on one of their
               classes (not a cancelled one)
     private   the tutor alone

   `students` is the DEFAULT, not `public`. A tutor uploading a worksheet almost
   certainly means "for the people in my class", and the safe default is the one
   that cannot surprise them.

   ══════════════════════════════════════════════════════════════════════════════
   THE FILE ITSELF
   ══════════════════════════════════════════════════════════════════════════════
   Same pipeline as an identity document (lib/uploads.ts): the bytes are sniffed,
   truncation is checked because @fastify/multipart truncates rather than
   throwing, the SNIFFED type is what gets stored and later served, and the
   filename is sanitised before it reaches a Content-Disposition header.

   Videos store an 11-character id, never a URL — see parseYouTubeId. */

const MAX_MATERIAL_BYTES = 8 * 1024 * 1024;
/* Smaller than a worksheet on purpose: this is one face, re-encoded to at most
   320px. Anything larger is a camera original nobody needs us to keep. */
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const OK_AVATAR_MIME = /^image\/(png|jpeg|webp|heic)$/;
const MAX_MATERIALS_PER_TUTOR = 200;

/* Deliberately narrower than the ID-document allow-list: no HEIC. A worksheet is
   a PDF or an image a browser can actually render, and HEIC is neither on most
   desktops. Nothing here executes in a browser — SVG is absent on purpose, being
   an XML document that can carry <script>. */
const OK_MATERIAL_MIME = /^(application\/pdf|image\/(png|jpeg|webp))$/;

const SAFE_SERVE_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

/** Everyone who may read a given material, resolved against the database. */
async function canRead(
  material: { id: string; tutorId: string; visibility: string },
  uid: string | null,
): Promise<boolean> {
  if (material.visibility === "public") return true;
  if (!uid) return false;

  const [tutor] = await db
    .select({ profileId: tutors.profileId })
    .from(tutors)
    .where(eq(tutors.id, material.tutorId))
    .limit(1);
  if (tutor?.profileId === uid) return true; // the owner, whatever the visibility

  if (material.visibility === "private") return false;

  /* `students`: a LIVE booking on any class of this tutor. Cancelled bookings do
     not count — giving up the seat gives up the materials with it, which is the
     same rule messaging follows. */
  const [row] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(bookings)
    .innerJoin(classes, eq(bookings.classId, classes.id))
    .where(
      and(
        eq(classes.tutorId, material.tutorId),
        eq(bookings.studentId, uid),
        raw`coalesce(${bookings.status}, 'reserved') <> 'cancelled'`,
      ),
    );
  return (row?.n ?? 0) > 0;
}

function toItem(m: typeof materials.$inferSelect): MaterialItem {
  return {
    id: m.id,
    kind: m.kind,
    visibility: m.visibility,
    title: m.title,
    description: m.description ?? undefined,
    classId: m.classId ?? undefined,
    fileName: m.fileName ?? undefined,
    mime: m.mime ?? undefined,
    sizeBytes: m.sizeBytes ?? undefined,
    youtubeId: m.youtubeId ?? undefined,
    createdAt: new Date(m.createdAt).toISOString(),
  };
}

export async function materialRoutes(app: FastifyInstance): Promise<void> {
  /* ── POST /materials — upload a file, or attach a video ──────────────────── */
  app.post("/materials", async (req) => {
    const session = await getSession(req);
    if (!session) return { ok: false, error: "not-authenticated" };
    const uid = session.profile.id;

    const [mine] = await db
      .select({ id: tutors.id, status: tutors.status })
      .from(tutors)
      .where(eq(tutors.profileId, uid))
      .limit(1);
    if (!mine) return { ok: false, error: "no-storefront" };
    /* Same verification gate as createClass. A rejected tutor does not get to
       keep stocking a library that goes live the instant anyone flips a status. */
    if (mine.status !== "verified") return { ok: false, error: "not-verified" };

    const [{ n: existing } = { n: 0 }] = await db
      .select({ n: raw<number>`count(*)::int` })
      .from(materials)
      .where(and(eq(materials.tutorId, mine.id), isNull(materials.removedAt)));
    if (existing >= MAX_MATERIALS_PER_TUTOR) return { ok: false, error: "too-many-materials" };

    const fields = new Map<string, string>();
    let file: { fileName: string; bytes: Buffer; mime: string } | null = null;

    for await (const part of req.parts()) {
      if (part.type === "file") {
        if (part.fieldname !== "file") {
          await part.toBuffer(); // drain, or the stream stalls
          continue;
        }
        const read = await readUploadPart(part, {
          maxBytes: MAX_MATERIAL_BYTES,
          allow: OK_MATERIAL_MIME,
        });
        if (!read.ok) {
          // "file-required" here means an empty part, which is just no file.
          if (read.error === "file-required") continue;
          return { ok: false, error: read.error };
        }
        file = read.value;
      } else {
        fields.set(part.fieldname, String(part.value ?? ""));
      }
    }

    const title = vText(fields.get("title"), { field: "title", max: 120, min: 3 });
    if (!title.ok) return { ok: false, error: title.error };
    const description = vOptionalText(fields.get("description"), { field: "description", max: 1000 });
    if (!description.ok) return { ok: false, error: description.error };

    const visibility = fields.get("visibility") ?? "students";
    if (!["public", "students", "private"].includes(visibility)) {
      return { ok: false, error: "invalid-visibility" };
    }

    /* Title and description are user-authored text on a page other people read,
       so Step 8's rule applies here exactly as it does to a class title. */
    if (
      !(await assertNoContactInfo(uid, [
        { surface: "class_title", value: title.value },
        { surface: "class_description", value: description.value },
      ]))
    ) {
      return { ok: false, error: CONTACT_ERROR };
    }

    /* An optional class to attach to, and it must be the TUTOR'S OWN class —
       otherwise a tutor could staple their material to somebody else's page. */
    let classId: string | null = null;
    const rawClassId = fields.get("classId");
    if (rawClassId && rawClassId.trim()) {
      const parsed = vUuid(rawClassId, { field: "class" });
      if (!parsed.ok) return { ok: false, error: "not-found" };
      const [cls] = await db
        .select({ id: classes.id })
        .from(classes)
        .where(and(eq(classes.id, parsed.value), eq(classes.tutorId, mine.id)))
        .limit(1);
      if (!cls) return { ok: false, error: "not-found" };
      classId = cls.id;
    }

    const youtubeRaw = fields.get("youtubeUrl");
    const youtubeId = youtubeRaw ? parseYouTubeId(youtubeRaw) : null;

    if (file && youtubeId) return { ok: false, error: "one-source-only" };
    if (!file && !youtubeId) {
      // A pasted link that is not YouTube lands here, and the code says which.
      return { ok: false, error: youtubeRaw ? "invalid-youtube-url" : "file-required" };
    }

    if (youtubeId) {
      const [row] = await db
        .insert(materials)
        .values({
          tutorId: mine.id,
          classId,
          kind: "youtube",
          visibility: visibility as "public" | "students" | "private",
          title: title.value,
          description: description.value,
          youtubeId,
        })
        .returning({ id: materials.id });
      return { ok: true, id: row.id };
    }

    /* Persist. Under STORAGE_DIR/materials/<tutorId>/, never public/. `mine.id`
       comes from the session's own tutor row, so a tutor can only write into
       their own folder. */
    const dir = join(storageBase(), "materials", mine.id);
    await mkdir(dir, { recursive: true });
    const safe = `${Date.now()}-${safeFileName(file!.fileName, 60)}`;
    await writeFile(join(dir, safe), file!.bytes);

    const [row] = await db
      .insert(materials)
      .values({
        tutorId: mine.id,
        classId,
        kind: "file",
        visibility: visibility as "public" | "students" | "private",
        title: title.value,
        description: description.value,
        // POSIX separators ALWAYS — node:path.join is platform-dependent, and a
        // backslash written on Windows does not resolve on Linux.
        storagePath: ["materials", mine.id, safe].join("/"),
        fileName: safeFileName(file!.fileName, 60),
        mime: file!.mime, // the SNIFFED type — never the client's claim
        sizeBytes: file!.bytes.length,
      })
      .returning({ id: materials.id });

    return { ok: true, id: row.id };
  });

  /* ── GET /materials/mine — the tutor's own library ───────────────────────── */
  app.get("/materials/mine", async (req): Promise<MaterialItem[] | null> => {
    const session = await getSession(req);
    if (!session) return null;
    const [mine] = await db
      .select({ id: tutors.id })
      .from(tutors)
      .where(eq(tutors.profileId, session.profile.id))
      .limit(1);
    if (!mine) return null;

    const rows = await db
      .select()
      .from(materials)
      .where(and(eq(materials.tutorId, mine.id), isNull(materials.removedAt)))
      .orderBy(desc(materials.createdAt))
      .limit(MAX_MATERIALS_PER_TUTOR);
    return rows.map(toItem);
  });

  /* ── GET /tutors/:slug/materials — what THIS viewer may see ──────────────── */
  app.get<{ Params: { slug: string } }>("/tutors/:slug/materials", async (req): Promise<MaterialItem[]> => {
    const [tutor] = await db
      .select({ id: tutors.id, status: tutors.status })
      .from(tutors)
      .where(eq(tutors.slug, req.params.slug))
      .limit(1);
    if (!tutor || tutor.status !== "verified") return [];

    /* SESSION-DEPENDENT, so this endpoint is NOT part of the anonymous ISR set —
       it is fetched with cache:"no-store" by the storefront's client component,
       not during SSR. Mixing it into the cached storefront payload would serve
       one student's entitlements to everybody. See the header of routes/tutors.ts. */
    const session = await getSession(req);
    const uid = session?.profile.id ?? null;

    const rows = await db
      .select()
      .from(materials)
      .where(and(eq(materials.tutorId, tutor.id), isNull(materials.removedAt)))
      .orderBy(desc(materials.createdAt))
      .limit(MAX_MATERIALS_PER_TUTOR);

    const visible: MaterialItem[] = [];
    for (const m of rows) {
      if (await canRead(m, uid)) visible.push(toItem(m));
    }
    return visible;
  });

  /* ── GET /materials/:id/file — the bytes ─────────────────────────────────── */
  app.get<{ Params: { id: string } }>("/materials/:id/file", async (req, reply) => {
    if (!isUuid(req.params.id)) return reply.code(404).send({ error: "not-found" });

    const [m] = await db.select().from(materials).where(eq(materials.id, req.params.id)).limit(1);
    /* A removed material is a 404, not a 403: an upheld copyright claim should
       make the file disappear, not advertise that it once existed. */
    if (!m || m.removedAt || m.kind !== "file" || !m.storagePath) {
      return reply.code(404).send({ error: "not-found" });
    }

    const session = await getSession(req);
    if (!(await canRead(m, session?.profile.id ?? null))) {
      return reply.code(403).send({ error: "forbidden" });
    }

    /* Containment check. The value comes from our own database, so this is
       defence in depth — but the next line reads arbitrary bytes off disk and
       returns them, so one bad row must not become "read any file on the box". */
    /* resolveDocPath takes the BASE explicitly — it does not assume the
       verification folder — so materials and ID documents share one
       containment check rather than growing a second, weaker one. */
    const abs = resolveDocPath(storageBase(), m.storagePath);
    if (!abs) return reply.code(404).send({ error: "not-found" });
    try {
      await stat(abs);
    } catch {
      return reply.code(404).send({ error: "not-found" });
    }

    /* The SNIFFED type, and only from an allow-list. Serving a stored string
       straight into Content-Type is how a "PNG" gets run as HTML. */
    const mime = m.mime && SAFE_SERVE_MIME.has(m.mime) ? m.mime : "application/octet-stream";
    reply.header("content-type", mime);
    /* `private` even for public materials: a shared cache keyed only on the URL
       would hand a students-only file to the next person through it. */
    reply.header("cache-control", "private, no-store");
    reply.header("x-content-type-options", "nosniff");
    reply.header(
      "content-disposition",
      `inline; filename="${safeFileName(m.fileName ?? "material", 60)}"`,
    );
    return reply.send(createReadStream(abs));
  });

  /* ── POST /materials/:id/delete — the tutor removes their own ────────────── */
  app.post<{ Params: { id: string } }>("/materials/:id/delete", async (req) => {
    const session = await getSession(req);
    if (!session) return { ok: false, error: "not-authenticated" };
    if (!isUuid(req.params.id)) return { ok: false, error: "not-found" };

    const [m] = await db
      .select({ id: materials.id, tutorId: materials.tutorId })
      .from(materials)
      .where(eq(materials.id, req.params.id))
      .limit(1);
    if (!m) return { ok: false, error: "not-found" };

    const [mine] = await db
      .select({ id: tutors.id, slug: tutors.slug })
      .from(tutors)
      .where(eq(tutors.profileId, session.profile.id))
      .limit(1);
    if (!mine || mine.id !== m.tutorId) return { ok: false, error: "not-found" };

    /* Soft, like a takedown: the row records that it existed and when it went.
       A hard DELETE would also destroy any open takedown claim against it. */
    await db
      .update(materials)
      .set({ removedAt: raw`now()`, removedReason: "removed-by-tutor" })
      .where(eq(materials.id, m.id));

    return { ok: true, revalidate: { tutors: [mine.slug] } };
  });

  /* ══════════════════════════════════════════════════════════════════════════
     PROFILE PHOTOS (Step 13)
     ══════════════════════════════════════════════════════════════════════════

     THREE RULES, and each closes something specific:

       1. NOTHING IS PUBLISHED ON UPLOAD. Every photo lands `pending` and is
          visible only to its owner until a human approves it. There is no code
          path that writes `approved` from this endpoint. A face on a public page
          in a product used by children is not a "review it later" surface.

       2. THE ORIGINAL IS NEVER STORED. sharp re-encodes to three sizes and drops
          every metadata block, so the EXIF GPS tag a phone writes — the tutor's
          home coordinates, usually — never reaches disk. See lib/avatar.ts.

       3. A MINOR GETS A GENERATED AVATAR, NEVER A PHOTOGRAPH. Today this is
          belt-and-braces: becomeTutor already refuses a minor, so no minor can
          hold a tutor row. It is written here anyway because the guard that
          matters is the one at the write site — if students ever get photos, or
          if the age check is ever relaxed, this is the line that has to already
          exist rather than the one someone remembers to add. */
  app.post("/avatar", async (req) => {
    const session = await getSession(req);
    if (!session) return { ok: false, error: "not-authenticated" };

    /* RULE 3, and it is checked FIRST — before the file is even read. A minor's
       photograph should not exist in this process's memory, let alone on disk,
       for the moments between reading it and refusing it. */
    if (isMinorBirthYear(session.profile.birthYear)) {
      return { ok: false, error: "minor-no-photo" };
    }

    const [mine] = await db
      .select({ id: tutors.id, slug: tutors.slug, status: tutors.status })
      .from(tutors)
      .where(eq(tutors.profileId, session.profile.id))
      .limit(1);
    if (!mine) return { ok: false, error: "no-storefront" };

    const rl = await checkRateLimit(`avatar:${session.profile.id}`, 10, 60 * 60_000);
    if (!rl.ok) return { ok: false, error: "too-many-requests" };

    let original: Buffer | null = null;
    for await (const part of req.parts()) {
      if (part.type !== "file") continue;
      if (part.fieldname !== "photo") {
        await part.toBuffer(); // drain, or the stream stalls
        continue;
      }
      const read = await readUploadPart(part, {
        maxBytes: MAX_AVATAR_BYTES,
        allow: OK_AVATAR_MIME,
      });
      if (!read.ok) {
        if (read.error === "file-required") continue;
        return { ok: false, error: read.error };
      }
      original = read.value.bytes;
    }
    if (!original) return { ok: false, error: "file-required" };

    const processed = await processAvatar(original);
    if (!processed.ok) return { ok: false, error: processed.error };

    const stamp = Date.now();
    const dir = join(storageBase(), "avatars", mine.id);
    await mkdir(dir, { recursive: true });
    for (const out of processed.value) {
      await writeFile(join(dir, `${stamp}-${out.name}.webp`), out.bytes);
    }

    /* RULE 1. `pending`, always. If this ever reads anything else, the review
       step has been removed and photos publish themselves. */
    await db
      .update(tutors)
      .set({
        avatarPath: ["avatars", mine.id, String(stamp)].join("/"),
        avatarStatus: "pending",
        avatarUpdatedAt: raw`now()`,
      })
      .where(eq(tutors.id, mine.id));

    /* The storefront is cached and shows the monogram until approval, so nothing
       changes there yet — but a REPLACEMENT photo un-approves the old one, and
       that must reach the cached page immediately. */
    return { ok: true, status: "pending", revalidate: { tutors: [mine.slug] } };
  });

  /* ── DELETE the photo (POST, to match every other mutation here) ─────────── */
  app.post("/avatar/delete", async (req) => {
    const session = await getSession(req);
    if (!session) return { ok: false, error: "not-authenticated" };

    const [mine] = await db
      .select({ id: tutors.id, slug: tutors.slug })
      .from(tutors)
      .where(eq(tutors.profileId, session.profile.id))
      .limit(1);
    if (!mine) return { ok: false, error: "no-storefront" };

    /* The row is cleared; the files are left for the retention job rather than
       unlinked here. A failed unlink must not leave the database claiming a photo
       that is gone — the ordering that matters is "stop pointing at it first". */
    await db
      .update(tutors)
      .set({ avatarPath: null, avatarStatus: null, avatarUpdatedAt: raw`now()` })
      .where(eq(tutors.id, mine.id));

    return { ok: true, revalidate: { tutors: [mine.slug], publicTutors: true } };
  });

  /* ── GET /tutors/:slug/avatar/:size — the bytes ──────────────────────────── */
  app.get<{ Params: { slug: string; size: string } }>(
    "/tutors/:slug/avatar/:size",
    async (req, reply) => {
      const size = AVATAR_SIZES.find((s) => s.name === req.params.size);
      if (!size) return reply.code(404).send({ error: "not-found" });

      const [t] = await db
        .select({
          id: tutors.id,
          profileId: tutors.profileId,
          status: tutors.status,
          avatarPath: tutors.avatarPath,
          avatarStatus: tutors.avatarStatus,
        })
        .from(tutors)
        .where(eq(tutors.slug, req.params.slug))
        .limit(1);
      if (!t || !t.avatarPath) return reply.code(404).send({ error: "not-found" });

      /* WHO MAY SEE IT.

         approved + the tutor is public  -> anyone. It is on their storefront.
         anything else                   -> the OWNER alone.

         A `pending` photo is not merely unpublished, it is unreviewed: it could
         be anything at all, and the one person entitled to see it before a human
         does is the person who uploaded it. */
      const isOwner = t.profileId != null && t.profileId === (await getSession(req))?.profile.id;
      const isPublic = t.avatarStatus === "approved" && t.status === "verified";
      if (!isPublic && !isOwner) return reply.code(404).send({ error: "not-found" });

      const abs = resolveDocPath(storageBase(), `${t.avatarPath}-${size.name}.webp`);
      if (!abs) return reply.code(404).send({ error: "not-found" });
      try {
        await stat(abs);
      } catch {
        return reply.code(404).send({ error: "not-found" });
      }

      reply.header("content-type", "image/webp");
      reply.header("x-content-type-options", "nosniff");
      /* An APPROVED photo is public and immutable at this URL — the timestamp is
         part of avatarPath, so a replacement is a different URL. A pending one
         must never be cached anywhere: it can be revoked in the next minute. */
      reply.header(
        "cache-control",
        isPublic ? "public, max-age=86400, immutable" : "private, no-store",
      );
      return reply.send(createReadStream(abs));
    },
  );

  /* ── GET /admin/avatars — the review queue ───────────────────────────────── */
  app.get("/admin/avatars", async (req) => {
    const session = await requireAdmin(req);
    if (!session) return [];
    const rows = await db
      .select({
        tutorId: tutors.id,
        slug: tutors.slug,
        fullName: tutors.fullName,
        updatedAt: tutors.avatarUpdatedAt,
      })
      .from(tutors)
      .where(eq(tutors.avatarStatus, "pending"))
      .orderBy(desc(tutors.avatarUpdatedAt))
      .limit(200);
    return rows.map((r) => ({
      tutorId: r.tutorId,
      slug: r.slug,
      fullName: r.fullName,
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
    }));
  });

  /* ── POST /admin/avatars/:tutorId — approve or reject ────────────────────── */
  app.post<{ Params: { tutorId: string } }>("/admin/avatars/:tutorId", async (req, reply) => {
    const parsed = z.object({ approve: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad-request" });

    const session = await requireAdmin(req);
    if (!session) return { ok: false, error: "forbidden" };
    if (!isUuid(req.params.tutorId)) return { ok: false, error: "not-found" };

    const [t] = await db
      .select({ id: tutors.id, slug: tutors.slug, avatarStatus: tutors.avatarStatus })
      .from(tutors)
      .where(eq(tutors.id, req.params.tutorId))
      .limit(1);
    if (!t || t.avatarStatus == null) return { ok: false, error: "not-found" };

    await db
      .update(tutors)
      .set({ avatarStatus: parsed.data.approve ? "approved" : "rejected" })
      .where(eq(tutors.id, t.id));

    /* An approval changes a PUBLIC page and the catalogue, so both caches go. */
    return { ok: true, revalidate: { tutors: [t.slug], publicTutors: true } };
  });

  /* ── POST /materials/:id/takedown — a copyright claim, NO AUTH ───────────── */
  app.post<{ Params: { id: string } }>("/materials/:id/takedown", async (req, reply) => {
    const parsed = z
      .object({ claimantName: z.string(), claimantEmail: z.string(), reason: z.string() })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad-request" });

    if (!isUuid(req.params.id)) return { ok: false, error: "not-found" };

    /* UNAUTHENTICATED ON PURPOSE. A rights-holder is almost never a user of this
       site, and making them sign up to complain is the same as having no process.
       That means the only throttle is per-IP, and it has to exist: an open write
       endpoint without one is a spam target. */
    const rl = await checkRateLimit(`takedown:${req.ip}`, 5, 60 * 60_000);
    if (!rl.ok) return { ok: false, error: "too-many-requests" };

    const name = vText(parsed.data.claimantName, { field: "name", max: 120, min: 2 });
    if (!name.ok) return { ok: false, error: name.error };
    const reason = vText(parsed.data.reason, { field: "reason", max: 2000, min: 10 });
    if (!reason.ok) return { ok: false, error: reason.error };
    const email = normalizeEmail(parsed.data.claimantEmail ?? "");
    if (!isValidEmail(email)) return { ok: false, error: "invalid-email" };

    const [m] = await db
      .select({ id: materials.id, removedAt: materials.removedAt })
      .from(materials)
      .where(eq(materials.id, req.params.id))
      .limit(1);
    if (!m || m.removedAt) return { ok: false, error: "not-found" };

    await db.insert(materialTakedowns).values({
      materialId: m.id,
      claimantName: name.value,
      claimantEmail: email,
      reason: reason.value,
    });

    /* NOTHING IS REMOVED YET, and the response says so rather than implying a
       result. An unauthenticated endpoint that hides content on demand is a
       censorship button for anyone who finds the URL. A human decides. */
    return { ok: true, status: "received" };
  });

  /* ── POST /admin/takedowns/:id/resolve ───────────────────────────────────── */
  app.post<{ Params: { id: string } }>("/admin/takedowns/:id/resolve", async (req, reply) => {
    const parsed = z.object({ uphold: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad-request" });

    /* requireAdmin is the ONE gate — the same function the verification queue and
       the ID-scan stream use. A second, hand-rolled admin check here is exactly
       how the allow-list ended up tested in one place and running in another. */
    const session = await requireAdmin(req);
    if (!session) return { ok: false, error: "forbidden" };
    if (!isUuid(req.params.id)) return { ok: false, error: "not-found" };

    const [claim] = await db
      .select()
      .from(materialTakedowns)
      .where(eq(materialTakedowns.id, req.params.id))
      .limit(1);
    if (!claim) return { ok: false, error: "not-found" };
    if (claim.status !== "open") return { ok: true, already: true }; // idempotent

    const [m] = await db
      .select({ id: materials.id, tutorId: materials.tutorId })
      .from(materials)
      .where(eq(materials.id, claim.materialId))
      .limit(1);

    await db.transaction(async (tx) => {
      await tx
        .update(materialTakedowns)
        .set({
          status: parsed.data.uphold ? "upheld" : "rejected",
          resolvedAt: raw`now()`,
          resolvedBy: session.profile.id,
        })
        .where(eq(materialTakedowns.id, claim.id));

      if (!parsed.data.uphold || !m) return;

      await tx
        .update(materials)
        .set({ removedAt: raw`now()`, removedReason: "copyright-takedown" })
        .where(eq(materials.id, m.id));

      /* ONE STRIKE PER UPHELD CLAIM, and unique(takedown_id) is what makes that
         true: a moderator refreshing the queue must not double a tutor's count.
         Counted, never auto-enforced — a threshold that suspends an account on
         its own takes a livelihood away with no human in the loop. */
      await tx
        .insert(tutorStrikes)
        .values({ tutorId: m.tutorId, takedownId: claim.id, reason: "copyright-takedown" })
        .onConflictDoNothing();
    });

    return { ok: true };
  });
}

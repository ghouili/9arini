/* Env from the REPO ROOT, never from cwd. This line used to be
   `config({ path: ".env.local" })`, which is cwd-relative — and npm runs this with
   cwd = packages/db, so it loaded NOTHING and the script died with "DATABASE_URL
   not set" no matter how correctly .env was filled in. `npm run db:seed` had
   therefore never worked since the monorepo move. Same defect, same cause, and the
   same fix as db:sql and db:purge: resolve from the module's own location. */
import { loadEnv } from "../bin/_paths";
loadEnv();

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { tutors, classes, packs } from "./schema";

/* Seed the LOCAL DEV DB with a demo tutor + classes + packs.
   Standalone script: connects directly to Postgres and does NOT import
   lib/db/index.ts (that module is guarded by `server-only`, which throws when
   run via tsx outside the Next runtime). Idempotent — deletes the demo tutor by
   slug first (cascades). Run: npm run db:push && npm run db:seed
   (Postgres must already be running — Docker was removed; see README.)

   ⚠ NEVER seed production. This tutor is a fixture, not a person: seeding a live
   DB would publish a fake tutor on /explore and on the public storefront. Hence
   the NODE_ENV guard below (bypass with --force only if you know exactly why).

   The fixture is deliberately HONEST: zero students, no rating, no seats taken.
   Stars and student counts are recomputed from the `reviews` / `bookings` tables,
   so a seeded 4.9★ / "1240 élèves" was pure fabricated social proof. It stays
   `verified` only so the storefront + /explore are exercisable in local dev. */
async function main() {
  const force = process.argv.slice(2).includes("--force");
  if (process.env.NODE_ENV === "production" && !force) {
    console.error("✗ Refusing to seed: NODE_ENV=production.");
    console.error("  This seed publishes a demo tutor. If you REALLY mean it: npm run db:seed -- --force");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    // .env, not .env.local: the project consolidated onto one env file in Step 0.
    console.error("✗ DATABASE_URL not set. Start your local Postgres and set it in .env.");
    process.exit(1);
  }
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql, { schema: { tutors, classes, packs } });

  console.log(`Seeding Tnajem demo data…${force ? " (--force)" : ""}`);
  await db.delete(tutors).where(eq(tutors.slug, "yassine-math")); // cascades to classes/packs

  const [tutor] = await db.insert(tutors).values({
    slug: "yassine-math",
    fullName: "Yassine Khelifi",
    subject: "Prof de Maths · Bac",
    level: "Bac",
    bio: "« Spécialiste révisions Bac. On révise les dérivées, intégrales et annales — en darija, à ton rythme. 1ère séance offerte. »",
    // No rating, no students: nothing here has been earned yet.
    rating: "0",
    studentsCount: 0,
    verified: true,
    status: "verified",
    // A decided tutor has a decision date. It also gives lib/retention.ts
    // something real to reason about (docs expire 90d after reviewedAt).
    submittedAt: new Date(),
    reviewedAt: new Date(),
  }).returning();

  const soon = (days: number, h: number, m: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(h, m, 0, 0);
    return d;
  };

  await db.insert(classes).values([
    {
      tutorId: tutor.id, title: "Intégrales — révision express",
      description: "Méthodes + annales. On fait 3 exercices types ensemble.",
      scheduledAt: soon(2, 18, 0), durationMin: 90, priceTnd: "15", seats: 20, seatsTaken: 0,
      isFreeFirst: true, meetUrl: "https://meet.jit.si/tnajem-c1",
      whiteboardUrl: "https://bitpaper.io/", quizUrl: "https://www.wooclap.com/",
    },
    {
      tutorId: tutor.id, title: "Annales Bac 2025 corrigées",
      description: "Correction guidée des sujets 2025.",
      scheduledAt: soon(4, 17, 0), durationMin: 120, priceTnd: "20", seats: 20, seatsTaken: 0,
      isFreeFirst: false, meetUrl: "https://meet.jit.si/tnajem-c2",
    },
  ]);

  await db.insert(packs).values({
    tutorId: tutor.id, title: "Pack révision : Dérivées & Limites",
    description: "42 pages · 6 vidéos", priceTnd: "8",
  });

  console.log("✓ Seeded tutor /yassine-math (verified) — 0 students, no rating — with 2 classes + 1 pack.");
  console.log("  Rating/students stay at 0 on purpose: they are computed from real reviews + bookings.");
  await sql.end();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

import { config } from "dotenv";
config({ path: ".env.local", override: true }); // .env.local wins over any stray shell DATABASE_URL

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { tutors, classes, packs } from "./schema";

/* Seed the local DB with the demo tutor (Yassine) + classes + packs.
   Standalone script: connects directly to Postgres and does NOT import
   lib/db/index.ts (that module is guarded by `server-only`, which throws when
   run via tsx outside the Next runtime). Idempotent — deletes the demo tutor by
   slug first (cascades). Run: npm run db:up && npm run db:push && npm run db:seed */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL not set. Start Postgres (npm run db:up) and set .env.local.");
    process.exit(1);
  }
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql, { schema: { tutors, classes, packs } });

  console.log("Seeding 9arini demo data…");
  await db.delete(tutors).where(eq(tutors.slug, "yassine-math")); // cascades to classes/packs

  const [tutor] = await db.insert(tutors).values({
    slug: "yassine-math",
    fullName: "Yassine Khelifi",
    subject: "Prof de Maths · Bac",
    level: "Bac",
    bio: "« Spécialiste révisions Bac. On révise les dérivées, intégrales et annales — en darija, à ton rythme. 1ère séance offerte. »",
    rating: "4.9",
    studentsCount: 1240,
    verified: true,
    status: "verified",
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
      scheduledAt: soon(2, 18, 0), durationMin: 90, priceTnd: "15", seats: 20, seatsTaken: 12,
      isFreeFirst: true, meetUrl: "https://meet.jit.si/9arini-c1",
      whiteboardUrl: "https://bitpaper.io/", quizUrl: "https://www.wooclap.com/",
    },
    {
      tutorId: tutor.id, title: "Annales Bac 2025 corrigées",
      description: "Correction guidée des sujets 2025.",
      scheduledAt: soon(4, 17, 0), durationMin: 120, priceTnd: "20", seats: 20, seatsTaken: 8,
      isFreeFirst: false, meetUrl: "https://meet.jit.si/9arini-c2",
    },
  ]);

  await db.insert(packs).values({
    tutorId: tutor.id, title: "Pack révision : Dérivées & Limites",
    description: "42 pages · 6 vidéos", priceTnd: "8",
  });

  console.log("✓ Seeded tutor 9arini.tn/yassine-math (verified) with 2 classes + 1 pack.");
  await sql.end();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApp, stopApp, seedTutor, login, call, sql, type App } from "./support/fx";

/* Phase A · A18.7 (lane L5). There was no level field anywhere: tutors.level
   defaulted to 'Bac', nothing ever wrote it, and every tutor was labelled "Bac".
   Now a tutor picks their levels (Primaire · Collège · Secondaire · Bac ·
   Université, canonical codes in @tnajem/shared), a class may carry one, Explore
   filters on them, and nothing falls back to "Bac".

   The shared helpers are loaded dynamically so that, before the fix, this file
   fails on assertions rather than on a missing export at link time. */

let app: App;
before(async () => {
  app = await startApp();
});
after(async () => {
  await stopApp(app);
});

const inThreeDays = () => new Date(Date.now() + 3 * 86_400_000).toISOString();

async function shared(): Promise<Record<string, unknown>> {
  return (await import("@tnajem/shared")) as Record<string, unknown>;
}

describe("A18.7 — levels: canonical codes", () => {
  test("legacy / free-text values map to codes, anything else to null", async () => {
    const m = await shared();
    assert.equal(typeof m.levelFromText, "function", "levelFromText is exported");
    const f = m.levelFromText as (s: string) => string | null;
    assert.equal(f("Bac"), "bac");
    assert.equal(f("  collège "), "college");
    assert.equal(f("Lycée"), "secondaire");
    assert.equal(f("ثانوي"), "secondaire");
    assert.equal(f("Université"), "universite");
    assert.equal(f("Primaire"), "primaire");
    assert.equal(f("Cuisine"), null);
  });

  test("parseLevels keeps known codes, dedupes, orders them, refuses the rest", async () => {
    const m = await shared();
    assert.equal(typeof m.parseLevels, "function", "parseLevels is exported");
    const p = m.parseLevels as (x: unknown) => { ok: boolean; value?: string[]; error?: string };
    assert.deepEqual(p(["bac", "college", "bac"]), { ok: true, value: ["college", "bac"] });
    assert.deepEqual(p([]), { ok: true, value: [] });
    assert.deepEqual(p(["lycee-pro"]), { ok: false, error: "invalid-level" });
  });
});

describe("A18.7 — levels through the API", () => {
  test("a tutor saves their levels and the storefront shows them — never a default 'Bac'", async () => {
    const tutor = await seedTutor({ fullName: "Levels L5 Tutor" });
    const cookie = await login(tutor.profileId);

    // fx seeds tutors.level = 'Bac', exactly like the old column default.
    const before = await call(app, "GET", `/tutors/${tutor.slug}/storefront`, null);
    assert.deepEqual(before.body.tutor.levels, [], "no levels chosen yet");
    assert.doesNotMatch(String(before.body.tutor.level ?? ""), /bac/i, "the column default is not a level");

    const res = await call(app, "POST", "/tutors", cookie, {
      name: "Levels L5 Tutor", subject: "Mathématiques", bio: "Bio.", slug: tutor.slug,
      levels: ["bac", "college"],
    });
    assert.equal(res.body.ok, true, res.raw);
    const [row] = await sql<{ levels: string[] }[]>`select levels from tutors where id = ${tutor.id}`;
    assert.deepEqual(row.levels, ["college", "bac"]);

    const after = await call(app, "GET", `/tutors/${tutor.slug}/storefront`, null);
    assert.deepEqual(after.body.tutor.levels, ["college", "bac"]);
  });

  test("an unknown level is refused", async () => {
    const tutor = await seedTutor();
    const cookie = await login(tutor.profileId);
    const res = await call(app, "POST", "/tutors", cookie, {
      name: "Levels Bad", subject: "Maths", bio: "", slug: tutor.slug, levels: ["maternelle"],
    });
    assert.equal(res.body.ok, false, res.raw);
    assert.equal(res.body.error, "invalid-level");
  });

  test("Explore filters on a level", async () => {
    const tag = `Lvlx${Date.now().toString(36)}`;
    const a = await seedTutor({ fullName: `${tag} Alpha` });
    await seedTutor({ fullName: `${tag} Beta` });
    await sql`update tutors set levels = ${sql.array(["college", "bac"])} where id = ${a.id}`;

    const all = await call(app, "GET", `/tutors/explore?q=${tag}`, null);
    assert.equal(all.body.length, 2, all.raw);
    const alpha = all.body.find((t: { slug: string }) => t.slug === a.slug);
    assert.deepEqual(alpha.levels, ["college", "bac"]);

    const college = await call(app, "GET", `/tutors/explore?q=${tag}&level=college`, null);
    assert.deepEqual(college.body.map((t: { slug: string }) => t.slug), [a.slug], college.raw);

    // Searching "bac" no longer matches every tutor through the old column default.
    const bac = await call(app, "GET", `/tutors/explore?q=${tag}&level=bac`, null);
    assert.deepEqual(bac.body.map((t: { slug: string }) => t.slug), [a.slug], bac.raw);
  });

  test("a class may carry one level, and it reaches the storefront", async () => {
    const tutor = await seedTutor();
    const cookie = await login(tutor.profileId);
    const ok = await call(app, "POST", "/classes", cookie, {
      title: "Révision niveau L5", scheduledAt: inThreeDays(), durationMin: 90, priceTnd: 20, seats: 10,
      isFreeFirst: false, level: "bac",
    });
    assert.equal(ok.body.ok, true, ok.raw);
    const [row] = await sql<{ level: string | null }[]>`select level from classes where tutor_id = ${tutor.id}`;
    assert.equal(row.level, "bac");

    const sf = await call(app, "GET", `/tutors/${tutor.slug}/storefront`, null);
    assert.equal(sf.body.classes[0].level, "bac");

    const bad = await call(app, "POST", "/classes", cookie, {
      title: "Révision niveau L5 bis", scheduledAt: inThreeDays(), durationMin: 90, priceTnd: 20, seats: 10,
      isFreeFirst: false, level: "maternelle",
    });
    assert.equal(bad.body.ok, false, bad.raw);
    assert.equal(bad.body.error, "invalid-level");
  });
});

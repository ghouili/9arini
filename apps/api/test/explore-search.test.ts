import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApp, stopApp, seedTutor, call, sql, type App } from "./support/fx";

/* Phase A+ · P2 (D10). Students see "Mohamed B." (A23), but Explore search still
   matched the FULL name, so typing a surname confirmed it: "Ben Ali" returned the
   "Mohamed B." card. The search now matches the first name, the displayed form
   ("Mohamed B"), the subject (codes and labels, both languages), levels and the
   slug — never the last name. In the SQL, not by filtering afterwards.

   The positive cases also filter on a level only this tutor has, because results
   are capped at 60 and ordered by boost and rating: in a busy test database the
   tutor would otherwise be crowded out of a plain "maths" search. The level is an
   AND, so they still prove the text match. The negative cases use q alone. */

let app: App;
let slug = "";
before(async () => {
  app = await startApp();
  const t = await seedTutor({ fullName: "Mohamed Ben Ali" }); // subject "Mathématiques" (fx default)
  slug = t.slug;
  await sql`update tutors set levels = ${sql.array(["universite"])} where id = ${t.id}`;
});
after(async () => {
  await stopApp(app);
});

type Row = { slug: string; full_name: string };
async function search(q: string, level?: string): Promise<Row[]> {
  const url = `/tutors/explore?q=${encodeURIComponent(q)}${level ? `&level=${level}` : ""}`;
  const res = await call(app, "GET", url, null);
  assert.equal(res.status, 200, res.raw);
  return res.body as Row[];
}
const hasHim = (rows: Row[]) => rows.some((r) => r.slug === slug);

describe("P2 — Explore search never confirms a surname", () => {
  test("'Ben Ali' → 0 results", async () => {
    const rows = await search("Ben Ali");
    assert.equal(rows.length, 0, JSON.stringify(rows.map((r) => r.full_name)));
  });

  test("'Ali' does not find him (the surname's second word)", async () => {
    assert.equal(hasHim(await search("Ali")), false);
    assert.equal(hasHim(await search("Ali", "universite")), false);
  });

  test("'Mohamed' finds him (first name)", async () => {
    assert.equal(hasHim(await search("Mohamed", "universite")), true);
  });

  test("'Mohamed B' finds him (the displayed form, with or without the dot)", async () => {
    assert.equal(hasHim(await search("Mohamed B", "universite")), true);
    assert.equal(hasHim(await search("Mohamed B.", "universite")), true);
  });

  test("'maths' finds him (subject label → code → 'Mathématiques')", async () => {
    assert.equal(hasHim(await search("maths", "universite")), true);
  });

  test("the slug finds him", async () => {
    assert.equal(hasHim(await search(slug)), true);
  });

  test("'%' and '_' are text, not LIKE wildcards", async () => {
    assert.equal(hasHim(await search("%", "universite")), false);
    assert.equal(hasHim(await search("_", "universite")), false);
  });

  test("no response ever carries the surname", async () => {
    for (const q of ["Mohamed", "Mohamed B", "maths", slug]) {
      const rows = await search(q, q === slug ? undefined : "universite");
      assert.ok(!JSON.stringify(rows).includes("Ben Ali"), q);
    }
  });
});

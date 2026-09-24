import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startApp, stopApp, seedProfile, login, call, sql, type App } from "./support/fx";

/* Phase A · A18.12 (lane L5). /student/welcome saved subjects IN THE DISPLAY
   LANGUAGE: a student who switched language ended up with "Maths,فيزياء". Subjects
   are now stored as canonical codes (math, physique, …) and translated only for
   display. A value that maps to no code is KEPT as typed — never dropped.
   0028_subject_codes.sql converts the rows already stored, by the same rule. */

let app: App;
before(async () => {
  app = await startApp();
});
after(async () => {
  await stopApp(app);
});

const here = dirname(fileURLToPath(import.meta.url));
const migration = () => readFileSync(resolve(here, "../../../packages/db/sql/0028_subject_codes.sql"), "utf8");

describe("A18.12 — subjects are stored as codes", () => {
  test("FR and AR labels for the same subject become ONE code; unknown values are kept", async () => {
    const student = await seedProfile({ role: "student" });
    const res = await call(app, "POST", "/profile/student", await login(student.id), {
      fullName: "Élève L5",
      subjects: ["Maths", "رياضيات", "Physique", "Cuisine"],
    });
    assert.equal(res.body.ok, true, res.raw);
    const [row] = await sql<{ subjects: string | null }[]>`select subjects from profiles where id = ${student.id}`;
    assert.equal(row.subjects, "math,physique,Cuisine");
  });

  test("0028 converts stored FR/AR values to codes, keeps the unmappable, and is idempotent", async () => {
    const student = await seedProfile({ role: "student" });
    await sql`update profiles set subjects = ${" Maths,فيزياء,Cuisine,Français,إنقليزية,math"} where id = ${student.id}`;
    await sql.begin((tx) => [tx.unsafe(migration())]); // as apply-sql.ts runs it
    const [once] = await sql<{ subjects: string | null }[]>`select subjects from profiles where id = ${student.id}`;
    assert.equal(once.subjects, "math,physique,Cuisine,francais,anglais");
    await sql.begin((tx) => [tx.unsafe(migration())]); // as apply-sql.ts runs it
    const [twice] = await sql<{ subjects: string | null }[]>`select subjects from profiles where id = ${student.id}`;
    assert.equal(twice.subjects, once.subjects);
  });
});

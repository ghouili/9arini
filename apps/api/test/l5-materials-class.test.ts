import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  startApp, stopApp, seedTutor, seedClass, seedProfile, seedBooking, login, call, sql, type App,
} from "./support/fx";

/* Phase A · A18.9 (lane L5). A material attached to ONE class, with "students"
   visibility, was readable by every student of the tutor: canRead() only asked
   "any live booking with this tutor?". Now "Élèves de cette séance" means the
   students booked in THAT class; a material with no class stays "Tous mes élèves". */

let app: App;
const materialIds: string[] = [];

before(async () => {
  app = await startApp();
});
after(async () => {
  if (materialIds.length) await sql`delete from materials where id in ${sql(materialIds)}`;
  await stopApp(app);
});

async function seedVideo(tutorId: string, title: string, classId: string | null): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into materials (tutor_id, class_id, kind, visibility, title, youtube_id)
    values (${tutorId}, ${classId}, 'youtube', 'students', ${title}, 'dQw4w9WgXcQ')
    returning id`;
  materialIds.push(row.id);
  return row.id;
}

describe("A18.9 — a class's material is for that class's students", () => {
  test("booked in class A: sees A's material and the tutor-wide one; booked in B: only the tutor-wide one", async () => {
    const tutor = await seedTutor();
    const classA = await seedClass({ tutorId: tutor.id, hoursFromNow: 72 });
    const classB = await seedClass({ tutorId: tutor.id, hoursFromNow: 96 });
    const inA = await seedProfile({ role: "student" });
    const inB = await seedProfile({ role: "student" });
    await seedBooking({ classId: classA.id, studentId: inA.id });
    await seedBooking({ classId: classB.id, studentId: inB.id });

    const forA = await seedVideo(tutor.id, "L5 corrigé séance A", classA.id);
    const forAll = await seedVideo(tutor.id, "L5 fiche tous mes élèves", null);

    const seenByA = await call(app, "GET", `/tutors/${tutor.slug}/materials`, await login(inA.id));
    const idsA = seenByA.body.map((m: { id: string }) => m.id);
    assert.ok(idsA.includes(forA), "a student of class A sees A's material");
    assert.ok(idsA.includes(forAll), "and the tutor-wide one");

    const seenByB = await call(app, "GET", `/tutors/${tutor.slug}/materials`, await login(inB.id));
    const idsB = seenByB.body.map((m: { id: string }) => m.id);
    assert.ok(idsB.includes(forAll), "a student of class B sees the tutor-wide material");
    assert.ok(!idsB.includes(forA), "but NOT the material attached to class A");
  });

  test("a cancelled booking in the class no longer opens its material", async () => {
    const tutor = await seedTutor();
    const klass = await seedClass({ tutorId: tutor.id });
    const student = await seedProfile({ role: "student" });
    await seedBooking({ classId: klass.id, studentId: student.id, status: "cancelled" });
    const forClass = await seedVideo(tutor.id, "L5 corrigé annulé", klass.id);
    const seen = await call(app, "GET", `/tutors/${tutor.slug}/materials`, await login(student.id));
    assert.ok(!seen.body.map((m: { id: string }) => m.id).includes(forClass));
  });
});

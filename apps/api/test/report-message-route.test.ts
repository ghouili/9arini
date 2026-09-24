import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { startApp, stopApp, seedProfile, seedTutor, seedClass, seedBooking, login, call, sql, type App } from "./support/fx";

/* phase-a/integrate (A19 × L6 finding). /privacy now says a message is reported
   from its conversation, by a signed-in participant. POST /reports — the public,
   no-account endpoint for pages, classes and documents — still accepted
   subjectKind "message" from anyone holding a message id. Message reports go
   through POST /messages/:id/report, which checks that the reporter is IN the
   thread; the public endpoint now refuses the kind outright. */

let app: App;
const reportSubjects: string[] = [];
before(async () => {
  app = await startApp();
});
after(async () => {
  if (reportSubjects.length) await sql`delete from reports where subject_id in ${sql(reportSubjects)}`;
  await stopApp(app);
});

async function threadWithMessage() {
  const tutor = await seedTutor();
  const klass = await seedClass({ tutorId: tutor.id });
  const student = await seedProfile({ role: "student" });
  const booking = await seedBooking({ classId: klass.id, studentId: student.id });
  const threadId = randomUUID();
  await sql`insert into message_threads (id, booking_id, class_id, tutor_profile_id, student_profile_id)
            values (${threadId}, ${booking.id}, ${klass.id}, ${tutor.profileId}, ${student.id})`;
  const messageId = randomUUID();
  await sql`insert into messages (id, thread_id, sender_profile_id, body)
            values (${messageId}, ${threadId}, ${tutor.profileId}, 'Bonjour, à jeudi.')`;
  reportSubjects.push(messageId);
  return { tutor, student, messageId };
}

const reportRows = async (id: string) =>
  (await sql<{ n: number }[]>`select count(*)::int n from reports where subject_id = ${id}`)[0].n;

describe("a message is reported from its conversation, never through the public endpoint", () => {
  test("POST /reports refuses subjectKind 'message' — signed out, and signed in as an outsider", async () => {
    const { messageId } = await threadWithMessage();
    const reason = "Ce message contient quelque chose d'inquiétant.";

    const anonymous = await call(app, "POST", "/reports", null, { subjectKind: "message", subjectId: messageId, reason });
    assert.equal(anonymous.body.ok, false, anonymous.raw);
    assert.equal(anonymous.body.error, "report-in-conversation", anonymous.raw);

    const outsider = await seedProfile({ role: "student" });
    const signedIn = await call(app, "POST", "/reports", await login(outsider.id), { subjectKind: "message", subjectId: messageId, reason });
    assert.equal(signedIn.body.ok, false, signedIn.raw);

    assert.equal(await reportRows(messageId), 0, "nothing reached the moderation queue");
  });

  test("a participant still reports it from the conversation, and the queue gets it", async () => {
    const { student, messageId } = await threadWithMessage();
    const res = await call(app, "POST", `/messages/${messageId}/report`, await login(student.id), {
      reason: "Il me demande mon numéro.",
    });
    assert.equal(res.body.ok, true, res.raw);
    assert.equal(await reportRows(messageId), 1);
  });
});

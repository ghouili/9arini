import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedTutor, seedVerificationDoc } from "./support/seed";
import { e2eStore } from "./support/store";

/* THE 90-DAY PROMISE (/privacy §5), proven through the scheduled path.

   Every test runs the purge the way production does — POST /cron/purge with the
   bearer secret — and then looks in STORAGE, not only at the rows: a purge that
   deleted rows and left the scans on disk would pass a row-count test and break
   the promise completely. */

const API = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";

async function purge(auth: string | null = `Bearer ${process.env.CRON_SECRET ?? ""}`) {
  const res = await fetch(`${API}/cron/purge`, {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function decidedTutorWithDoc(status: "verified" | "rejected" | "pending", decidedDaysAgo: number | null) {
  const tutor = await seedTutor({ status });
  if (decidedDaysAgo !== null) {
    await sql`update tutors set reviewed_at = now() - (${decidedDaysAgo} * interval '1 day') where id = ${tutor.id}`;
  }
  const doc = await seedVerificationDoc(tutor.id);
  const key = `verification/${tutor.id}/${doc.fileName}`;
  expect(await e2eStore().get(key), "the seeded scan is really in storage").not.toBeNull();
  return { tutor, doc, key };
}

test.describe("privacy: identity documents are deleted after the retention window", () => {
  test("91 days after a decision, accepted or refused, the scan is gone from storage", async () => {
    const accepted = await decidedTutorWithDoc("verified", 91);
    const refused = await decidedTutorWithDoc("rejected", 91);

    const run = await purge();
    expect(run.status, JSON.stringify(run.body)).toBe(200);

    for (const { doc, key } of [accepted, refused]) {
      expect(await e2eStore().get(key), "the file itself is deleted, not only its row").toBeNull();
      const [row] = await sql<{ n: number }[]>`select count(*)::int n from verification_docs where id = ${doc.id}`;
      expect(row.n).toBe(0);
    }
  });

  test("what remains is the trace /privacy describes: the kind, the dates and the decision", async () => {
    const { tutor } = await decidedTutorWithDoc("verified", 120);
    expect((await purge()).status).toBe(200);

    const traces = await sql<Record<string, unknown>[]>`select * from verification_traces where tutor_id = ${tutor.id}`;
    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({ kind: "id_front", decision: "verified", reason: "retention" });
    expect(traces[0].decided_at).toBeTruthy();
    expect(traces[0].uploaded_at).toBeTruthy();
    expect(Object.keys(traces[0]).sort(), "no file name, no path, no person").toEqual(
      ["decided_at", "decision", "id", "kind", "purged_at", "reason", "tutor_id", "uploaded_at"],
    );
  });

  test("inside the window, and while an application awaits a decision, the scan stays", async () => {
    const recent = await decidedTutorWithDoc("verified", 89);
    const pending = await decidedTutorWithDoc("pending", null);
    expect((await purge()).status).toBe(200);

    expect(await e2eStore().get(recent.key), "89 days is inside the window").not.toBeNull();
    expect(await e2eStore().get(pending.key), "the admin queue still needs it").not.toBeNull();
  });

  test("the purge refuses a caller without the cron secret, and deletes nothing", async () => {
    const { key } = await decidedTutorWithDoc("verified", 200);
    expect((await purge(null)).status).toBe(401);
    expect((await purge("Bearer not-the-secret")).status).toBe(401);
    expect(await e2eStore().get(key), "a refused run touched nothing").not.toBeNull();
    expect((await purge()).status).toBe(200);
  });
});

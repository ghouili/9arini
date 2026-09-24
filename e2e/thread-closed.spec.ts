import { test, expect } from "@playwright/test";
import { sql } from "./support/db";
import { seedProfile, seedTutor, seedClass, seedBooking } from "./support/seed";
import { mintSession, sessionCookie } from "./support/session";
import { api } from "./support/journey";

/* phase-a A2 — A CLOSED CONVERSATION, as the person in it sees it.

   The API refuses the send (apps/api/test/messages-route.test.ts proves each
   reason). This proves the page says so, in both languages, and takes the
   composer away, while the history stays on screen.

   ADDED as its own spec (lane L1). Written for the orchestrator's run after merge. */

async function closedThread() {
  const tutorProfile = await seedProfile({ role: "tutor", birthYear: 1985 });
  const tutor = await seedTutor({ profileId: tutorProfile.id, status: "verified" });
  // Ended well over THREAD_CLOSE_DAYS (7) ago.
  const klass = await seedClass({ tutorId: tutor.id, seats: 10, hoursFromNow: -24 * 10 });
  const student = await seedProfile({ role: "student", birthYear: 1995 });
  const booking = await seedBooking({ classId: klass.id, studentId: student.id });
  const studentToken = await mintSession(student.id);
  const opened = await api("/threads", studentToken, { bookingId: booking.id });
  expect(opened.ok, JSON.stringify(opened)).toBe(true);
  const threadId = opened.threadId as string;
  // History written while it was open.
  await sql`insert into messages (thread_id, sender_profile_id, body)
            values (${threadId}, ${tutorProfile.id}, 'Merci pour la séance !')`;
  return { threadId, studentToken };
}

for (const [locale, title] of [["fr", "Conversation fermée"], ["ar", "المحادثة تسكّرت"]] as const) {
  test(`/${locale}: a closed thread shows the banner, keeps the history, disables the composer`, async ({ browser }) => {
    const { threadId, studentToken } = await closedThread();

    const send = await api(`/threads/${threadId}/messages`, studentToken, { body: "Encore une question" });
    expect(send).toEqual({ ok: false, error: "thread-closed" });

    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    await ctx.addCookies([sessionCookie(studentToken)]);
    const page = await ctx.newPage();
    await page.goto(`/${locale}/messages/${threadId}`);

    const banner = page.getByTestId("thread-closed");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(title);
    await expect(page.locator("main").getByText("Merci pour la séance !")).toBeVisible();
    await expect(page.locator("textarea#msg")).toBeDisabled();
    await expect(page.locator("form button[type=submit]")).toBeDisabled();

    await ctx.close();
    await sql`delete from messages where thread_id = ${threadId}`;
    await sql`delete from message_threads where id = ${threadId}`;
  });
}

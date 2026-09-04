import "server-only";
import { eq } from "@tnajem/db";
import { db, dbReady } from "@/lib/db";
import { profiles, notifications } from "@tnajem/db";
import { smsEnabled, sendSms } from "@tnajem/shared/sms";
import type { NotificationKind } from "@tnajem/shared";

/* Notification dispatcher.

   In-app is the ALWAYS-ON channel: every notify() writes a `notifications` row,
   which the bell/list reads back. SMS is an optional second channel — only sent
   when an SMS provider is configured AND the caller supplies a short `sms` body
   (SMS costs money, so we don't text people for everything).

   Hard rule: notify() NEVER throws into its caller. A failed notification must
   not roll back a booking or a verification decision — we log and move on. */

export type NotifyInput = {
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string | null;
  sms?: string; // when set + provider configured → also texted to the profile's phone
};

export async function notify(profileId: string, input: NotifyInput): Promise<{ ok: boolean }> {
  if (!dbReady || !profileId) return { ok: false };
  try {
    await db.insert(notifications).values({
      profileId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
    });

    if (input.sms && smsEnabled()) {
      const [p] = await db.select({ phone: profiles.phone }).from(profiles).where(eq(profiles.id, profileId)).limit(1);
      if (p?.phone) await sendSms(p.phone, input.sms); // sendSms already swallows its own errors
    }
    return { ok: true };
  } catch (e) {
    console.error("[Tnajem] notify failed:", input.kind, profileId, e);
    return { ok: false };
  }
}

/* ---------- Phase 2: WhatsApp class reminders ----------
   Cadence (10-live-class-playbook.md): on-booking → T-24h → T-1h → T-5min.
   Still a stub — needs WHATSAPP_TOKEN + WHATSAPP_PHONE_ID and approved utility
   templates. The in-app "class_reminder" kind above is the channel that works today. */

export type ReminderStep = "booking" | "t24h" | "t1h" | "t5min";
export const REMINDER_CADENCE: ReminderStep[] = ["booking", "t24h", "t1h", "t5min"];

export type ReminderPayload = {
  toPhone: string;
  studentName: string;
  className: string;
  whenISO: string;
  joinUrl?: string;
  step: ReminderStep;
};

export async function sendClassReminder(payload: ReminderPayload): Promise<{ ok: boolean; stubbed: boolean }> {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log("[Tnajem reminder — STUB]", payload.step, "→", payload.toPhone, payload.className);
  }
  return { ok: true, stubbed: true };
}

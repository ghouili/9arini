/* Phase-2 stub: WhatsApp class reminders.
   The cadence (from 10-live-class-playbook.md): on-booking → T-24h (reply to confirm) → T-1h → T-5min.
   Wire to the WhatsApp Cloud API (utility templates) — see 11-mvp-tooling-stack.md.
   Kept as a no-op stub so the booking flow can call it today without a backend. */

export type ReminderStep = "booking" | "t24h" | "t1h" | "t5min";

export type ReminderPayload = {
  toPhone: string;
  studentName: string;
  className: string;
  whenISO: string;
  joinUrl?: string;
  step: ReminderStep;
};

export async function sendClassReminder(payload: ReminderPayload): Promise<{ ok: boolean; stubbed: boolean }> {
  // TODO (Phase 2): POST to WhatsApp Cloud API utility template.
  // Requires WHATSAPP_TOKEN + WHATSAPP_PHONE_ID and approved templates.
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log("[9arini reminder — STUB]", payload.step, "→", payload.toPhone, payload.className);
  }
  return { ok: true, stubbed: true };
}

export const REMINDER_CADENCE: ReminderStep[] = ["booking", "t24h", "t1h", "t5min"];

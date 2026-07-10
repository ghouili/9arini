import "server-only";

/* SMS delivery for OTP codes.

   Reference implementation uses Twilio's REST API directly via fetch — no SDK,
   so nothing to npm-install. When the TWILIO_* env vars are set, codes are
   texted; otherwise smsEnabled() is false and the caller falls back to showing
   the code on-screen (dev mode). To use a Tunisian gateway instead, swap the
   request body in sendSms() — the rest of the app is provider-agnostic. */

export function smsEnabled(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      // Either a phone/long-code sender OR a Messaging Service (recommended for
      // Tunisia: lets you use a registered alphanumeric sender ID).
      (process.env.TWILIO_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID),
  );
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!sid || !token || (!from && !messagingServiceSid)) return false;
  try {
    const params: Record<string, string> = { To: to, Body: body };
    // Prefer a Messaging Service when configured (better deliverability + sender ID).
    if (messagingServiceSid) params.MessagingServiceSid = messagingServiceSid;
    else params.From = from as string;
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params).toString(),
      },
    );
    if (!res.ok) {
      console.error("SMS send failed:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("SMS send error:", e);
    return false;
  }
}

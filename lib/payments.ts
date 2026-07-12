import "server-only";

/* ============================ PAYMENTS — HARD-DISABLED ============================

   NOTHING IN THIS APP MOVES MONEY. This file is scaffolding only.

   Before a single millime can be charged or paid out, 9arini needs:
     1. Legal/company sign-off (registered entity, CGV/CGU, refund policy).
     2. INPDP posture reviewed for payment data (we store NO card data — the
        provider hosts the payment page; we only keep an opaque provider ref).
     3. Real provider credentials + a merchant contract (Konnect / Flouci).
     4. A webhook endpoint with signature verification (does not exist yet).

   Until then `paymentsEnabled()` is false, every adapter method throws, and the
   dashboard reports a real balance of 0 — we never fabricate earnings.

   To enable later: set PAYMENTS_ENABLED=1 plus the provider env vars, implement
   the adapter bodies, and add the webhook route. The rest of the app talks only
   to the PaymentProvider interface, so swapping rails is a one-line change.
   ================================================================================= */

export type Millimes = number; // integer minor units (1 TND = 1000 millimes)

export type ChargeInput = {
  amountTnd: number;
  description: string;
  payerPhone?: string;
  bookingId?: string;
  packId?: string;
  returnUrl?: string;
};
export type Charge = { id: string; providerRef: string; payUrl: string; status: ChargeStatus };
export type ChargeStatus = "pending" | "paid" | "failed" | "refunded";

export type PayoutInput = {
  tutorId: string;
  amountTnd: number;
  method: "flouci_wallet" | "bank_rib";
  destination: string; // wallet number or RIB — never logged
};
export type Payout = { id: string; providerRef: string; status: ChargeStatus };

/** Provider-agnostic rail. Adapters below implement it; the app never imports an adapter directly. */
export interface PaymentProvider {
  readonly name: "konnect" | "flouci";
  createCharge(input: ChargeInput): Promise<Charge>;
  getChargeStatus(providerRef: string): Promise<ChargeStatus>;
  createPayout(input: PayoutInput): Promise<Payout>;
}

/** Master switch. Default OFF — an unset env var must never enable money movement. */
export function paymentsEnabled(): boolean {
  return process.env.PAYMENTS_ENABLED === "1";
}

export class PaymentsDisabledError extends Error {
  constructor(op: string) {
    super(
      `[9arini] payments are disabled — refusing to ${op}. ` +
        "Money movement requires legal/INPDP sign-off and provider credentials.",
    );
    this.name = "PaymentsDisabledError";
  }
}

/** Every adapter method calls this first. Throws while disabled — by design. */
function assertEnabled(op: string): void {
  if (!paymentsEnabled()) throw new PaymentsDisabledError(op);
}

/* ---------- Konnect adapter (stub) ---------- */
class KonnectProvider implements PaymentProvider {
  readonly name = "konnect" as const;

  async createCharge(_input: ChargeInput): Promise<Charge> {
    assertEnabled("create a Konnect charge");
    // TODO: POST https://api.konnect.network/api/v2/payments/init-payment
    //       (x-api-key: KONNECT_API_KEY, receiverWalletId: KONNECT_WALLET_ID)
    throw new Error("konnect:createCharge not implemented");
  }
  async getChargeStatus(_providerRef: string): Promise<ChargeStatus> {
    assertEnabled("read a Konnect charge");
    throw new Error("konnect:getChargeStatus not implemented");
  }
  async createPayout(_input: PayoutInput): Promise<Payout> {
    assertEnabled("create a Konnect payout");
    throw new Error("konnect:createPayout not implemented");
  }
}

/* ---------- Flouci adapter (stub) ---------- */
class FlouciProvider implements PaymentProvider {
  readonly name = "flouci" as const;

  async createCharge(_input: ChargeInput): Promise<Charge> {
    assertEnabled("create a Flouci charge");
    // TODO: POST https://developers.flouci.com/api/generate_payment
    //       (app_token: FLOUCI_APP_TOKEN, app_secret: FLOUCI_APP_SECRET)
    throw new Error("flouci:createCharge not implemented");
  }
  async getChargeStatus(_providerRef: string): Promise<ChargeStatus> {
    assertEnabled("read a Flouci charge");
    throw new Error("flouci:getChargeStatus not implemented");
  }
  async createPayout(_input: PayoutInput): Promise<Payout> {
    assertEnabled("create a Flouci payout");
    throw new Error("flouci:createPayout not implemented");
  }
}

/** Selected rail (PAYMENTS_PROVIDER=konnect|flouci). Returns an adapter whose every
    method throws while payments are off — so a stray call fails loudly, not silently. */
export function paymentProvider(): PaymentProvider {
  return process.env.PAYMENTS_PROVIDER === "flouci" ? new FlouciProvider() : new KonnectProvider();
}

/** Tutor's withdrawable balance. Payments are off → there is nothing to withdraw.
    Returns a REAL 0, not a placeholder: no charge has ever been captured. */
export async function tutorBalanceTnd(_tutorId: string): Promise<number> {
  if (!paymentsEnabled()) return 0;
  // TODO (post sign-off): sum captured payments for this tutor's classes/packs,
  // minus the platform fee, minus payouts already sent.
  return 0;
}

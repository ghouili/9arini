/* When a class can still be sold.

   On 14 Sept a storefront sold a class that had run on 9 September as its
   "Prochaine séance", with "20 places restantes" and a live "Réserver". The API
   already refused the booking (routes/bookings.ts), but every surface that decided
   what to OFFER — the storefront list, its "next session" panel, the class page,
   checkout — only looked at seats.

   One rule, used by every web surface that offers a booking. The API's own public
   listing applies the same condition in SQL (apps/api/src/lib/class-sale.ts).
   Pure module: safe on server + client. */

export type ClassStatus = "scheduled" | "live" | "done" | "cancelled";

/** Scheduled, and not started yet. A class that has started, finished or been
    cancelled is not on sale — however many seats it has left. */
export function isOpenForBooking(
  cls: { starts_at: string; status?: ClassStatus },
  now: number = Date.now(),
): boolean {
  if ((cls.status ?? "scheduled") !== "scheduled") return false;
  const start = Date.parse(cls.starts_at);
  return Number.isFinite(start) && start > now;
}

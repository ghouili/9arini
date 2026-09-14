import { and, gt, sql as raw, classes } from "@tnajem/db";

/* A class is ON SALE while it has not started and is neither cancelled nor done.

   The public storefront listed every class a tutor had ever created: a class from
   9 September was still its "Prochaine séance" on the 14th, and /explore's
   "à partir de X TND" took the minimum over past classes too. Booking itself was
   already refused server-side (routes/bookings.ts) — this is what decides what is
   OFFERED. The web applies the same rule to its own copy of the data
   (isOpenForBooking in @tnajem/shared), which also closes the storefront cache
   window.

   Not used by GET /classes/:id: booked students, the live room and reviews of a
   past class all still need to read it. */
export const onSaleClassSql = and(
  gt(classes.scheduledAt, raw`now()`),
  raw`coalesce(${classes.status}, 'scheduled') not in ('cancelled', 'done')`,
);

import { z } from "zod";
import { t, type ActionResult } from "./envelope";
import type { Me } from "../types";

/* THE ROUTE REGISTRY — one table, imported by both sides.

   apps/web builds a typed `call("getMe")` from it; apps/api registers handlers
   against it. A path typo or a shape mismatch is a compile error rather than a
   404 discovered in the browser.

   ── The two failure channels, kept strictly separate ────────────────────────
   This is the design rule that makes the port provable:

     zod's job          "is this JSON the right SHAPE?"  -> HTTP 400, never
                        reaches the handler. Cannot happen from the real UI.
     the existing       "is this VALUE acceptable?"      -> HTTP 200 with
     validators             { ok: false, error: "<existing-code>" }

   So the schemas below are deliberately loose. `classId: z.string()` and NOT
   z.string().uuid(), because vUuid inside the handler is what produces the
   "not-found" mapping reserveSeat already relies on. Tightening it here would
   turn a 200 the UI understands into a 400 it does not.

   Because of that separation, porting an action changes NOT ONE existing error
   string. That is what makes "zero behaviour change" checkable rather than
   asserted.

   ── Why zod at all, when lib/validation.ts already exists ───────────────────
   The 301 lines in ../validation.ts are not validation, they are security
   controls with individually-argued semantics (safeFileName defends path escape
   AND CRLF header injection in one pass; vBirthYear collapses to null so
   isMinorBirthYear(null) fails safe). They are moved verbatim and used unchanged.

   zod is only for the thing that did not exist before: shape checking at an HTTP
   boundary. Inside a server action TypeScript guaranteed `input.classId` was a
   string. Over HTTP that guarantee evaporates and `input` can be null, an array,
   or a 40MB object. */

export const ROUTES = {
  /* ── auth (read) ─────────────────────────────────────────────────────────
     getMe goes first, alone, as the canary: it is a pure read that proves cookie
     forwarding, session lookup and the 200-envelope convention end to end. If
     getMe works, requireSession is proven before anything risky moves. */
  getMe: {
    method: "GET",
    path: "/me",
    auth: "optional",
    input: z.undefined(),
    output: t<Me | null>(),
  },
} as const;

export type Routes = typeof ROUTES;
export type RouteName = keyof Routes;

export type { ActionResult };
export { t };
export { z };

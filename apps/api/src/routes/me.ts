import type { FastifyInstance } from "fastify";
import type { Me } from "@tnajem/shared";
import { getSession } from "../lib/session";

/* GET /me — the canary.

   Ported first, alone, and on purpose: it is a pure read that exercises the whole
   boundary end to end — cookie forwarding from the web proxy, session lookup by
   join, and the 200-envelope convention — with nothing at risk if it is wrong.
   Once /me works, requireSession is proven before anything that writes moves.

   Returns the caller's OWN profile, so email and phone belong here. Step 8's
   zero-contact rule is about what a COUNTERPARTY sees; /account has always shown
   you your own address. */

export async function meRoutes(app: FastifyInstance): Promise<void> {
  /* GET /session — the minimal projection a server-side page guard needs.

     Deliberately NOT /me. A page guard only ever asks "who is this, what role,
     are they a minor?", and it runs on several routes on every request. Widening
     /me to carry birthYear would have been the smaller diff, but it would push
     e-mail and phone through one more code path right before Step 8 closes
     contact exchange — and the cheapest way to keep PII out of a surface is for
     it never to be in the response at all.

     So: id, role, birthYear, fullName. No e-mail. No phone. */
  app.get("/session", async (req) => {
    const session = await getSession(req);
    if (!session) return null;
    const p = session.profile;
    return { id: p.id, role: p.role, birthYear: p.birthYear, fullName: p.fullName };
  });

  app.get("/me", async (req): Promise<Me | null> => {
    const session = await getSession(req);
    if (!session) return null;

    const p = session.profile;
    return {
      id: p.id,
      name: p.fullName,
      role: p.role,
      email: p.email,
      phone: p.phone,
    };
  });
}

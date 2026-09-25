import { NextResponse } from "next/server";
import { minorsAllowed } from "@tnajem/shared";

/* Phase A+ · P4 — is the pilot adults-only RIGHT NOW?

   The home page is prerendered, so it cannot read ALLOW_MINORS during its own
   render without baking the BUILD's value in. This answers from the running
   server's environment, per request; <PilotTag> asks it after hydration.
   Nothing here is inlined into a bundle. */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ adultsOnly: !minorsAllowed() }, { headers: { "Cache-Control": "no-store" } });
}

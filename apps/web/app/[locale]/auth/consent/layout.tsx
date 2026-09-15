import type { ReactNode } from "react";

/* Pass-through layout: it exists only to make this route REQUEST-TIME.
   The consent form reads ?next= during the server render; prerendered, it would
   ship the Suspense fallback instead of the form.
   A "use client" page cannot export `dynamic`, so the segment config lives here. */
export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

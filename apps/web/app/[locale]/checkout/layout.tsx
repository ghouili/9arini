import type { ReactNode } from "react";

/* Pass-through layout: it exists only to make this route REQUEST-TIME.
   The reservation reads ?class= during the server render, so the HTML carries the
   class instead of a spinner; prerendered, it would be the Suspense fallback.
   A "use client" page cannot export `dynamic`, so the segment config lives here. */
export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

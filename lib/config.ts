/* Client-safe config. DATABASE_URL is server-only and never reaches the browser,
   so client components read this public flag to decide whether to show the
   "demo mode" notice. Set NEXT_PUBLIC_BACKEND_READY=1 once your backend is live. */
export const backendReady = process.env.NEXT_PUBLIC_BACKEND_READY === "1";

"use client";
/* Route-level loading UI (App Router streaming fallback).
   Client component so it can read the active locale — it renders inside the root
   layout, where LocaleProvider is already mounted. RTL-safe. */
import { useLocale } from "@/components/LocaleProvider";

export default function Loading() {
  const { t } = useLocale();
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "60vh",
        display: "grid",
        placeItems: "center",
        padding: "clamp(28px,5vw,64px) 0",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div className="spin" style={{ margin: "0 auto 16px" }} aria-hidden="true" />
        <p className="muted" style={{ fontSize: 13.5, fontWeight: 600 }}>{t.common.loading}</p>
      </div>
    </div>
  );
}

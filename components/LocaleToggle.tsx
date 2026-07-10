"use client";
import type { CSSProperties } from "react";
import { useLocale } from "./LocaleProvider";

export function LocaleToggle({ onBlue }: { onBlue?: boolean }) {
  const { locale, setLocale } = useLocale();
  const base: CSSProperties = onBlue
    ? { background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.25)" }
    : { background: "var(--paper)", border: "1px solid var(--line)" };
  return (
    <div style={{ display: "flex", borderRadius: 999, padding: 3, ...base }}>
      {(["fr", "ar"] as const).map((l) => (
        <button key={l} onClick={() => setLocale(l)}
          style={{
            border: 0, cursor: "pointer", padding: "7px 14px", borderRadius: 999, fontWeight: 700, fontSize: 12.5,
            fontFamily: l === "ar" ? "var(--fa)" : "var(--fb)",
            background: locale === l ? (onBlue ? "#fff" : "var(--ink)") : "transparent",
            color: locale === l ? (onBlue ? "var(--ink)" : "#fff") : (onBlue ? "#fff" : "var(--muted)"),
          }}>
          {l === "fr" ? "Français" : "العربية"}
        </button>
      ))}
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";

type Props = { minutes?: number; big?: boolean };

export function Countdown({ minutes = 14, big = false }: Props) {
  const { t } = useLocale();
  const [total, setTotal] = useState(minutes * 60);

  useEffect(() => {
    setTotal(minutes * 60);
    const id = setInterval(() => setTotal((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [minutes]);

  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (big) {
    return (
      <div style={{ display: "flex", gap: 10, justifyContent: "center", margin: "22px 0" }}>
        {[
          { val: pad(h), label: t.student.hours },
          { val: pad(m), label: t.student.mins },
          { val: pad(s), label: t.student.secs },
        ].map(({ val, label }) => (
          <div
            key={label}
            style={{
              background: "rgba(255,255,255,.10)",
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 16,
              width: 66,
              padding: "12px 0",
              textAlign: "center",
            }}
          >
            <b style={{ fontFamily: "var(--fd)", fontSize: 26, display: "block", lineHeight: 1 }}>{val}</b>
            <span style={{ fontSize: 9.5, color: "#B9C6D8" }}>{label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 9, margin: "14px 0" }}>
      {[
        { val: pad(h), label: t.student.hours },
        { val: pad(m), label: t.student.mins },
        { val: pad(s), label: t.student.secs },
      ].map(({ val, label }) => (
        <div
          key={label}
          style={{
            background: "rgba(255,255,255,.12)",
            borderRadius: 12,
            padding: "9px 0",
            textAlign: "center",
            flex: 1,
          }}
        >
          <b style={{ fontFamily: "var(--fd)", fontSize: 21, display: "block" }}>{val}</b>
          <span style={{ fontSize: 9.5, color: "#B9C6D8", letterSpacing: ".3px" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

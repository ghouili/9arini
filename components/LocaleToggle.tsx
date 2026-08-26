"use client";
import { useLocale } from "./LocaleProvider";

/* FR ⇄ AR switch. Two labels ship in the markup and CSS picks one, so the
   compact header variant costs no JS and can't hydrate-mismatch:
     • default  → « Français » / « العربية »   (settings, wide surfaces)
     • compact  → « FR » / « ع » under 1140px   (header: at 320px the brand +
                  full toggle + burger overflow the row, and between 1024 and
                  1140px the full toggle crowds the nav links + CTA)
   Page-scoped CSS is prefixed `qlt-` and injected with dangerouslySetInnerHTML
   (an inline <style>{`…`}</style> in a client component triggers hydration
   errors). It is UNLAYERED, so it wins over globals.css's @layer components. */

const CSS = `
.qlt{display:flex;align-items:center;border-radius:999px;padding:3px;flex:none}
.qlt button{
  border:0;cursor:pointer;padding:8px 14px;border-radius:999px;font-weight:700;font-size:12.5px;
  min-height:40px;display:inline-flex;align-items:center;justify-content:center;
  background:transparent;transition:.15s;white-space:nowrap;
}
.qlt .qlt-short{display:none}
@media (max-width:1139px){
  .qlt-compact button{padding:8px 12px}
  .qlt-compact .qlt-long{display:none}
  .qlt-compact .qlt-short{display:inline}
}
`;

export function LocaleToggle({ onBlue, compact }: { onBlue?: boolean; compact?: boolean }) {
  const { locale, setLocale } = useLocale();
  const wrap = onBlue
    ? { background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.25)" }
    : { background: "var(--paper)", border: "1px solid var(--line)" };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className={`qlt${compact ? " qlt-compact" : ""}`} style={wrap}>
        {(["fr", "ar"] as const).map((l) => {
          const on = locale === l;
          return (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              aria-pressed={on}
              lang={l}
              aria-label={l === "fr" ? "Français" : "العربية"}
              style={{
                fontFamily: l === "ar" ? "var(--fa)" : "var(--fb)",
                background: on ? (onBlue ? "#fff" : "var(--ink)") : "transparent",
                color: on ? (onBlue ? "var(--ink)" : "#fff") : onBlue ? "#fff" : "var(--muted)",
              }}
            >
              <span className="qlt-long">{l === "fr" ? "Français" : "العربية"}</span>
              <span className="qlt-short" aria-hidden="true">{l === "fr" ? "FR" : "ع"}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

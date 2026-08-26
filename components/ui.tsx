// 9arini UI primitives. Presentational (no hooks) so they work in server or client components.
import type { ReactNode, CSSProperties } from "react";

type BtnProps = {
  children: ReactNode;
  variant?: "primary" | "ink" | "green" | "ghost";
  sm?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  style?: CSSProperties;
  /** Appended to the button's classes. Without it, callers could only reach this
      element through descendant selectors (e.g. `form .btn .spin`). */
  className?: string;
  "aria-label"?: string;
};
export function Button({ children, variant = "primary", sm, onClick, type = "button", disabled, style, className = "", "aria-label": ariaLabel }: BtnProps) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={style} aria-label={ariaLabel}
      className={`btn btn-${variant}${sm ? " btn-sm" : ""}${className ? ` ${className}` : ""}`}>
      {children}
    </button>
  );
}

/* ── Card — THE canonical surface primitive (see .u-card in app/globals.css) ──
   Replaces the hand-rolled `rounded-[var(--r-l)] border border-solid border-line
   bg-paper p-5 shadow-[var(--sh-s)]` string that was copy-pasted across home /
   explore, and the .panel duplicate. It is a flex column with height:100%, so:
     • cards in a grid row are automatically EQUAL HEIGHT
     • <CardFooter> (or .u-card-foot) pins the footer so footers line up
     • min-w-0 is applied to the card and its children, so truncate /
       line-clamp inside actually works instead of blowing the track wide
   Usage:
     <Card>…</Card>                                  static card
     <Card interactive>…</Card>                      hover lift (wrap in a Link)
     <Card pad={false} className="overflow-hidden">  edge-to-edge media card
   For a card that IS the link, skip the component and put the classes on the
   anchor: className="u-card u-card-pad u-card-int" (see ExploreClient).
   `.card` (small radius --r) remains the COMPACT variant used inside the 440px
   app frame — it is intentionally a different, tighter surface. */
type CardProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** canonical fluid padding (16→22px). Set false for edge-to-edge content. */
  pad?: boolean;
  /** hover lift + deeper shadow. Use only when the whole card is clickable. */
  interactive?: boolean;
};
export function Card({ children, className = "", style, pad = true, interactive }: CardProps) {
  const cls = ["u-card", pad && "u-card-pad", interactive && "u-card-int", className]
    .filter(Boolean)
    .join(" ");
  return <div className={cls} style={style}>{children}</div>;
}

/** Bottom section of a <Card>. margin-block-start:auto pins it, which is what
    keeps footers aligned across cards of differing content length. */
export function CardFooter({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={`u-card-foot ${className}`} style={style}>{children}</div>;
}

export function Chip({ children, kind = "soft", className = "", style }: { children: ReactNode; kind?: "free" | "soft" | "sand" | "rose"; className?: string; style?: CSSProperties }) {
  return <span className={`chip chip-${kind}${className ? ` ${className}` : ""}`} style={style}>{children}</span>;
}

export function Avatar({ initials, size = 78, square }: { initials: string; size?: number; square?: boolean }) {
  return (
    <div className={`avatar${square ? " sq" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.38, borderRadius: square ? size * 0.28 : 20 }}>
      {initials}
    </div>
  );
}

export function Field({ label, children, help }: { label: string; children: ReactNode; help?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {help && <div className="help">{help}</div>}
    </label>
  );
}

export function Spinner() { return <div className="spin" />; }

/* The blue tick. `.verified` is a fixed 18px circle with flex:none — without
   that it deformed into an ellipse whenever it sat next to a truncated name in
   a tight flex row (explore card, storefront header, home hero). `label` adds
   screen-reader text: the tick carries real meaning ("prof vérifié") that was
   previously invisible to AT. Pass the localized string; omit for decorative use
   next to an existing "Vérifié" label. */
export function Verified({ label }: { label?: string } = {}) {
  return (
    <span className="verified" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg viewBox="0 0 24 24" className="ic"><polyline points="5 13 10 18 19 7" /></svg>
    </span>
  );
}

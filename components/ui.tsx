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
};
export function Button({ children, variant = "primary", sm, onClick, type = "button", disabled, style }: BtnProps) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={style}
      className={`btn btn-${variant}${sm ? " btn-sm" : ""}`}>
      {children}
    </button>
  );
}

export function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={`card ${className}`} style={style}>{children}</div>;
}

export function Chip({ children, kind = "soft" }: { children: ReactNode; kind?: "free" | "soft" | "sand" | "rose" }) {
  return <span className={`chip chip-${kind}`}>{children}</span>;
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

export function Verified() {
  return <span className="verified"><svg viewBox="0 0 24 24" className="ic"><polyline points="5 13 10 18 19 7" /></svg></span>;
}

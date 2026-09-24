/* Tnajem UI primitives. Presentational, and server-renderable EXCEPT for Field:
   it calls useId() to wire aria-describedby, which makes it client-only. Every
   Field call site is already a "use client" component (auth, signup, onboarding,
   consent, new-class, new-pack, upgrade, student welcome), so nothing regressed —
   but keep new Fields on the client side, and keep the rest of this file hook-free
   so Button/Card/Chip/Avatar/Spinner/Verified stay usable from server components. */
import { Children, cloneElement, isValidElement, useId } from "react";
import type { ReactNode, ReactElement, CSSProperties } from "react";
import Image from "next/image";

type BtnProps = {
  children: ReactNode;
  variant?: "primary" | "green" | "ghost" | "outline";
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
/* ── LITERAL CLASS NAMES, NEVER `btn-${variant}` ──────────────────────────────
   Tailwind purges anything in `@layer components` whose selector it cannot find
   in the scanned source, and it scans TEXT — it never sees a class name built at
   runtime. `btn-${variant}` meant `.btn-green` appeared nowhere in the source but
   its own definition, so the emitted stylesheet HAD NO .btn-green AT ALL and four
   shipped buttons rendered with no fill: approve-a-tutor on the admin queue, the
   guardian consent submit, the dashboard's primary action and the payout button.

   They were still readable, which is why nothing caught it — axe passed,
   contrast.mjs passed (it checks the token pair, not whether the rule survives),
   and the screenshots that would have shown it were of screens the harness was
   auditing in their empty or denied state. Found by looking at the pictures.

   A map, so every class name exists as a literal string. Do not "simplify" it
   back into a template. */
const BTN_VARIANT = {
  primary: "btn-primary",
  green: "btn-green",
  ghost: "btn-ghost",
  outline: "btn-outline", // UI Option A (A3)
} as const;

export function Button({ children, variant = "primary", sm, onClick, type = "button", disabled, style, className = "", "aria-label": ariaLabel }: BtnProps) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={style} aria-label={ariaLabel}
      className={`btn ${BTN_VARIANT[variant]}${sm ? " btn-sm" : ""}${className ? ` ${className}` : ""}`}>
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

/* Same rule as BTN_VARIANT above, and the same bug: `.chip-free` was purged out
   of the stylesheet entirely, so the "Gratuit" badge on a student's booked class
   — the label that says the session costs them nothing — rendered with no fill. */
const CHIP_KIND = {
  free: "chip-free",
  soft: "chip-soft",
  sand: "chip-sand",
  rose: "chip-rose",
} as const;

export function Chip({ children, kind = "soft", className = "", style }: { children: ReactNode; kind?: "free" | "soft" | "sand" | "rose"; className?: string; style?: CSSProperties }) {
  return <span className={`chip ${CHIP_KIND[kind]}${className ? ` ${className}` : ""}`} style={style}>{children}</span>;
}

/* THE MONOGRAM IS THE DEFAULT, and it stays the default. Most tutors will never
   upload a photo, minors may never have one, and an unreviewed photo renders as
   initials to everyone but its owner — so `src` is the exception, not the norm.

   `unoptimized`, and the reason is specific rather than lazy. /_next/image
   fetches the source SERVER-SIDE, without the viewer's cookies, so a tutor
   previewing their own PENDING photo would get a 404 from an endpoint that
   correctly refuses an anonymous request. There is also nothing to gain: these
   are already exactly the three sizes the product renders, re-encoded to WebP at
   upload (see apps/api/src/lib/avatar.ts). next/image is still the component —
   width, height and lazy loading, so no layout shift — just not the optimiser. */
export function Avatar({
  initials,
  size = 78,
  square,
  src,
  alt,
}: {
  initials: string;
  size?: number;
  square?: boolean;
  src?: string | null;
  alt?: string;
}) {
  const radius = square ? size * 0.28 : 20;
  if (src) {
    return (
      <Image
        src={src}
        alt={alt ?? ""}
        width={size}
        height={size}
        unoptimized
        className={`avatar${square ? " sq" : ""}`}
        style={{ width: size, height: size, borderRadius: radius, objectFit: "cover" }}
      />
    );
  }
  return (
    <div className={`avatar${square ? " sq" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.38, borderRadius: radius }}>
      {initials}
    </div>
  );
}

/* The wrapping <label> associates the control implicitly, so no htmlFor/id pair is
   needed for the NAME. The description is a different problem: `help` and the error
   were rendered next to the input but never referenced by it, so a screen-reader
   user got the label and nothing else — no format rule, no reason the field was
   red. (aria-describedby had zero occurrences anywhere in the app.)

   useId gives stable ids across SSR and hydration, and the ids are pushed onto the
   child input via cloneElement only when there is something to describe — a
   dangling aria-describedby pointing at no element is worse than none.

   `error` is announced with role="alert" and takes precedence in the description
   order, so the problem is read before the general help text.

   While `error` is set the control also carries aria-invalid="true"; the attribute
   disappears on the render after the caller clears the error. The control always
   gets a stable id (unless the caller set one), so a caller can focus it and a
   test can find it. Moving focus is the CALLER's job — only the form knows which
   field failed a submit — via a ref on the input; cloneElement keeps the ref. */
export function Field({
  label, children, help, error,
}: { label: string; children: ReactNode; help?: string; error?: string }) {
  const uid = useId();
  const helpId = help ? `${uid}-help` : undefined;
  const errorId = error ? `${uid}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(" ") || undefined;

  /* The control is usually wrapped (e.g. <div className="inp"><input/></div>), so
     walk one level to find it rather than assuming children IS the input. */
  const described = wire(children, { id: `${uid}-control`, describedBy, invalid: Boolean(error) });

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {described}
      {error && (
        <div id={errorId} role="alert" className="help text-rose font-semibold">
          {error}
        </div>
      )}
      {help && <div id={helpId} className="help">{help}</div>}
    </label>
  );
}

type ControlProps = { children?: ReactNode; id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean | "true" | "false" };

/** Give the FIRST form control found in `node` its id, aria-describedby and
    aria-invalid. Only the first: a second control must not get the same id. */
function wire(
  node: ReactNode,
  a: { id: string; describedBy?: string; invalid: boolean },
  seen = { control: false },
): ReactNode {
  if (seen.control || !isValidElement(node)) return node;
  const el = node as ReactElement<ControlProps>;
  const type = el.type;
  if (type === "input" || type === "textarea" || type === "select") {
    seen.control = true;
    // Never clobber an id, description or invalid state a caller set deliberately.
    const props: ControlProps = {};
    if (!el.props.id) props.id = a.id;
    if (a.describedBy && !el.props["aria-describedby"]) props["aria-describedby"] = a.describedBy;
    if (a.invalid && el.props["aria-invalid"] === undefined) props["aria-invalid"] = true;
    return cloneElement(el, props);
  }
  if (el.props?.children == null) return el;
  return cloneElement(el, {
    children: Children.map(el.props.children, (child) => wire(child, a, seen)),
  });
}

/* role="status" + aria-live: a spinner is a STATUS MESSAGE (WCAG 4.1.3). Without
   the role, a screen-reader user gets silence during every OTP request, notif
   fetch and form submit — no way to tell "working" from "nothing happened".
   `label` is optional so callers that already announce their own state can pass
   nothing; the visual dot itself stays aria-hidden either way. */
export function Spinner({ label }: { label?: string } = {}) {
  return (
    <div role="status" aria-live="polite">
      <div className="spin" aria-hidden="true" />
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  );
}

/* The verified tick (green since UI Option A, A4). `.verified` is a fixed 18px circle with flex:none — without
   that it deformed into an ellipse whenever it sat next to a truncated name in
   a tight flex row (explore card, storefront header, home hero). `label` adds
   screen-reader text: the tick carries real meaning ("prof vérifié") that was
   previously invisible to AT. Pass the localized string; omit for decorative use
   next to an existing "Vérifié" label. */
export function Verified({ label, pill }: { label?: string; pill?: string } = {}) {
  /* UI Option A (A4): `pill` shows the WORD ("Vérifié" / "متثبّت منّو") beside the
     tick — the tutor page hero only. Everywhere else it stays the round icon. The
     accessible name is unchanged: `label` when given, else decorative. */
  return (
    <span className={pill ? "verified verified-pill" : "verified"} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} title={pill ? label : undefined}>
      <svg viewBox="0 0 24 24" className="ic" aria-hidden="true"><polyline points="5 13 10 18 19 7" /></svg>
      {pill && <span>{pill}</span>}
    </span>
  );
}

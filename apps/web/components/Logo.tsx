import Image from "next/image";

/* The brand mark. THE only place the logo file is referenced — every other file
   imports this, so a future asset swap (or the pending rename) is one edit.

   ── Sizing, and why it is not left to CSS ──────────────────────────────────
   `next/image` cannot resize anything in this project. Next 14 needs `sharp`
   for that and it is not installed; /_next/image passes the original file
   through untouched (verified: a request for w=64 returned the full 1.18 MB
   source). So public/logo.png is emitted PRE-SIZED by scripts/brand/build-raster.py
   and what is on disk is exactly what a visitor downloads — 34 kB, not 1.18 MB.

   `height` is the prop because the mark is 1.44:1 and every call site is a
   horizontal row with a known bar height; width is derived so nobody can pick a
   pair that distorts it. Both land on the <img> as real attributes, so the
   browser reserves the box before the bytes arrive and the header does not jump.

   ── RTL ───────────────────────────────────────────────────────────────────
   The mark is DIRECTIONAL (thumbs-up right, open hand left) and is deliberately
   NOT mirrored in Arabic — founder decision, 2026-08-26. It is a fixed brand
   asset: mirroring would make Arabic a second, subtly different logo, and a
   thumbs-up carries no reading direction the way an arrow does. There is no
   transform here and there must not be one. Placement still flips correctly
   because the row is laid out with flex + logical properties.

   ── Accessibility ─────────────────────────────────────────────────────────
   `variant="full"` renders the mark beside the visible wordmark, so the mark is
   decorative (`alt=""` + aria-hidden) and the brand name is announced exactly
   once, from the text. A standalone `variant="mark"` has no such text, so it
   takes an explicit `alt` — the type makes that non-optional, because an
   unlabelled brand image in a link is how a logo ends up announced as
   "logo.png". Pass `alt=""` deliberately when the parent link already carries an
   aria-label. */

/** Intrinsic aspect of the artwork in brand/logo-source.png (1319 x 917). */
const ASPECT = 1319 / 917;

type Common = {
  /** Rendered height in CSS px. Width is derived from the artwork's aspect. */
  height?: number;
  /** `light` = the white mark, for cobalt/ink surfaces. */
  theme?: "default" | "light";
  /** Only the above-the-fold header should preload. */
  priority?: boolean;
  className?: string;
};

type Props =
  | (Common & { variant?: "full"; alt?: never })
  | (Common & { variant: "mark"; alt: string });

export function Logo({
  variant = "full",
  height = 38,
  theme = "default",
  priority = false,
  className,
  alt,
}: Props) {
  const width = Math.round(height * ASPECT);
  const src = theme === "light" ? "/logo-white.png" : "/logo.png";

  const img = (
    <Image
      src={src}
      width={width}
      height={height}
      priority={priority}
      /* Not `sizes` — that only matters when the optimiser generates a srcset,
         which it cannot do here. One file, one size. */
      /* Empty for `full` (the wordmark beside it carries the name) and for a
         `mark` whose parent link is already labelled. Non-empty only when a
         caller passes real text, and then the image must NOT be aria-hidden or
         the label it just supplied would be thrown away. */
      alt={alt ?? ""}
      aria-hidden={alt ? undefined : true}
      className={variant === "mark" ? className : undefined}
      style={{ width, height }}
    />
  );

  if (variant === "mark") return img;

  return (
    <span className={`brand-mark ${className ?? ""}`.trim()}>
      {img}
      <span className="brand-word">
        Tnajem <span className="ar">تنجّم</span>
      </span>
    </span>
  );
}

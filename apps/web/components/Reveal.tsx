"use client";
import React, { useEffect, useRef, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   SCROLL-REVEAL — PROGRESSIVE ENHANCEMENT, NOT A PREREQUISITE FOR READING.

   Extracted from /pour-les-profs, which is where this was worked out and where
   it had already been got wrong once. /tarifs now needs the same behaviour, and
   a second copy of a rule about whether content is VISIBLE is not a duplication
   this codebase can afford — the recurring bug here has always been two
   implementations of one rule that nothing forces to agree.

   ── WHY IT IS INVERTED ──────────────────────────────────────────────────────
   The first version started hidden (`opacity:0` in the SSR HTML) and became
   visible only once an IntersectionObserver fired from a useEffect. That shipped
   a BLANK HERO for the whole JS download-and-parse window, and a permanently
   blank page if the bundle never arrived — which, on the 3G Android these pages
   are actually opened on, is not the edge case.

   So the element starts UNARMED: the server-rendered HTML is already the final,
   visible state, and JS only *arms* the animation. With JS off, or a failed
   bundle, or a headless renderer, the page is simply a static page. That is what
   keeps `nojs.mjs` green, and it is why nothing here may ever gate visibility on
   a class.

   It arms only elements that are currently OFF-SCREEN, so arming can never blink
   out something the reader is already looking at.
   ═══════════════════════════════════════════════════════════════════════════ */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // Already on screen at mount → leave it alone; animating it now would be a
    // visible flash-out/flash-in of content the reader can see.
    const r = el.getBoundingClientRect();
    if (r.bottom > 0 && r.top < window.innerHeight) return;

    setArmed(true);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setArmed(false);
            io.disconnect();
            break;
          }
        }
      },
      /* threshold 0, not 0.16: a section TALLER than the viewport can never reach
         a fractional visibility ratio, so 0.16 left tall sections armed — and
         therefore invisible — forever. That is very reachable at 320px in Arabic.
         The negative bottom rootMargin does the "wait until it is properly on
         screen" job instead, and it is height-independent. */
      { threshold: 0, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, armed };
}

/** The class names are supplied by the caller's own page-scoped CSS, so each
    page keeps its prefix (`lpp-`, `tf-`) and only the LOGIC is shared. */
export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  base,
  armedClass,
  delayVar,
  className = "",
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  as?: React.ElementType;
  /** e.g. "lpp-reveal" — carries the transition. */
  base: string;
  /** e.g. "lpp-armed" — the offset/opacity that JS removes. */
  armedClass: string;
  /** e.g. "--lpp-d" — the custom property holding the stagger delay. */
  delayVar: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { ref, armed } = useReveal<HTMLElement>();
  return (
    <Tag
      ref={ref}
      className={`${base} ${armed ? armedClass : ""} ${className}`}
      style={{ ...style, [delayVar]: `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}

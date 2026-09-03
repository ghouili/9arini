"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/* A seconds countdown that ticks once per second and stops at zero.

   Both login screens need two of these at once — the 60-second resend cooldown and
   the code's 5-minute life — so the logic is a hook rather than the inline
   setInterval that <StartsIn> uses on the student dashboard.

   Counts against a DEADLINE, not by decrementing a number. Timers drift and browsers
   throttle intervals in background tabs, so a subtract-one-per-tick counter finishes
   late — sometimes minutes late on a phone whose screen went off mid-signup. Anchoring
   to Date.now() means switching back to the tab shows the true remaining time. */
export function useCountdown() {
  const deadline = useRef<number>(0);
  const [left, setLeft] = useState(0);

  /** (Re)arm for `seconds`. Passing 0 stops it. */
  const start = useCallback((seconds: number) => {
    deadline.current = seconds > 0 ? Date.now() + seconds * 1000 : 0;
    setLeft(Math.max(0, Math.ceil(seconds)));
  }, []);

  useEffect(() => {
    if (left <= 0) return;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
    // Re-armed whenever the value crosses back above zero.
  }, [left > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  return { left, start, done: left <= 0 };
}

/** m:ss — the shape people read a countdown in. Always two digits of seconds. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

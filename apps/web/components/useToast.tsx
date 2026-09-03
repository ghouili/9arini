"use client";
import { useCallback, useRef, useState } from "react";

/* Lightweight toast: returns a JSX node to render + a showToast(msg) function.
   Replaces blocking alert() calls. Uses the .toast class from globals.css. */
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2800);
  }, []);

  const toast = msg ? (
    <div className="toast" role="status" aria-live="polite">{msg}</div>
  ) : null;

  return { toast, showToast };
}

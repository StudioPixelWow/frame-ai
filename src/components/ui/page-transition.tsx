"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, ReactNode } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   PageTransition — CINEMATIC page transitions with blur + scale + fade
   ═══════════════════════════════════════════════════════════════════════════ */

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [key, setKey] = useState(pathname);
  const [phase, setPhase] = useState<"enter" | "exit" | "idle">("enter");

  useEffect(() => {
    if (pathname !== key) {
      // Exit phase
      setPhase("exit");
      const t = setTimeout(() => {
        setKey(pathname);
        setPhase("enter");
        // After enter animation, go idle
        const t2 = setTimeout(() => setPhase("idle"), 600);
        return () => clearTimeout(t2);
      }, 120);
      return () => clearTimeout(t);
    }
  }, [pathname, key]);

  const exitStyle: React.CSSProperties =
    phase === "exit"
      ? {
          opacity: 0,
          transform: "translateY(-12px) scale(0.99)",
          filter: "blur(3px)",
          transition: "all 120ms ease-in",
        }
      : {};

  return (
    <div
      className={phase === "enter" ? "ux-page-transition" : ""}
      style={{
        ...exitStyle,
        willChange: phase !== "idle" ? "opacity, transform, filter" : "auto",
      }}
    >
      {children}
    </div>
  );
}

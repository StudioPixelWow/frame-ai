"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, ReactNode } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   PageTransition — fade-in + upward motion on route changes
   ════���═══════════════════════════════════════════���══════════════════════════ */

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [key, setKey] = useState(pathname);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (pathname !== key) {
      setVisible(false);
      // Short delay to let exit happen, then swap & enter
      const t = setTimeout(() => {
        setKey(pathname);
        setVisible(true);
      }, 80);
      return () => clearTimeout(t);
    }
  }, [pathname, key]);

  return (
    <div
      className={visible ? "ux-page-transition" : ""}
      style={{
        opacity: visible ? undefined : 0,
        transition: visible ? undefined : "opacity 80ms ease",
      }}
    >
      {children}
    </div>
  );
}

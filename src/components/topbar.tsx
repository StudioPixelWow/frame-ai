"use client";

import { ThemeToggle } from "./theme-toggle";

export function Topbar() {
  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-30">
      {/* Left: page context (filled by individual pages via portal or prop later) */}
      <div />

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <ThemeToggle />

        {/* User avatar placeholder */}
        <div className="w-8 h-8 rounded-full bg-surface-raised border border-border flex items-center justify-center text-xs font-medium text-foreground-muted">
          T
        </div>
      </div>
    </header>
  );
}

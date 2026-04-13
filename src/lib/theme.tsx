"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "dark" | "light" | "system";
type ResolvedTheme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolve(theme: Theme): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolvedTheme, setResolved] = useState<ResolvedTheme>("dark");

  // Load persisted preference on mount
  useEffect(() => {
    const stored = localStorage.getItem("frameai-theme") as Theme | null;
    const initial = stored ?? "dark";
    setThemeState(initial);
    setResolved(resolve(initial));
  }, []);

  // Apply resolved theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolvedTheme);
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  // Listen for system theme changes when mode is "system"
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => setResolved(getSystemTheme());
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    setResolved(resolve(t));
    localStorage.setItem("frameai-theme", t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

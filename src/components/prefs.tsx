"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Reader-side preference. Only the colour theme lives here: typeface, size
 * and width belong to each article and are chosen by the writer
 * (see lib/presentation.ts).
 */

export type ThemeId = "light" | "dark" | "system";

type Prefs = {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  resolvedTheme: "light" | "dark";
};

const KEY = "writ:prefs";
const PrefsContext = createContext<Prefs | null>(null);

function apply(theme: ThemeId) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("system");
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.theme === "light" || p.theme === "dark" || p.theme === "system") setThemeState(p.theme);
      }
    } catch {
      /* storage can be unavailable; defaults are fine */
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    apply(theme);
    try {
      localStorage.setItem(KEY, JSON.stringify({ theme }));
    } catch {
      /* ignore */
    }
  }, [theme]);

  const setTheme = useCallback((t: ThemeId) => setThemeState(t), []);

  const value = useMemo<Prefs>(
    () => ({
      theme,
      setTheme,
      resolvedTheme: theme === "system" ? (systemDark ? "dark" : "light") : theme,
    }),
    [theme, systemDark, setTheme]
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return ctx;
}

/** Runs before paint so the stored theme never flashes. */
export const PREFS_BOOTSTRAP = `
(function(){
  try {
    var p = JSON.parse(localStorage.getItem("${KEY}") || "{}");
    if (p.theme && p.theme !== "system") document.documentElement.setAttribute("data-theme", p.theme);
  } catch (e) {}
})();
`;

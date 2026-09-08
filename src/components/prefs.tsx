"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const FONTS = [
  { id: "lato", label: "Lato", stack: "var(--font-lato), sans-serif" },
  { id: "arial", label: "Arial", stack: "Arial, Helvetica, sans-serif" },
  { id: "system", label: "System", stack: "ui-sans-serif, -apple-system, system-ui, sans-serif" },
  { id: "serif", label: "Serif", stack: '"Iowan Old Style", Georgia, serif' },
] as const;

export type FontId = (typeof FONTS)[number]["id"];
export type ThemeId = "light" | "dark" | "system";

export const SIZES = [16, 18, 20, 22, 24] as const;
export type SizeId = (typeof SIZES)[number];

type Prefs = {
  theme: ThemeId;
  font: FontId;
  size: SizeId;
  setTheme: (t: ThemeId) => void;
  setFont: (f: FontId) => void;
  setSize: (s: SizeId) => void;
  resolvedTheme: "light" | "dark";
};

const KEY = "writ:prefs";
const PrefsContext = createContext<Prefs | null>(null);

function apply(theme: ThemeId, font: FontId, size: SizeId) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  root.setAttribute("data-font", font);
  root.style.setProperty("--reading-size", `${size / 16}rem`);
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("system");
  const [font, setFontState] = useState<FontId>("lato");
  const [size, setSizeState] = useState<SizeId>(18);
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.theme) setThemeState(p.theme);
        if (p.font) setFontState(p.font);
        if (p.size) setSizeState(p.size);
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
    apply(theme, font, size);
    try {
      localStorage.setItem(KEY, JSON.stringify({ theme, font, size }));
    } catch {
      /* ignore */
    }
  }, [theme, font, size]);

  const setTheme = useCallback((t: ThemeId) => setThemeState(t), []);
  const setFont = useCallback((f: FontId) => setFontState(f), []);
  const setSize = useCallback((s: SizeId) => setSizeState(s), []);

  const value = useMemo<Prefs>(
    () => ({
      theme,
      font,
      size,
      setTheme,
      setFont,
      setSize,
      resolvedTheme: theme === "system" ? (systemDark ? "dark" : "light") : theme,
    }),
    [theme, font, size, systemDark, setTheme, setFont, setSize]
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return ctx;
}

/** Runs before paint so the stored theme/font never flashes. */
export const PREFS_BOOTSTRAP = `
(function(){
  try {
    var p = JSON.parse(localStorage.getItem("${KEY}") || "{}");
    var r = document.documentElement;
    if (p.theme && p.theme !== "system") r.setAttribute("data-theme", p.theme);
    r.setAttribute("data-font", p.font || "lato");
    r.style.setProperty("--reading-size", ((p.size || 18) / 16) + "rem");
  } catch (e) {}
})();
`;

"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefs, type ThemeId } from "./prefs";

const THEMES: { id: ThemeId; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "Auto" },
];

export default function ReaderSettings() {
  const { theme, setTheme } = usePrefs();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus(); // never strand the keyboard user inside a closed popover
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Theme"
        className={[
          "hit flex h-9 w-9 items-center justify-center rounded-full",
          "transition-[color,background-color,transform] duration-150 ease-snap active:scale-[0.96]",
          open ? "bg-rule-soft text-ink" : "text-ink-soft hover:bg-rule-soft hover:text-ink",
        ].join(" ")}
      >
        <span className="text-[15px] font-semibold leading-none tracking-tight">Aa</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Theme"
          /* radius is concentric: 8px chips + 12px padding = 20px shell */
          className="pop absolute right-0 z-50 mt-2 w-[13.5rem] origin-top-right rounded-[20px] border border-rule bg-raised p-3 shadow-[var(--shadow)]"
        >
          <Section label="Theme">
            <div className="grid grid-cols-3 gap-1">
              {THEMES.map((t) => (
                <Chip key={t.id} active={theme === t.id} onClick={() => setTheme(t.id)}>
                  {t.label}
                </Chip>
              ))}
            </div>
          </Section>

        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-faint">{label}</div>
      {children}
    </div>
  );
}

function Chip({
  active,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...rest}
      className={[
        "h-8 rounded-lg px-2 text-[13px]",
        "transition-[color,background-color,transform] duration-150 ease-snap active:scale-[0.96]",
        "disabled:cursor-not-allowed disabled:opacity-35 disabled:active:scale-100",
        active ? "bg-ink text-paper" : "bg-rule-soft text-ink-soft hover:text-ink",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

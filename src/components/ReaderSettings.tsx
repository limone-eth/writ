"use client";

import { useEffect, useRef, useState } from "react";
import { FONTS, SIZES, usePrefs, type ThemeId } from "./prefs";

const THEMES: { id: ThemeId; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "Auto" },
];

export default function ReaderSettings() {
  const { theme, setTheme, font, setFont, size, setSize } = usePrefs();
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

  const sizeIndex = SIZES.indexOf(size);

  return (
    <div ref={wrap} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Reading settings"
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
          aria-label="Reading settings"
          /* radius is concentric: 8px chips + 12px padding = 20px shell */
          className="pop absolute right-0 z-50 mt-2 w-[17.5rem] origin-top-right rounded-[20px] border border-rule bg-raised p-3 shadow-[var(--shadow)]"
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

          <Section label="Typeface">
            <div className="grid grid-cols-2 gap-1">
              {FONTS.map((f) => (
                <Chip key={f.id} active={font === f.id} onClick={() => setFont(f.id)} style={{ fontFamily: f.stack }}>
                  {f.label}
                </Chip>
              ))}
            </div>
          </Section>

          <Section label="Size">
            <div className="flex items-center gap-1">
              <Chip
                active={false}
                disabled={sizeIndex <= 0}
                onClick={() => setSize(SIZES[Math.max(0, sizeIndex - 1)])}
                aria-label="Decrease text size"
              >
                <span className="text-xs">A</span>
              </Chip>
              <div className="h-8 flex-1 rounded-lg bg-rule-soft text-center text-[13px] leading-8 text-ink-soft tabular">
                {size}px
              </div>
              <Chip
                active={false}
                disabled={sizeIndex >= SIZES.length - 1}
                onClick={() => setSize(SIZES[Math.min(SIZES.length - 1, sizeIndex + 1)])}
                aria-label="Increase text size"
              >
                <span className="text-base">A</span>
              </Chip>
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

/**
 * How an article is set: typeface, size and measure. These are chosen by the
 * writer, stored with the post, and applied identically in the editor and on
 * the published page. Kept free of "use client" so server code can validate.
 */

export const FONTS = [
  { id: "lato", label: "Lato", stack: "var(--font-lato), ui-sans-serif, system-ui, sans-serif" },
  { id: "arial", label: "Arial", stack: 'Arial, "Helvetica Neue", Helvetica, sans-serif' },
  {
    id: "system",
    label: "System",
    stack: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  {
    id: "serif",
    label: "Serif",
    stack: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Times New Roman", serif',
  },
] as const;
export type FontId = (typeof FONTS)[number]["id"];

export const SIZES = [16, 18, 20, 22, 24] as const;
export type SizeId = (typeof SIZES)[number];

export const WIDTHS = [
  { id: "narrow", label: "Narrow", rem: 35 },
  { id: "medium", label: "Medium", rem: 42 },
  { id: "wide", label: "Wide", rem: 50 },
] as const;
export type WidthId = (typeof WIDTHS)[number]["id"];

export type Presentation = { font: FontId; size: SizeId; width: WidthId };

export const DEFAULT_PRESENTATION: Presentation = { font: "lato", size: 18, width: "narrow" };

/** Coerce untrusted values (DB rows, client input) to a valid presentation. */
export function normalizePresentation(input: Partial<Record<keyof Presentation, unknown>>): Presentation {
  const font = FONTS.find((f) => f.id === input.font)?.id ?? DEFAULT_PRESENTATION.font;
  const size = SIZES.find((s) => s === Number(input.size)) ?? DEFAULT_PRESENTATION.size;
  const width = WIDTHS.find((w) => w.id === input.width)?.id ?? DEFAULT_PRESENTATION.width;
  return { font, size, width };
}

/** CSS custom properties that make .prose, .font-reading and --measure follow the post. */
export function presentationVars(p: Presentation): React.CSSProperties {
  return {
    "--font-reading": FONTS.find((f) => f.id === p.font)!.stack,
    "--reading-size": `${p.size / 16}rem`,
    "--measure": `${WIDTHS.find((w) => w.id === p.width)!.rem}rem`,
  } as React.CSSProperties;
}

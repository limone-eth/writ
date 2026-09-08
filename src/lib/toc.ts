import { slugify } from "./slug";

export type TocItem = { id: string; text: string; level: 1 | 2 | 3 };

/** Plain text of a heading line with inline Markdown stripped. */
export function headingText(raw: string): string {
  return raw
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+#+\s*$/, "")
    .trim();
}

/** Hands out unique ids for headings, in document order. */
export function makeIdFactory() {
  const seen = new Map<string, number>();
  return (text: string): string => {
    const base = slugify(text);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}-${n + 1}`;
  };
}

/**
 * Headings (levels 1-3) of a Markdown document, in order, with the same ids
 * the rendered page gives them. Fenced code is skipped; a heading inside a
 * quote still counts.
 */
export function headingsOf(markdown: string): TocItem[] {
  const nextId = makeIdFactory();
  const items: TocItem[] = [];
  let inFence = false;
  for (const line of markdown.split("\n")) {
    const stripped = line.replace(/^(\s{0,3}>\s?)+/, "");
    if (/^\s{0,3}(```|~~~)/.test(stripped)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^\s{0,3}(#{1,3})\s+(.+?)\s*$/.exec(stripped);
    if (!m) continue;
    const text = headingText(m[2]);
    if (!text) continue;
    items.push({ id: nextId(text), text, level: m[1].length as 1 | 2 | 3 });
  }
  return items;
}

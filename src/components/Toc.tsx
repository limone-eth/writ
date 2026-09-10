"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TocItem } from "@/lib/toc";

/** Where, in page pixels, a heading is considered "current". */
const READ_LINE = 96;

/**
 * Article outline. The highlighted entry is the section under the reading
 * line; the thin marker slides continuously between entries as the reader
 * moves through a section, so it shows position, not just which section.
 *
 * Entries with sub-entries can be folded. A folded section stays highlighted
 * while the reader is anywhere inside it. The list scrolls on its own when
 * it is taller than the space it has, and keeps the current entry in view.
 */
export default function Toc({
  items,
  elementFor,
  linkable = true,
  maxHeight = "calc(100dvh - 6rem)",
}: {
  items: TocItem[];
  /** How to find a heading's element. Defaults to its id. */
  elementFor?: (item: TocItem, index: number) => HTMLElement | null;
  /** Whether clicks should also put the heading's id in the URL. */
  linkable?: boolean;
  /** Room the outline may take before it scrolls internally. */
  maxHeight?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  const [markerTop, setMarkerTop] = useState<number | null>(null);
  const [folded, setFolded] = useState<Set<string>>(() => new Set());

  // Index of the nearest preceding entry with a shallower level, or -1.
  const parents = useMemo(
    () =>
      items.map((it, i) => {
        for (let k = i - 1; k >= 0; k--) if (items[k].level < it.level) return k;
        return -1;
      }),
    [items],
  );
  const hasChildren = (i: number) =>
    i + 1 < items.length && items[i + 1].level > items[i].level;

  // An entry is shown unless one of its ancestors is folded.
  const shown = useMemo(
    () =>
      items.map((_, i) => {
        for (let p = parents[i]; p >= 0; p = parents[p])
          if (folded.has(items[p].id)) return false;
        return true;
      }),
    [items, parents, folded],
  );

  useEffect(() => {
    if (items.length === 0) return;
    let frame = 0;
    let tops: number[] = [];
    let lastShown = -1;

    const find = (it: TocItem, i: number) =>
      elementFor ? elementFor(it, i) : document.getElementById(it.id);

    const measure = () => {
      tops = items.map((it, i) => {
        const el = find(it, i);
        return el
          ? el.getBoundingClientRect().top + window.scrollY
          : Number.POSITIVE_INFINITY;
      });
    };

    // The shown entry standing in for index i: itself, or its nearest
    // shown ancestor when it sits inside a folded section.
    const representative = (i: number) => {
      while (i >= 0 && !shown[i]) i = parents[i];
      return i;
    };
    const nextShown = (i: number) => {
      let n = i + 1;
      while (n < items.length && !shown[n]) n++;
      return n < items.length ? n : -1;
    };
    const linkAt = (i: number) =>
      list.current?.querySelector<HTMLElement>(`a[data-index="${i}"]`) ?? null;

    const keepInView = (el: HTMLElement) => {
      const s = scroller.current;
      if (!s) return;
      const r = el.getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      const pad = 12;
      let delta = 0;
      if (r.top < sr.top + pad) delta = r.top - sr.top - pad;
      else if (r.bottom > sr.bottom - pad) delta = r.bottom - sr.bottom + pad;
      if (delta) s.scrollBy({ top: delta, behavior: "smooth" });
    };

    const update = () => {
      frame = 0;
      const y = window.scrollY + READ_LINE;
      let i = 0;
      for (let k = 0; k < tops.length; k++) if (tops[k] <= y) i = k;
      // A short final section can never reach the reading line; once the
      // page is scrolled to the end, the reader is in it.
      const atEnd =
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 2;
      if (atEnd) i = tops.length - 1;

      const vi = representative(i);
      const ni = nextShown(vi);
      const cur = linkAt(vi);
      if (!cur) return;
      // Progress through the current (shown) section, clamped, maps the
      // marker from this entry towards the next shown one. A folded section
      // counts as one long section.
      const start = tops[vi];
      const end =
        ni >= 0
          ? tops[ni]
          : document.documentElement.scrollHeight -
            window.innerHeight +
            READ_LINE;
      const t =
        end > start ? Math.min(1, Math.max(0, (y - start) / (end - start))) : 0;
      const next = ni >= 0 ? linkAt(ni) : null;
      const from = cur.offsetTop;
      const to = next ? next.offsetTop : cur.offsetTop + cur.offsetHeight - 14;
      setActive(vi);
      setMarkerTop(from + (to - from) * t);
      if (vi !== lastShown) {
        lastShown = vi;
        keepInView(cur);
      }
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      onScroll();
    };

    measure();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    // Fonts and images shift heading positions after first paint.
    const ro = new ResizeObserver(onResize);
    ro.observe(document.body);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      ro.disconnect();
    };
  }, [items, elementFor, parents, shown]);

  const go = (
    e: React.MouseEvent<HTMLAnchorElement>,
    it: TocItem,
    i: number,
  ) => {
    const el = elementFor ? elementFor(it, i) : document.getElementById(it.id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    if (linkable) history.replaceState(null, "", `#${it.id}`);
  };

  const toggle = (id: string) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Indent relative to the shallowest level present, so a post that only
  // uses H2/H3 does not start indented.
  const base = Math.min(...items.map((it) => it.level));
  const indent = ["pl-4", "pl-7", "pl-10"];

  return (
    <nav aria-label="Contents" className="toc flex flex-col" style={{ maxHeight }}>
      <div className="mb-3 shrink-0 text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-faint">
        Contents
      </div>
      <div ref={scroller} className="toc-scroll min-h-0 overflow-y-auto">
        <div className="relative">
          <span
            aria-hidden="true"
            className="toc-marker"
            style={
              markerTop === null
                ? { opacity: 0 }
                : { transform: `translateY(${markerTop}px)` }
            }
          />
          <ol ref={list} className="border-l border-rule-soft">
            {items.map((it, i) => {
              if (!shown[i]) return null;
              const foldable = hasChildren(i);
              const isFolded = folded.has(it.id);
              return (
                <li key={it.id} className="relative">
                  <a
                    href={`#${it.id}`}
                    data-index={i}
                    onClick={(e) => go(e, it, i)}
                    aria-current={i === active ? "location" : undefined}
                    className={[
                      "line-clamp-2 block py-[5px] text-[13px] leading-snug transition-colors duration-150",
                      foldable ? "pr-6" : "pr-2",
                      indent[it.level - base],
                      it.level === base ? "font-medium" : "",
                      i === active
                        ? "text-ink"
                        : "text-ink-faint hover:text-ink-soft",
                    ].join(" ")}
                  >
                    {it.text}
                  </a>
                  {foldable && (
                    <button
                      type="button"
                      onClick={() => toggle(it.id)}
                      aria-expanded={!isFolded}
                      aria-label={isFolded ? "Expand section" : "Collapse section"}
                      className="toc-fold absolute right-0 top-[3px] flex h-5 w-5 items-center justify-center rounded text-ink-faint transition-colors hover:text-ink"
                      data-folded={isFolded}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M2.5 3.5 5 6l2.5-2.5" />
                      </svg>
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </nav>
  );
}

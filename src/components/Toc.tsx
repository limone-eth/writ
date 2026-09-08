"use client";

import { useEffect, useRef, useState } from "react";
import type { TocItem } from "@/lib/toc";

/** Where, in page pixels, a heading is considered "current". */
const READ_LINE = 96;

/**
 * Article outline. The highlighted entry is the section under the reading
 * line; the thin marker slides continuously between entries as the reader
 * moves through a section, so it shows position, not just which section.
 */
export default function Toc({
  items,
  elementFor,
  linkable = true,
}: {
  items: TocItem[];
  /** How to find a heading's element. Defaults to its id. */
  elementFor?: (item: TocItem, index: number) => HTMLElement | null;
  /** Whether clicks should also put the heading's id in the URL. */
  linkable?: boolean;
}) {
  const list = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  const [markerTop, setMarkerTop] = useState<number | null>(null);

  useEffect(() => {
    if (items.length === 0) return;
    let frame = 0;
    let tops: number[] = [];

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
      const links = list.current?.querySelectorAll<HTMLElement>("a") ?? [];
      const cur = links[i];
      if (!cur) return;
      // Progress through the current section, clamped, maps the marker from
      // this entry towards the next one.
      const start = tops[i];
      const end =
        i + 1 < tops.length
          ? tops[i + 1]
          : document.documentElement.scrollHeight -
            window.innerHeight +
            READ_LINE;
      const t =
        end > start ? Math.min(1, Math.max(0, (y - start) / (end - start))) : 0;
      const next = links[i + 1];
      const from = cur.offsetTop;
      const to = next ? next.offsetTop : cur.offsetTop + cur.offsetHeight - 14;
      setActive(i);
      setMarkerTop(from + (to - from) * t);
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
  }, [items, elementFor]);

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

  // Indent relative to the shallowest level present, so a post that only
  // uses H2/H3 does not start indented.
  const base = Math.min(...items.map((it) => it.level));
  const indent = ["pl-4", "pl-7", "pl-10"];

  return (
    <nav aria-label="Contents" className="toc">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-faint">
        Contents
      </div>
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
          {items.map((it, i) => (
            <li key={it.id}>
              <a
                href={`#${it.id}`}
                onClick={(e) => go(e, it, i)}
                aria-current={i === active ? "location" : undefined}
                className={[
                  "line-clamp-2 block py-[5px] pr-2 text-[13px] leading-snug transition-colors duration-150",
                  indent[it.level - base],
                  it.level === base ? "font-medium" : "",
                  i === active
                    ? "text-ink"
                    : "text-ink-faint hover:text-ink-soft",
                ].join(" ")}
              >
                {it.text}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

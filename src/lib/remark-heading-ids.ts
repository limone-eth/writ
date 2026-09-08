import type { Root, Heading } from "mdast";
import { headingText, makeIdFactory } from "./toc";

/**
 * Gives h1-h3 an id derived from their text, allocated in document order
 * with the same rules as headingsOf(), so the table of contents and the
 * rendered headings agree.
 */
export default function remarkHeadingIds() {
  return (tree: Root) => {
    const nextId = makeIdFactory();
    walk(tree, (node) => {
      if (node.type !== "heading") return;
      const h = node as Heading;
      if (h.depth > 3) return;
      const text = headingText(plain(h));
      if (!text) return;
      h.data = { ...h.data, hProperties: { ...h.data?.hProperties, id: nextId(text) } };
    });
  };
}

function plain(node: { value?: string; children?: unknown[] }): string {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map((c) => plain(c as { value?: string; children?: unknown[] })).join("");
}

function walk(node: { type: string; children?: unknown[] }, fn: (n: { type: string }) => void) {
  fn(node);
  node.children?.forEach((c) => walk(c as { type: string; children?: unknown[] }, fn));
}

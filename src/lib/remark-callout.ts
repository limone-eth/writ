import type { Root, Blockquote, Paragraph, Text } from "mdast";

const MARKER = "[!NOTE]";

/**
 * Turns a GitHub-style alert (`> [!NOTE]`) into a blockquote carrying
 * `data-kind="card"` so the reader can style it as a boxed callout. Only the
 * marker is touched; everything else in the quote renders as usual.
 */
export default function remarkCallout() {
  return (tree: Root) => {
    walk(tree, (node) => {
      if (node.type !== "blockquote") return;
      const bq = node as Blockquote;
      const first = bq.children[0];
      if (first?.type !== "paragraph") return;
      const text = (first as Paragraph).children[0];
      if (text?.type !== "text" || !(text as Text).value.startsWith(MARKER)) return;

      (text as Text).value = (text as Text).value.slice(MARKER.length).replace(/^\s+/, "");
      if (!(text as Text).value && (first as Paragraph).children.length === 1) bq.children.shift();
      bq.data = { ...bq.data, hProperties: { ...bq.data?.hProperties, "data-kind": "card" } };
    });
  };
}

function walk(node: { type: string; children?: unknown[] }, fn: (n: { type: string }) => void) {
  fn(node);
  node.children?.forEach((c) => walk(c as { type: string; children?: unknown[] }, fn));
}

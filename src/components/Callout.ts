import Blockquote from "@tiptap/extension-blockquote";
import { wrappingInputRule } from "@tiptap/core";
import type { MarkdownSerializerState } from "prosemirror-markdown";
import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * A blockquote with two looks: the plain hanging quote, and a "card" that
 * sits in a boxed, raised panel. The card round-trips through Markdown as a
 * GitHub-style alert (`> [!NOTE]`), so the stored text stays portable.
 */
export const CALLOUT_MARKER = "[!NOTE]";

export type QuoteKind = "quote" | "card";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      /** Wrap in / switch to / lift out of a quote of the given kind. */
      toggleQuote: (kind: QuoteKind) => ReturnType;
    };
  }
}

export const Callout = Blockquote.extend({
  addAttributes() {
    return {
      kind: {
        default: "quote",
        parseHTML: (el) => (el.getAttribute("data-kind") === "card" ? "card" : "quote"),
        renderHTML: (attrs) => (attrs.kind === "card" ? { "data-kind": "card" } : {}),
      },
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      toggleQuote:
        (kind) =>
        ({ editor, commands }) => {
          if (editor.isActive(this.name, { kind })) return commands.lift(this.name);
          if (editor.isActive(this.name)) return commands.updateAttributes(this.name, { kind });
          return commands.wrapIn(this.name, { kind });
        },
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: /^\s*>\s$/,
        type: this.type,
        // `> ` right after a card must start a fresh quote, not merge into it.
        joinPredicate: (_match, node) => node.attrs.kind !== "card",
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      // Enter on a trailing empty line steps out of the quote, the way it
      // does in a list; otherwise there is no keyboard exit at document end.
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.depth < 2) return false;
        const block = $from.parent;
        if (block.type.name !== "paragraph" || block.content.size > 0) return false;
        const quote = $from.node(-1);
        if (quote.type.name !== this.name) return false;
        if ($from.index(-1) !== quote.childCount - 1) return false;
        return editor.commands.lift(this.name);
      },
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializerState, node: PMNode) {
          state.wrapBlock("> ", null, node, () => {
            if (node.attrs.kind === "card") state.write(`${CALLOUT_MARKER}\n`);
            state.renderContent(node);
          });
        },
        parse: {
          // markdown-it has already turned the alert into a plain blockquote
          // whose first paragraph starts with the marker; move that into an
          // attribute so parseHTML above can pick it up.
          updateDOM(element: HTMLElement) {
            element.querySelectorAll("blockquote").forEach((bq) => {
              const first = bq.firstElementChild;
              const text = first?.tagName === "P" ? first.firstChild : null;
              if (!text || text.nodeType !== Node.TEXT_NODE) return;
              const value = text.textContent ?? "";
              if (!value.startsWith(CALLOUT_MARKER)) return;
              text.textContent = value.slice(CALLOUT_MARKER.length).replace(/^\s+/, "");
              if (!first!.textContent?.trim() && first!.childNodes.length <= 1) first!.remove();
              bq.setAttribute("data-kind", "card");
            });
          },
        },
      },
    };
  },
});

import Image from "@tiptap/extension-image";
import { mergeAttributes } from "@tiptap/core";
import type { MarkdownSerializerState } from "prosemirror-markdown";
import type { Node as PMNode } from "@tiptap/pm/model";

/* Just enough of markdown-it to reach its image renderer; tiptap-markdown is
   plain JavaScript and ships no types of its own. */
type Token = {
  type: string;
  content: string;
  children: Token[] | null;
  attrs: [string, string][] | null;
  attrIndex(name: string): number;
};
type MarkdownIt = {
  renderer: {
    rules: Record<
      string,
      (
        tokens: Token[],
        idx: number,
        options: unknown,
        env: unknown,
        self: { renderToken(tokens: Token[], idx: number, options: unknown): string },
      ) => string
    >;
  };
};

/** The text of an inline run, markup stripped but escaped characters kept. */
function plainText(tokens: Token[]): string {
  let out = "";
  for (const token of tokens) {
    switch (token.type) {
      case "text":
      case "text_special":
      case "html_inline":
      case "html_block":
        out += token.content;
        break;
      case "image":
        out += plainText(token.children ?? []);
        break;
      case "softbreak":
      case "hardbreak":
        out += "\n";
        break;
    }
  }
  return out;
}

/**
 * A picture on a line of its own, with its description printed underneath it.
 * One piece of text does both jobs: it is the Markdown alt text, so the stored
 * article stays plain `![description](url)`, and it is the caption a reader
 * sees. Leave it empty and the image simply has no caption.
 *
 * tiptap-markdown only ships an inline serializer for images, which would run
 * the next block onto the same line, so this one closes the block. Parsing
 * back in is markdown-it's job: it renders an `<img>` that parseHTML picks up.
 */
export const ArticleImage = Image.extend({
  renderHTML({ HTMLAttributes }) {
    const attrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes);
    const caption = String(attrs.alt ?? "").trim();
    if (!caption) return ["img", attrs];
    // The caption stays out of the editable flow: it is an attribute of the
    // image, edited in the bottom bar, not a paragraph you can type into.
    return [
      "figure",
      {},
      ["img", attrs],
      ["figcaption", { contenteditable: "false" }, caption],
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializerState, node: PMNode) {
          const src = String(node.attrs.src ?? "").replace(/[()]/g, "\\$&");
          const title = node.attrs.title
            ? ` "${String(node.attrs.title).replace(/"/g, '\\"')}"`
            : "";
          state.write(`![${state.esc(String(node.attrs.alt ?? ""))}](${src}${title})`);
          state.closeBlock(node);
        },
        parse: {
          setup(md: MarkdownIt) {
            // markdown-it builds the alt attribute by walking the inline
            // tokens, and skips escapes while it does — so a caption written
            // `\[like this\]` comes back with the brackets gone. Same walk,
            // keeping the characters that were escaped.
            md.renderer.rules.image = (tokens, idx, options, env, self) => {
              const token = tokens[idx];
              const alt = token.attrIndex("alt");
              if (alt >= 0 && token.attrs) token.attrs[alt][1] = plainText(token.children ?? []);
              return self.renderToken(tokens, idx, options);
            };
          },
        },
      },
    };
  },
});

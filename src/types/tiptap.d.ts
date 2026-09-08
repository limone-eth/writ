import "@tiptap/core";

// tiptap-markdown attaches its serializer to editor.storage but ships no
// declaration for it.
declare module "@tiptap/core" {
  interface Storage {
    markdown: {
      getMarkdown: () => string;
    };
  }
}

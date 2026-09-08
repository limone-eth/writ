"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { EditorContent, useEditor, useEditorState, type Editor as TipTapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder, CharacterCount } from "@tiptap/extensions";
import { Markdown } from "tiptap-markdown";
import { deletePost, savePost, setPublished } from "@/lib/actions";
import { FONTS, SIZES, usePrefs } from "./prefs";
import type { Post } from "@/lib/db";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const AUTOSAVE_MS = 900;
const CHROME_IDLE_MS = 2400;

export default function Editor({ post }: { post: Post }) {
  const { font, setFont, size, setSize, theme, setTheme, resolvedTheme } = usePrefs();

  const [title, setTitle] = useState(post.title);
  const [subtitle, setSubtitle] = useState(post.subtitle);
  const [slug, setSlug] = useState(post.slug);
  const [published, setPublishedLocal] = useState(post.published);
  const [state, setState] = useState<SaveState>("idle");
  const [chromeHidden, setChromeHidden] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [words, setWords] = useState(0);
  const [pending, startTransition] = useTransition();

  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<TipTapEditor | null>(null);
  const linkInput = useRef<HTMLInputElement>(null);
  const subtitleInput = useRef<HTMLTextAreaElement>(null);

  const titleRef = useRef(title);
  const subtitleRef = useRef(subtitle);
  titleRef.current = title;
  subtitleRef.current = subtitle;

  /* ------------------------------------------------------------- saving */

  const flush = useCallback(async () => {
    if (!dirty.current) return;
    dirty.current = false;
    setState("saving");
    const res = await savePost({
      id: post.id,
      title: titleRef.current,
      subtitle: subtitleRef.current,
      content: editorRef.current?.storage.markdown.getMarkdown() ?? "",
    });
    if (res.ok) {
      setSlug(res.slug);
      setState(dirty.current ? "dirty" : "saved");
    } else {
      dirty.current = true;
      setState("error");
    }
  }, [post.id]);

  const touch = useCallback(() => {
    dirty.current = true;
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
  }, [flush]);

  /* -------------------------------------------------------- the editor */

  const editor = useEditor({
    immediatelyRender: false, // required under SSR
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
        linkify: true,
        breaks: false,
      }),
      Placeholder.configure({ placeholder: "Start writing. Markdown becomes formatting as you type." }),
      CharacterCount,
    ],
    content: post.content,
    editorProps: {
      attributes: {
        class: "prose writing-body",
        "aria-label": "Article body",
        spellcheck: "true",
      },
    },
    onCreate: ({ editor: e }) => setWords(e.storage.characterCount.words()),
    onUpdate: ({ editor: e }) => {
      setWords(e.storage.characterCount.words());
      touch();
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  const live = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            h2: e.isActive("heading", { level: 2 }),
            quote: e.isActive("blockquote"),
            list: e.isActive("bulletList"),
            code: e.isActive("code"),
            link: e.isActive("link"),
          }
        : null,
  });

  /* ------------------------------------------------------- global keys */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        void flush();
      }
      // Escape is the keyboard-only way back to the faded controls.
      if (e.key === "Escape") {
        setLinkOpen(false);
        setChromeHidden(false);
      }
    };
    window.addEventListener("keydown", onKey);
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush]);

  /* ------------------------------------------------- fading the chrome */

  useEffect(() => {
    const wake = () => {
      setChromeHidden(false);
      if (idle.current) clearTimeout(idle.current);
      idle.current = setTimeout(() => setChromeHidden(true), CHROME_IDLE_MS);
    };
    window.addEventListener("mousemove", wake);
    window.addEventListener("touchstart", wake, { passive: true });
    return () => {
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("touchstart", wake);
      if (idle.current) clearTimeout(idle.current);
    };
  }, []);

  /* --------------------------------------------------------------- link */

  const openLink = () => {
    if (!editor) return;
    setLinkValue(editor.getAttributes("link").href ?? "");
    setLinkOpen(true);
    requestAnimationFrame(() => linkInput.current?.focus());
  };

  const applyLink = () => {
    if (!editor) return;
    const href = linkValue.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (href) chain.setLink({ href }).run();
    else chain.unsetLink().run();
    setLinkOpen(false);
  };

  /* --------------------------------------------------------- publishing */

  const togglePublish = () => {
    startTransition(async () => {
      if (timer.current) clearTimeout(timer.current);
      await flush();
      await setPublished(post.id, !published);
      setPublishedLocal(!published);
    });
  };

  const label: Record<SaveState, string> = {
    idle: published ? "Published" : "Draft",
    dirty: "Unsaved",
    saving: "Saving…",
    saved: "Saved",
    error: "Save failed — retrying on next edit",
  };

  const cmd = (fn: () => void) => () => {
    fn();
    editor?.chain().focus().run();
  };

  return (
    <div className="min-h-dvh pb-40">
      {/* top bar */}
      <div className="fade-chrome fixed inset-x-0 top-0 z-40 bg-paper/85 backdrop-blur-md" data-hidden={chromeHidden}>
        <div className="mx-auto flex h-14 max-w-[var(--measure)] items-center justify-between gap-3 px-5">
          <Link
            href="/admin"
            className="-ml-1.5 flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-[13px] text-ink-soft transition-colors duration-150 hover:text-ink"
          >
            <Chevron />
            Desk
          </Link>

          <div className="flex items-center gap-2">
            <span
              className={[
                "flex items-center gap-1.5 text-[12px] tabular",
                state === "error" ? "text-accent" : "text-ink-faint",
              ].join(" ")}
            >
              <span
                aria-hidden="true"
                className={[
                  "h-1.5 w-1.5 rounded-full transition-colors duration-200",
                  state === "dirty" || state === "saving"
                    ? "bg-ink-faint"
                    : state === "error"
                      ? "bg-accent"
                      : published
                        ? "bg-accent"
                        : "bg-rule",
                ].join(" ")}
              />
              {label[state]}
            </span>

            {published && (
              <Link
                href={`/p/${slug}`}
                className="rounded-full px-2.5 py-1.5 text-[13px] text-ink-soft transition-colors duration-150 hover:bg-rule-soft hover:text-ink"
              >
                View
              </Link>
            )}

            <button
              type="button"
              onClick={togglePublish}
              disabled={pending}
              className={[
                "h-8 rounded-full px-3.5 text-[13px] font-semibold transition-[transform,opacity] duration-150 ease-snap",
                "active:scale-[0.96] hover:opacity-90 disabled:opacity-50 disabled:active:scale-100",
                published ? "border border-rule text-ink-soft" : "bg-ink text-paper",
              ].join(" ")}
            >
              {pending ? (published ? "Unpublishing…" : "Publishing…") : published ? "Unpublish" : "Publish"}
            </button>
          </div>
        </div>
      </div>

      {/* writing surface */}
      <main className="mx-auto max-w-[var(--measure)] px-5 pt-24">
        <GrowingField
          value={title}
          onChange={(v) => {
            setTitle(v);
            touch();
          }}
          onEnter={() => subtitleInput.current?.focus()}
          placeholder="Title"
          aria-label="Title"
          className="w-full bg-transparent text-[30px] font-bold leading-[1.15] tracking-[-0.022em] outline-none placeholder:text-ink-faint sm:text-[38px]"
        />
        <GrowingField
          ref={subtitleInput}
          value={subtitle}
          onChange={(v) => {
            setSubtitle(v);
            touch();
          }}
          onEnter={() => editor?.commands.focus("start")}
          placeholder="Subtitle (optional)"
          aria-label="Subtitle"
          className="mt-3 w-full bg-transparent text-[17px] leading-relaxed text-ink-soft outline-none placeholder:text-ink-faint sm:text-[19px]"
        />

        <EditorContent editor={editor} className="mt-10" />
      </main>

      {/* bottom bar */}
      <div
        className="fade-chrome fixed inset-x-0 bottom-0 z-40 border-t border-rule-soft bg-paper/90 backdrop-blur-md"
        data-hidden={chromeHidden}
      >
        {/* Wider than the writing column on purpose: every control has to be
            reachable without scrolling the bar on a desktop screen. */}
        <div className="mx-auto max-w-[52rem] px-1.5 py-2">
          {linkOpen ? (
            <div className="flex items-center gap-2">
              <input
                ref={linkInput}
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyLink();
                  }
                }}
                placeholder="https://"
                aria-label="Link address"
                className="h-8 min-w-0 flex-1 rounded-lg border border-rule bg-paper px-2.5 text-[13px] outline-none placeholder:text-ink-faint focus:border-ink-faint"
              />
              <button
                type="button"
                onClick={applyLink}
                className="h-8 shrink-0 rounded-lg bg-ink px-3 text-[13px] font-semibold text-paper transition-transform duration-150 ease-snap active:scale-[0.96]"
              >
                {linkValue.trim() ? "Link" : "Remove"}
              </button>
              <button
                type="button"
                onClick={() => setLinkOpen(false)}
                className="h-8 shrink-0 rounded-lg px-2 text-[13px] text-ink-faint transition-colors duration-150 hover:text-ink"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 overflow-x-auto px-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Tool label="Bold" active={live?.bold} onClick={cmd(() => editor?.chain().focus().toggleBold().run())}>
                <span className="font-bold">B</span>
              </Tool>
              <Tool label="Italic" active={live?.italic} onClick={cmd(() => editor?.chain().focus().toggleItalic().run())}>
                <span className="italic">I</span>
              </Tool>
              <Tool label="Link" active={live?.link} onClick={openLink}>
                <LinkIcon />
              </Tool>
              <Tool
                label="Heading"
                active={live?.h2}
                onClick={cmd(() => editor?.chain().focus().toggleHeading({ level: 2 }).run())}
              >
                H
              </Tool>
              <Tool label="Quote" active={live?.quote} onClick={cmd(() => editor?.chain().focus().toggleBlockquote().run())}>
                <QuoteIcon />
              </Tool>
              <Tool label="List" active={live?.list} onClick={cmd(() => editor?.chain().focus().toggleBulletList().run())}>
                <ListIcon />
              </Tool>
              <Tool label="Code" active={live?.code} onClick={cmd(() => editor?.chain().focus().toggleCode().run())}>
                <span className="font-mono text-[12px]">{"</>"}</span>
              </Tool>

              <Divider />

              {FONTS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFont(f.id)}
                  aria-pressed={font === f.id}
                  style={{ fontFamily: f.stack }}
                  className={[
                    "h-8 shrink-0 rounded-lg px-2.5 text-[13px] transition-[color,background-color,transform] duration-150 ease-snap active:scale-[0.96]",
                    font === f.id ? "bg-ink text-paper" : "text-ink-faint hover:bg-rule-soft hover:text-ink",
                  ].join(" ")}
                >
                  {f.label}
                </button>
              ))}

              <Divider />

              <select
                value={size}
                onChange={(e) => setSize(Number(e.target.value) as (typeof SIZES)[number])}
                aria-label="Text size"
                className="h-8 shrink-0 rounded-lg bg-transparent px-1.5 text-[13px] text-ink-faint outline-none transition-colors duration-150 hover:text-ink"
              >
                {SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}px
                  </option>
                ))}
              </select>

              <Tool
                label={resolvedTheme === "dark" ? "Switch to light" : "Switch to dark"}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                <ThemeIcon dark={resolvedTheme === "dark"} />
              </Tool>

              <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
                <span className="text-[12px] text-ink-faint tabular">{words}w</span>
                {confirmDelete ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startTransition(() => void deletePost(post.id))}
                      className="h-8 rounded-lg px-2 text-[12px] font-semibold text-accent transition-transform duration-150 ease-snap hover:bg-rule-soft active:scale-[0.96]"
                    >
                      Delete for good
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="h-8 rounded-lg px-2 text-[12px] text-ink-faint transition-colors duration-150 hover:bg-rule-soft hover:text-ink"
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <Tool label="Delete post" onClick={() => setConfirmDelete(true)}>
                    <TrashIcon />
                  </Tool>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- pieces */

function Tool({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active ?? false}
      className={[
        "hit flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px]",
        "transition-[color,background-color,transform] duration-150 ease-snap active:scale-[0.96]",
        active ? "bg-ink text-paper" : "text-ink-faint hover:bg-rule-soft hover:text-ink",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-rule" aria-hidden="true" />;
}

function Chevron() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10 13a5 5 0 007.07 0l2-2a5 5 0 10-7.07-7.07L11 4.93M14 11a5 5 0 00-7.07 0l-2 2a5 5 0 107.07 7.07L13 19.07"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 7H5.5A1.5 1.5 0 004 8.5V12h5V7zm0 0v4c0 3.5-1.7 5.4-4 6M20 7h-3.5A1.5 1.5 0 0015 8.5V12h5V7zm0 0v4c0 3.5-1.7 5.4-4 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Both icons stay mounted and cross-fade, so the swap has an exit too. */
function ThemeIcon({ dark }: { dark: boolean }) {
  return (
    <span className="relative block h-[15px] w-[15px]">
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="absolute inset-0 transition-[opacity,transform,filter] duration-300 ease-snap"
        style={{ opacity: dark ? 1 : 0, transform: dark ? "none" : "scale(0.25)", filter: dark ? "none" : "blur(4px)" }}
      >
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="absolute inset-0 transition-[opacity,transform,filter] duration-300 ease-snap"
        style={{ opacity: dark ? 0 : 1, transform: dark ? "scale(0.25)" : "none", filter: dark ? "blur(4px)" : "none" }}
      >
        <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------ fields */

/**
 * Single-value text field that wraps and grows with its content, so a long
 * title reads the way it will on the published page instead of scrolling
 * off the right edge. Enter never inserts a newline; it hands focus on.
 */
const GrowingField = forwardRef<
  HTMLTextAreaElement,
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
    value: string;
    onChange: (value: string) => void;
    onEnter?: () => void;
  }
>(function GrowingField({ value, onChange, onEnter, className, style, ...rest }, ref) {
  const inner = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement);

  // Re-measure whenever the text or the reading font changes.
  const { font, size } = usePrefs();
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, font, size]);

  return (
    <textarea
      ref={inner}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[\r\n]+/g, " "))}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEnter?.();
        }
      }}
      className={["block resize-none overflow-hidden", className].join(" ")}
      style={{ fontFamily: "var(--font-reading)", ...style }}
      {...rest}
    />
  );
});

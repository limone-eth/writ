import "server-only";
import { complete } from "./openrouter";
import { ImportError, words, type Source } from "./source";

/**
 * Rough Markdown in, a readable article out. Long documents are cut at
 * headings into parts the model can rewrite in one pass, the parts run in
 * parallel, and the results are stitched back in order.
 */

export type Progress = { done: number; total: number };
export type Article = { title: string; subtitle: string; content: string; cost: number };

/** What /api/import streams back, one JSON object per line. */
export type ImportEvent =
  | { type: "status"; message: string }
  | ({ type: "progress" } & Progress)
  | { type: "done"; id: number }
  | { type: "error"; message: string };

// ~3-4k tokens a part: small enough to come back whole and quickly.
const PART_CHARS = 14_000;
const CONCURRENCY = 6;

const RULES = `Keep the writing:
- Keep every sentence of the document's own text, in order and word for word. Never summarize, shorten, paraphrase, reorder or translate.
- Keep abstracts, body text, figure and table captions, notes, acknowledgments, appendices and the reference list.

Remove what is not the document:
- Site navigation, menus, search boxes, sign-in prompts, cookie notices, share/cite/download widgets, "related articles", view and citation counts, ads, logos, and page UI text (font, size or background controls).
- Running headers and footers, page numbers and line numbers left behind by PDF extraction.
- On web pages, the figure gallery or pop-up copies of figures that follow the reference list repeat figures shown earlier: drop them.

Repair extraction damage:
- Join lines broken in the middle of a paragraph and rejoin words hyphenated across a line break.
- Keep a label such as "(a)" or "1)" on the same line as the text it introduces.
- Fix ligature and spacing artifacts, and restore paragraph breaks.

Structure, as Markdown:
- Sections are "## ", subsections "### ", deeper levels "#### ". Never use "# ". Keep section numbers ("2.1.") as written.
- In flat text, recognise headings from numbering, capitalisation or position.
- Lists stay lists. Tables become GFM pipe tables; when a table is too irregular for that, give its content as a list.
- Keep images that belong to the document as ![short description](url), with the caption as an italic paragraph right after. Drop icons, logos and avatars.
- Write simple math with Unicode (α, ≤, x²); put anything more complex in \`inline code\`.
- Citation markers such as [12] or (Smith, 2020) stay as plain text. Drop links that point elsewhere on the same page (citation, figure and footnote anchors) but keep their text. Keep links to outside resources.
- A reference or bibliography list becomes a numbered list, one reference per item.
- A text box, sidebar or highlighted aside becomes a blockquote whose first line is [!NOTE].

Output only the Markdown. No preamble, no comments, no code fence around it.`;

function partPrompt(index: number, total: number): string {
  const position =
    index === 0
      ? `This is the beginning of the document. Leave out its front matter, which is shown separately: the title, "by" lines, author names with their affiliation numbers, affiliations, emails, the journal citation or DOI line, received/revised/accepted/published dates and special-issue notices. Also leave out stray fragments of figure captions that sit apart from any figure. If the source labels an abstract, keep it under "## Abstract". Any other text before the first heading is the document's own and stays.`
      : `This part continues from the previous one. If it starts in the middle of a section or a paragraph, start straight with that text: do not add a heading or anything else of your own.`;
  return `You turn scraped or extracted text into clean Markdown for a reading app.

The input is part ${index + 1} of ${total} of a longer document. Your output will be joined with the other parts, so do not add a title, an introduction or a summary. ${position}

If this part holds no document content at all (only site chrome), output nothing.

${RULES}`;
}

const METADATA_PROMPT = `You read the beginning of a document and return JSON with three string fields:
- "title": the document's own title, exactly as written. Fix only ALL-CAPS casing.
- "byline": one short line with the authors (up to three names, then "et al.") and, when they are shown, the publication and year, joined with " · ". Example: "Michael Levin · Philosophies, 2026". Use "" if none are shown.
- "start": the first ten words of the document's own text, copied exactly: the abstract if there is one, otherwise the first paragraph after the title and author details. Never a heading, a menu or front matter.
Return only the JSON object.`;

const WHOLE_PDF_PROMPT = `You turn a PDF into clean Markdown for a reading app. Leave out the title, the author names, affiliations and dates at the very top: they are shown separately.

${RULES}`;

export async function convert(source: Source, onProgress: (p: Progress) => void): Promise<Article> {
  if (source.type === "pdf") return convertWholePdf(source, onProgress);

  const markdown = preclean(source.markdown, source.origin);
  const parts = split(markdown);
  const total = parts.length;
  let done = 0;
  let cost = 0;
  onProgress({ done, total });

  // Publisher pages can carry 30k characters of chrome before the abstract.
  const meta = metadata(markdown.slice(0, 40_000)).then((m) => {
    cost += m.cost;
    return m;
  });

  const outputs = await pool(parts, CONCURRENCY, async (part, i) => {
    const out = await rewrite(part, i, total);
    cost += out.cost;
    onProgress({ done: ++done, total });
    return out.text;
  });

  const { title, byline, start } = await meta;
  const content = finish(join(outputs), title, start);
  if (words(content) < 20) throw new ImportError("The model returned no article text. Try pasting the text instead.");
  return { title: title || "Untitled import", subtitle: byline, content, cost };
}

/** Rewrites one part; a part cut off by the output limit is halved and retried. */
async function rewrite(part: string, index: number, total: number): Promise<{ text: string; cost: number }> {
  const res = await complete({ system: partPrompt(index, total), user: part, maxTokens: 16_000 });
  if (!res.truncated || part.length < 2_000) return { text: unfence(res.text), cost: res.cost };
  const [a, b] = halve(part);
  const first = await rewrite(a, index, total);
  const second = await rewrite(b, Math.max(index, 1), total);
  return { text: join([first.text, second.text]), cost: res.cost + first.cost + second.cost };
}

async function convertWholePdf(
  source: Extract<Source, { type: "pdf" }>,
  onProgress: (p: Progress) => void,
): Promise<Article> {
  onProgress({ done: 0, total: 1 });
  const file = {
    type: "file" as const,
    file: {
      filename: source.filename,
      file_data: `data:application/pdf;base64,${Buffer.from(source.data).toString("base64")}`,
    },
  };
  const [meta, body] = await Promise.all([
    metadata([file, { type: "text", text: "Return the title and byline of this document." }]),
    complete({
      system: WHOLE_PDF_PROMPT,
      user: [file, { type: "text", text: "Convert this document." }],
      maxTokens: 64_000,
    }),
  ]);
  onProgress({ done: 1, total: 1 });
  let content = finish(unfence(body.text), meta.title, meta.start);
  if (body.truncated) {
    content += "\n\n> [!NOTE]\n> The import stops here: the document is longer than the model could write out in one pass.";
  }
  if (words(content) < 20) throw new ImportError("The model could not read any text in that PDF.");
  return { title: meta.title || "Untitled import", subtitle: meta.byline, content, cost: meta.cost + body.cost };
}

async function metadata(user: Parameters<typeof complete>[0]["user"]) {
  try {
    const res = await complete({ system: METADATA_PROMPT, user, maxTokens: 400, json: true });
    const json = JSON.parse(unfence(res.text).match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    return {
      title: String(json.title ?? "").replace(/\s+/g, " ").trim(),
      byline: String(json.byline ?? "").replace(/\s+/g, " ").trim(),
      start: String(json.start ?? ""),
      cost: res.cost,
    };
  } catch (e) {
    // A missing title is not worth losing the article over; a missing key is.
    if (e instanceof ImportError && /OPENROUTER_API_KEY/.test(e.message)) throw e;
    return { title: "", byline: "", start: "", cost: 0 };
  }
}

/* ------------------------------------------------------------ text work */

/** Cheap deterministic cleanup, so the model spends tokens on the hard parts. */
export function preclean(markdown: string, origin: string): string {
  let md = markdown.replace(/\r\n?/g, "\n");
  const page = origin.replace(/#.*$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Links into the same page (citations, figures) keep only their text:
  // [[12](https://site/article#B12)] becomes [12].
  const samePage = new RegExp(`\\[([^\\[\\]]*)\\]\\((?:${page || "(?!)"})?#[^)\\s]*\\)`, "g");
  md = md.replace(samePage, "$1");
  md = md.replace(/\[\]\([^)]*\)/g, ""); // empty links
  md = md.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return md.trim();
}

/** Blocks separated by blank lines, never breaking inside a fenced code block. */
function blocks(md: string): string[] {
  const out: string[] = [];
  let buf: string[] = [];
  let fence = false;
  for (const line of md.split("\n")) {
    if (/^\s{0,3}(```|~~~)/.test(line)) fence = !fence;
    if (!fence && line.trim() === "") {
      if (buf.length) out.push(buf.join("\n"));
      buf = [];
    } else {
      buf.push(line);
    }
  }
  if (buf.length) out.push(buf.join("\n"));
  return out.flatMap((b) => (b.length > PART_CHARS ? hardSplit(b) : [b]));
}

/** An oversized block (a PDF page with no blank lines) split by lines, then by length. */
function hardSplit(block: string): string[] {
  const pieces: string[] = [];
  let cur = "";
  for (const line of block.split("\n")) {
    if (cur && cur.length + line.length + 1 > PART_CHARS) {
      pieces.push(cur);
      cur = "";
    }
    if (line.length > PART_CHARS) {
      for (let i = 0; i < line.length; i += PART_CHARS) pieces.push(line.slice(i, i + PART_CHARS));
    } else {
      cur = cur ? `${cur}\n${line}` : line;
    }
  }
  if (cur) pieces.push(cur);
  return pieces;
}

const isHeading = (b: string) => /^\s{0,3}#{1,6}\s/.test(b);

/** Packs blocks into parts, preferring to start a new part at a heading. */
export function split(md: string): string[] {
  const parts: string[] = [];
  let cur: string[] = [];
  let size = 0;
  for (const b of blocks(md)) {
    const full = size + b.length > PART_CHARS;
    const niceBreak = isHeading(b) && size > PART_CHARS * 0.6;
    if (cur.length && (full || niceBreak)) {
      parts.push(cur.join("\n\n"));
      cur = [];
      size = 0;
    }
    cur.push(b);
    size += b.length + 2;
  }
  if (cur.length) parts.push(cur.join("\n\n"));
  return parts;
}

function halve(part: string): [string, string] {
  const bs = blocks(part);
  if (bs.length < 2) {
    const mid = part.lastIndexOf("\n", part.length / 2);
    const at = mid > 0 ? mid : Math.floor(part.length / 2);
    return [part.slice(0, at), part.slice(at)];
  }
  const mid = Math.ceil(bs.length / 2);
  return [bs.slice(0, mid).join("\n\n"), bs.slice(mid).join("\n\n")];
}

function unfence(text: string): string {
  const t = text.trim();
  const m = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i.exec(t);
  return m ? m[1].trim() : t;
}

/** Joins parts; a sentence cut at a PDF page boundary is put back together. */
function join(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .reduce((acc, p) => {
      if (!acc) return p;
      const midSentence = /[a-z,]$/i.test(acc) && /^[a-z]/.test(p);
      return acc + (midSentence ? " " : "\n\n") + p;
    }, "");
}

/** Final pass: front matter, heading levels, a repeated title, repeated figures. */
function finish(md: string, title: string, start: string): string {
  md = dropFrontMatter(md, start);
  let lines = md.split("\n");
  let fence = false;
  const hasH1 = lines.some((l) => {
    if (/^\s{0,3}(```|~~~)/.test(l)) fence = !fence;
    return !fence && /^# /.test(l);
  });
  if (hasH1) {
    fence = false;
    lines = lines.map((l) => {
      if (/^\s{0,3}(```|~~~)/.test(l)) fence = !fence;
      return !fence && /^#{1,5} /.test(l) ? `#${l}` : l;
    });
  }
  // Numbered papers: "6.2." is a subsection wherever the parts were cut, so
  // the numbering decides the level rather than each part's guess.
  const numbered = /^#{1,6}\s+(\d+(?:\.\d+)*)\.?\s+\S/;
  if (lines.filter((l) => /^#{1,6}\s+\d+\.\d+/.test(l)).length >= 3) {
    fence = false;
    lines = lines.map((l) => {
      if (/^\s{0,3}(```|~~~)/.test(l)) fence = !fence;
      const m = fence ? null : numbered.exec(l);
      if (!m) return l;
      const level = Math.min(m[1].split(".").length + 1, 4);
      return "#".repeat(level) + l.replace(/^#+/, "");
    });
  }
  const first = lines.findIndex((l) => l.trim());
  if (first >= 0 && title && /^#+\s/.test(lines[first]) && plain(lines[first]) === plain(title)) {
    lines.splice(first, 1);
  }
  return dedupe(lines.join("\n")).replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Author blocks, affiliations and dates are shown in the header already.
 * The model is asked to leave them out but does not always, so everything
 * above the opening words of the real text goes, together with anything
 * above it that is not a heading.
 */
function dropFrontMatter(md: string, start: string): string {
  const needle = plain(start).split(" ").slice(0, 8).join(" ");
  if (needle.split(" ").length < 5) return md;
  const bs = blocks(md);
  const at = bs.slice(0, 60).findIndex((b) => !/^#/.test(b) && plain(b).startsWith(needle));
  if (at <= 0) return md;
  let from = at;
  while (from > 0 && /^#{1,6}\s/.test(bs[from - 1])) from--;
  return bs.slice(from).join("\n\n");
}

const plain = (s: string) =>
  s.replace(/^#+\s*/, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase();

// "Figure 3." / "**Table 2:**", optionally as a list item.
const CAPTION = /^[-*_\s]*(figure|fig\.|table|scheme|box)\s*(\d+)[.:]/i;

/** The same image whatever its size variant: foo-550.jpg and foo.png match. */
function imageKey(block: string): string | null {
  const m = /^!\[[^\]]*\]\(([^)\s]+)[^)]*\)$/.exec(block.trim());
  if (!m) return null;
  return m[1]
    .replace(/[?#].*$/, "")
    .replace(/\.(png|jpe?g|gif|webp|avif|svg)$/i, "")
    .replace(/[-_](\d{2,4}(w|px)?|small|medium|large|thumb)$/i, "")
    .toLowerCase();
}

/**
 * Publisher pages repeat figures: inline, again in a gallery after the
 * references, and as loose caption fragments. Each part is rewritten on its
 * own and cannot know, so repeats are removed here, keeping the first.
 */
function dedupe(md: string): string {
  const bs = blocks(md);
  const captions = bs.filter((b) => CAPTION.test(b)).map(plain);
  const images = new Set<string>();
  const seenCaptions = new Set<string>();
  const kept = bs.filter((b) => {
    const img = imageKey(b);
    if (img) {
      if (images.has(img)) return false;
      images.add(img);
      return true;
    }
    const caption = CAPTION.exec(b);
    if (caption) {
      const key = `${caption[1].toLowerCase()} ${caption[2]}`;
      if (seenCaptions.has(key)) return false;
      seenCaptions.add(key);
      return true;
    }
    // A bare fragment of a caption, detached from its figure: its opening
    // words appear inside a real caption.
    const text = plain(b);
    const prose = !/^\s*(#|[-*+]\s|\d+\.\s|>|\||```|~~~)/.test(b);
    return !(prose && text.length >= 60 && captions.some((c) => c !== text && c.includes(text.slice(0, 120))));
  });
  return kept.join("\n\n");
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    // After one failure the import is lost anyway; stop spending on the rest.
    while (next < items.length && !failed) {
      const i = next++;
      try {
        results[i] = await fn(items[i], i);
      } catch (e) {
        failed = true;
        throw e;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

import "server-only";
import TurndownService from "turndown";
import { gfm } from "@joplin/turndown-plugin-gfm";
import { extractText } from "unpdf";

/**
 * Turns whatever was handed to the importer (a link, pasted text or HTML, a
 * PDF) into rough Markdown. Nothing here tries to be clever about structure:
 * the model cleans it up afterwards. The job is only to get the words out.
 */

export type Source =
  | { type: "markdown"; markdown: string; origin: string }
  // A PDF with no usable text layer (a scan). It goes to the model whole.
  | { type: "pdf"; data: Uint8Array; filename: string; origin: string };

export class ImportError extends Error {}

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const MIN_WORDS = 150;

export const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function looksLikeHtml(text: string): boolean {
  return /^\s*</.test(text) && /<\/?(html|body|div|p|article|section|h[1-6]|span)\b/i.test(text);
}

// Page furniture that never carries the article's text.
const DROPPED_TAGS = new Set(["script", "style", "noscript", "iframe", "svg", "canvas", "form", "button", "nav", "footer", "aside"]);

export function htmlToMarkdown(html: string, baseUrl?: string): string {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
  });
  td.use(gfm);
  td.remove((node) => DROPPED_TAGS.has(node.nodeName.toLowerCase()));
  if (baseUrl) {
    // Relative links and images would point at this site once imported.
    const absolute = (u: string) => {
      try {
        return new URL(u, baseUrl).href;
      } catch {
        return u;
      }
    };
    td.addRule("absoluteImages", {
      filter: "img",
      replacement: (_c, node) => {
        const el = node as HTMLElement;
        const src = el.getAttribute("src");
        if (!src || src.startsWith("data:")) return "";
        const alt = (el.getAttribute("alt") ?? "").replace(/[\[\]\n]/g, " ");
        return `![${alt}](${absolute(src)})`;
      },
    });
    td.addRule("absoluteLinks", {
      filter: (node) => node.nodeName === "A" && !!node.getAttribute("href"),
      replacement: (content, node) => {
        const href = (node as HTMLElement).getAttribute("href")!;
        if (href.startsWith("#") || href.startsWith("javascript:")) return content;
        return content.trim() ? `[${content}](${absolute(href)})` : "";
      },
    });
  }
  return td.turndown(html);
}

export async function pdfToSource(data: Uint8Array, filename: string, origin: string): Promise<Source> {
  let pages: string[];
  try {
    // unpdf may detach the buffer it is given, so it gets a copy.
    ({ text: pages } = await extractText(new Uint8Array(data), { mergePages: false }));
  } catch {
    throw new ImportError("That file could not be read as a PDF.");
  }
  const text = pages.join("\n\n");
  // A scan has pages but almost no text on them.
  if (words(text) < Math.max(MIN_WORDS, pages.length * 40)) {
    return { type: "pdf", data, filename, origin };
  }
  return { type: "markdown", markdown: text, origin };
}

export async function fromText(text: string): Promise<Source> {
  const markdown = looksLikeHtml(text) ? htmlToMarkdown(text) : text;
  if (words(markdown) < 20) throw new ImportError("There is not enough text there to import.");
  return { type: "markdown", markdown, origin: "" };
}

export async function fromUrl(raw: string): Promise<Source> {
  let url: URL;
  try {
    url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
  } catch {
    throw new ImportError("That does not look like a web address.");
  }

  // First ask the site directly. Many academic publishers answer a server
  // with a bot wall, so a failure here is expected and not final.
  const direct = await fetchDirect(url).catch(() => null);
  if (direct) return direct;

  // Then go through Jina Reader, which loads the page in a real browser.
  const viaReader = await fetchViaReader(url).catch(() => null);
  if (viaReader) return viaReader;

  throw new ImportError(
    `${url.hostname} would not let the importer read this page. Open it in your browser, then save it as a PDF or copy the page and paste it here.`,
  );
}

async function fetchDirect(url: URL): Promise<Source | null> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;

  const type = res.headers.get("content-type") ?? "";
  if (type.includes("pdf")) {
    const data = new Uint8Array(await res.arrayBuffer());
    const name = decodeURIComponent(url.pathname.split("/").pop() || "document.pdf");
    return pdfToSource(data, name, url.href);
  }
  if (!type.includes("html") && !type.includes("text")) return null;

  const body = await res.text();
  const markdown = type.includes("html") ? htmlToMarkdown(body, res.url) : body;
  // Pages rendered in the browser arrive as an empty shell.
  return words(markdown) >= MIN_WORDS ? { type: "markdown", markdown, origin: url.href } : null;
}

async function fetchViaReader(url: URL): Promise<Source | null> {
  const headers: Record<string, string> = {
    "X-Engine": "browser",
    "X-Timeout": "40",
    "X-Return-Format": "markdown",
  };
  if (process.env.JINA_API_KEY) headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`;

  const res = await fetch(`https://r.jina.ai/${url.href}`, {
    headers,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) return null;
  const body = await res.text();
  // The reader prefixes a small header (Title:, URL Source:, ...) and often
  // leaves the page title out of the body, so it is put back on top.
  const marker = body.indexOf("Markdown Content:");
  const title = /^Title:[ \t]*(.+)$/m.exec(marker >= 0 ? body.slice(0, marker) : "")?.[1].trim();
  const content = marker >= 0 ? body.slice(marker + "Markdown Content:".length) : body;
  const markdown = title ? `# ${title}\n\n${content.trim()}` : content;
  return words(markdown) >= MIN_WORDS ? { type: "markdown", markdown, origin: url.href } : null;
}

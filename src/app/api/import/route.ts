import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthed } from "@/lib/auth";
import { createImport } from "@/lib/db";
import { convert, type ImportEvent } from "@/lib/import/convert";
import { importModel } from "@/lib/import/openrouter";
import { ImportError, fromText, fromUrl, pdfToSource, words, type Source } from "@/lib/import/source";

export const dynamic = "force-dynamic";
// A long paper is a few dozen model calls; give them room.
export const maxDuration = 300;

const MAX_PDF_BYTES = 40 * 1024 * 1024;
const MAX_TEXT_CHARS = 4_000_000;

/**
 * Takes a link, pasted text/HTML or a PDF and answers with a stream of
 * newline-delimited JSON events while the article is rebuilt. The work is
 * tied to the request's lifetime with after(), so closing the tab does not
 * lose an import that is already under way: it still lands in the library.
 */
export async function POST(req: Request) {
  if (!(await isAuthed())) return new Response("Unauthorized", { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return new Response("Expected form data", { status: 400 });

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array>();
  const writer = writable.getWriter();
  let open = true;
  const send = (event: ImportEvent) => {
    if (!open) return;
    writer.write(encoder.encode(JSON.stringify(event) + "\n")).catch(() => {
      open = false; // the reader went away; keep working regardless
    });
  };

  const job = (async () => {
    try {
      const source = await readSource(form, send);
      if (source.type === "markdown") {
        send({ type: "status", message: `Read ${words(source.markdown).toLocaleString("en-US")} words` });
      } else {
        send({ type: "status", message: "No text layer in that PDF, so the model is reading the pages" });
      }

      const started = Date.now();
      const article = await convert(source, (p) => send({ type: "progress", ...p }));
      const id = await createImport({ ...article, source: source.origin || sourceLabel(form) });
      console.info(
        `[import] #${id} "${article.title}" via ${importModel()}: ` +
          `${words(article.content)} words, ${((Date.now() - started) / 1000).toFixed(0)}s, $${article.cost.toFixed(3)}`,
      );
      revalidatePath("/admin");
      send({ type: "done", id });
    } catch (e) {
      const message = e instanceof ImportError ? e.message : "Something went wrong while importing.";
      if (!(e instanceof ImportError)) console.error("[import]", e);
      send({ type: "error", message });
    } finally {
      open = false;
      await writer.close().catch(() => {});
    }
  })();

  after(job);

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function readSource(form: FormData, send: (e: ImportEvent) => void): Promise<Source> {
  const mode = String(form.get("mode") ?? "");

  if (mode === "link") {
    const url = String(form.get("url") ?? "");
    send({ type: "status", message: `Fetching ${hostOf(url)}` });
    return fromUrl(url);
  }

  if (mode === "text") {
    const text = String(form.get("text") ?? "");
    if (text.length > MAX_TEXT_CHARS) throw new ImportError("That is too much text for one import.");
    send({ type: "status", message: "Reading the pasted text" });
    return fromText(text);
  }

  if (mode === "pdf") {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ImportError("Choose a PDF first.");
    if (file.size > MAX_PDF_BYTES) throw new ImportError("That PDF is larger than 40 MB.");
    send({ type: "status", message: `Extracting text from ${file.name}` });
    return pdfToSource(new Uint8Array(await file.arrayBuffer()), file.name, "");
  }

  throw new ImportError("Unknown import type.");
}

function sourceLabel(form: FormData): string {
  const file = form.get("file");
  return file instanceof File ? file.name : "";
}

function hostOf(url: string): string {
  try {
    return new URL(url.trim()).hostname.replace(/^www\./, "");
  } catch {
    return "the page";
  }
}

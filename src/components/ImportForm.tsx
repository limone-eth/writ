"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ImportEvent } from "@/lib/import/convert";

type Mode = "link" | "text" | "pdf";

const MODES: { id: Mode; label: string }[] = [
  { id: "link", label: "Link" },
  { id: "text", label: "Paste" },
  { id: "pdf", label: "PDF" },
];

type Run =
  | { state: "idle" }
  | { state: "running"; status: string; done: number; total: number }
  | { state: "error"; message: string };

export default function ImportForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("link");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [run, setRun] = useState<Run>({ state: "idle" });

  const running = run.state === "running";
  const ready = mode === "link" ? url.trim() !== "" : mode === "text" ? text.trim() !== "" : file !== null;

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setRun({ state: "error", message: "That is not a PDF." });
      return;
    }
    setFile(f);
    setRun({ state: "idle" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || running) return;

    const body = new FormData();
    body.set("mode", mode);
    if (mode === "link") body.set("url", url.trim());
    if (mode === "text") body.set("text", text);
    if (mode === "pdf" && file) body.set("file", file);

    setRun({ state: "running", status: "Starting", done: 0, total: 0 });
    try {
      const res = await fetch("/api/import", { method: "POST", body });
      if (res.status === 401) throw new Error("Your session has expired. Sign in again.");
      if (!res.ok || !res.body) throw new Error("The import could not start.");

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const event = JSON.parse(line) as ImportEvent;
          if (event.type === "done") {
            router.push(`/admin/library/${event.id}`);
            return;
          }
          if (event.type === "error") throw new Error(event.message);
          setRun((r) =>
            r.state !== "running"
              ? r
              : event.type === "status"
                ? { ...r, status: event.message }
                : { ...r, status: "Rebuilding the article", done: event.done, total: event.total },
          );
        }
      }
      throw new Error("The connection closed before the import finished. Check the Desk: it may still arrive.");
    } catch (err) {
      setRun({ state: "error", message: err instanceof Error ? err.message : "The import failed." });
    }
  };

  return (
    <form onSubmit={submit} className="mt-8">
      <div role="group" aria-label="Import from" className="inline-grid grid-cols-3 gap-1 rounded-[12px] bg-rule-soft p-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            disabled={running}
            onClick={() => {
              setMode(m.id);
              if (run.state === "error") setRun({ state: "idle" });
            }}
            className={[
              "h-8 min-w-[4.5rem] rounded-lg px-3 text-[13px]",
              "transition-[color,background-color,box-shadow,transform] duration-150 ease-snap active:scale-[0.96]",
              "disabled:active:scale-100",
              mode === m.id ? "bg-raised font-semibold text-ink shadow-[var(--shadow)]" : "text-ink-soft hover:text-ink",
            ].join(" ")}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {mode === "link" && (
          <input
            type="url"
            inputMode="url"
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={running}
            placeholder="https://"
            aria-label="Link to the article"
            className="h-11 w-full rounded-lg border border-rule bg-raised px-3.5 text-[15px] text-ink placeholder:text-ink-faint transition-colors focus:border-ink-faint disabled:opacity-60"
          />
        )}

        {mode === "text" && (
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={running}
            placeholder="Paste the article's text, Markdown or HTML"
            aria-label="Article text or HTML"
            className="block min-h-[16rem] w-full resize-y rounded-lg border border-rule bg-raised px-3.5 py-3 text-[14px] leading-relaxed text-ink placeholder:text-ink-faint transition-colors focus:border-ink-faint disabled:opacity-60"
          />
        )}

        {mode === "pdf" && (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!running) pickFile(e.dataTransfer.files[0]);
            }}
            className={[
              "flex min-h-[9rem] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 text-center",
              "transition-colors duration-150",
              dragging ? "border-accent bg-rule-soft" : "border-rule bg-raised hover:border-ink-faint",
              running ? "pointer-events-none opacity-60" : "",
            ].join(" ")}
          >
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              disabled={running}
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            {file ? (
              <>
                <span className="max-w-full truncate text-[14px] font-semibold text-ink">{file.name}</span>
                <span className="text-[12px] text-ink-faint tabular">
                  {(file.size / 1024 / 1024).toFixed(1)} MB · choose another
                </span>
              </>
            ) : (
              <>
                <span className="text-[14px] text-ink">Drop a PDF here</span>
                <span className="text-[12px] text-ink-faint">or click to choose one</span>
              </>
            )}
          </label>
        )}
      </div>

      {run.state === "error" && (
        <p role="alert" className="mt-3 text-[13px] leading-relaxed text-accent">
          {run.message}
        </p>
      )}

      {running ? (
        <Progress status={run.status} done={run.done} total={run.total} />
      ) : (
        <button
          type="submit"
          disabled={!ready}
          className="mt-4 h-11 w-full rounded-lg bg-ink text-[14px] font-semibold text-paper transition-[transform,opacity] duration-150 ease-snap hover:opacity-90 active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
        >
          Import
        </button>
      )}
    </form>
  );
}

function Progress({ status, done, total }: { status: string; done: number; total: number }) {
  const fraction = total ? done / total : 0;
  return (
    <div className="mt-5" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="text-ink">{status}…</span>
        {total > 1 && (
          <span className="shrink-0 text-ink-faint tabular">
            {done} of {total} parts
          </span>
        )}
      </div>
      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-rule-soft">
        <div
          className={[
            "h-full rounded-full bg-accent transition-transform duration-500 ease-snap origin-left",
            total ? "" : "import-indeterminate",
          ].join(" ")}
          style={total ? { transform: `scaleX(${Math.max(fraction, 0.02)})` } : undefined}
        />
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
        Long papers take a minute or two. You can leave this page: the article still lands in your library.
      </p>
    </div>
  );
}

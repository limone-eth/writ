import "server-only";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { ImportError } from "./source";

/**
 * The smallest possible OpenRouter client: one chat completion, retried on
 * rate limits and upstream hiccups. OpenRouter speaks the OpenAI wire format,
 * so there is no SDK to carry.
 */

// Cheap, long context, reads PDFs natively; cleanup needs no big model.
// Override with OPENROUTER_MODEL.
const DEFAULT_MODEL = "openai/gpt-5.6-luna";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "file"; file: { filename: string; file_data: string } };

export type Completion = { text: string; truncated: boolean; cost: number };

export function importModel(): string {
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

export async function complete(opts: {
  system: string;
  user: string | ContentPart[];
  maxTokens: number;
  json?: boolean;
}): Promise<Completion> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new ImportError("OPENROUTER_API_KEY is not set on the server.");

  const hasFile = Array.isArray(opts.user) && opts.user.some((p) => p.type === "file");
  const body = {
    model: importModel(),
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    max_tokens: opts.maxTokens,
    temperature: 0,
    // This is transcription, not problem solving: thinking only adds latency.
    reasoning: { effort: "low", exclude: true },
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    ...(hasFile ? { plugins: [{ id: "file-parser", pdf: { engine: "native" } }] } : {}),
  };

  for (let attempt = 0; ; attempt++) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": SITE_URL,
        "X-Title": SITE_NAME,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(240_000),
    }).catch((e) => {
      if (attempt < 2) return null;
      throw new ImportError(`Could not reach OpenRouter: ${e instanceof Error ? e.message : e}`);
    });

    if (res && res.ok) {
      const data = await res.json();
      // OpenRouter can answer 200 with an error from the upstream provider.
      if (data.error && attempt < 2) {
        await pause(attempt);
        continue;
      }
      if (data.error) throw new ImportError(`OpenRouter: ${data.error.message ?? "request failed"}`);
      const choice = data.choices?.[0];
      return {
        text: String(choice?.message?.content ?? ""),
        truncated: choice?.finish_reason === "length",
        cost: Number(data.usage?.cost ?? 0),
      };
    }

    const retriable = !res || res.status === 429 || res.status >= 500;
    if (retriable && attempt < 2) {
      await pause(attempt);
      continue;
    }
    const detail = res ? await res.json().catch(() => null) : null;
    throw new ImportError(
      `OpenRouter${res ? ` (${res.status})` : ""}: ${detail?.error?.message ?? "request failed"}`,
    );
  }
}

const pause = (attempt: number) => new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));

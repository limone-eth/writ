import Link from "next/link";
import { listAll } from "@/lib/db";
import { createDraft, logout } from "@/lib/actions";
import { formatDate, readingTime, wordCount } from "@/lib/slug";
import ReaderSettings from "@/components/ReaderSettings";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata = { title: "Desk" };

export default async function Desk() {
  const posts = await listAll();
  const drafts = posts.filter((p) => p.kind === "post" && !p.published);
  const published = posts.filter((p) => p.kind === "post" && p.published);
  const library = posts
    .filter((p) => p.kind === "import")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-rule-soft bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[38rem] items-center justify-between px-5">
          <Link href="/" className="text-[15px] font-bold tracking-tight transition-opacity hover:opacity-70">
            {SITE_NAME}
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/admin/import"
              className="flex h-8 items-center rounded-full px-3 text-[13px] text-ink-soft transition-[color,background-color,transform] duration-150 ease-snap hover:bg-rule-soft hover:text-ink active:scale-[0.96]"
            >
              Import
            </Link>
            <form action={createDraft}>
              <button
                type="submit"
                className="h-8 rounded-full bg-ink px-3.5 text-[13px] font-semibold text-paper transition-[transform,opacity] duration-150 ease-snap hover:opacity-90 active:scale-[0.96]"
              >
                New draft
              </button>
            </form>
            <ReaderSettings />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[38rem] px-5 pb-24">
        <Group title="Drafts" count={drafts.length}>
          {drafts.map((p) => (
            <Row
              key={p.id}
              href={`/admin/${p.id}`}
              title={p.title || "Untitled"}
              meta={`${wordCount(p.content)} words · edited ${formatDate(p.updated_at)}`}
            />
          ))}
        </Group>

        <Group title="Published" count={published.length}>
          {published.map((p) => (
            <Row
              key={p.id}
              href={`/admin/${p.id}`}
              title={p.title || "Untitled"}
              meta={`${formatDate(p.published_at ?? p.created_at)} · /p/${p.slug}`}
              viewHref={`/p/${p.slug}`}
            />
          ))}
        </Group>

        <Group title="Library" count={library.length} empty="Articles you import to read show up here.">
          {library.map((p) => (
            <Row
              key={p.id}
              href={`/admin/library/${p.id}`}
              title={p.title || "Untitled"}
              meta={[sourceName(p.source), `${readingTime(p.content)} min`, `imported ${formatDate(p.created_at)}`]
                .filter(Boolean)
                .join(" · ")}
            />
          ))}
        </Group>

        <form action={logout} className="mt-14 border-t border-rule-soft pt-6">
          <button type="submit" className="text-[12px] text-ink-faint transition-colors hover:text-ink">
            Sign out
          </button>
        </form>
      </main>
    </div>
  );
}

function sourceName(source: string): string {
  try {
    return new URL(source).hostname.replace(/^www\./, "");
  } catch {
    return source;
  }
}

function Group({
  title,
  count,
  empty = "Nothing here.",
  children,
}: {
  title: string;
  count: number;
  empty?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-1 flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-faint">
        {title} <span className="tabular font-normal">{count}</span>
      </div>
      {count === 0 ? (
        <p className="py-5 text-[14px] text-ink-faint">{empty}</p>
      ) : (
        <ul className="divide-y divide-rule-soft">{children}</ul>
      )}
    </section>
  );
}

function Row({
  href,
  title,
  meta,
  viewHref,
}: {
  href: string;
  title: string;
  meta: string;
  viewHref?: string;
}) {
  return (
    <li className="group flex items-center gap-3 py-4">
      <Link href={href} className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-ink transition-colors group-hover:text-accent">
          {title}
        </div>
        <div className="mt-0.5 truncate text-[12px] text-ink-faint">{meta}</div>
      </Link>
      {viewHref && (
        <Link
          href={viewHref}
          className="shrink-0 rounded-md px-2 py-1 text-[12px] text-ink-faint opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
        >
          View
        </Link>
      )}
    </li>
  );
}

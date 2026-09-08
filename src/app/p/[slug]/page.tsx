import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBySlug, neighbours } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { excerpt, formatDate, readingTime } from "@/lib/slug";
import SiteHeader from "@/components/SiteHeader";
import Markdown from "@/components/Markdown";
import ReadingProgress from "@/components/ReadingProgress";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBySlug(slug);
  if (!post) return { title: "Not found" };
  return {
    title: post.title || "Untitled",
    description: post.subtitle || excerpt(post.content, 155),
  };
}

export default async function ArticlePage({ params }: Params) {
  const { slug } = await params;
  const [post, authed] = await Promise.all([getBySlug(slug), isAuthed()]);
  if (!post) notFound();
  if (!post.published && !authed) notFound();

  const { older, newer } = await neighbours(post);
  const date = post.published_at ?? post.created_at;

  return (
    <div className="min-h-dvh">
      <ReadingProgress />
      <SiteHeader authed={authed} back={{ href: "/", label: "All writing" }} />

      <main className="mx-auto max-w-[var(--measure)] px-5 pb-24 sm:px-0">
        <article className="rise">
          <header className="py-12 sm:py-16">
            {!post.published && (
              <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-rule bg-rule-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                Draft preview
              </div>
            )}

            <h1 className="font-reading text-[30px] font-bold leading-[1.15] tracking-[-0.022em] text-ink sm:text-[38px]">
              {post.title || "Untitled"}
            </h1>

            {post.subtitle && (
              <p className="font-reading mt-3 text-[17px] leading-relaxed text-ink-soft sm:text-[19px]">
                {post.subtitle}
              </p>
            )}

            <div className="mt-6 flex items-center gap-2 text-[12px] text-ink-faint tabular">
              <time dateTime={date}>{formatDate(date)}</time>
              <span aria-hidden="true">·</span>
              <span>{readingTime(post.content)} min read</span>
              {authed && (
                <>
                  <span aria-hidden="true">·</span>
                  <Link href={`/admin/${post.id}`} className="transition-colors hover:text-ink">
                    Edit
                  </Link>
                </>
              )}
            </div>
          </header>

          <div className="prose pb-4">
            <Markdown>{post.content}</Markdown>
          </div>
        </article>

        {(older || newer) && (
          <nav className="mt-16 grid gap-3 border-t border-rule-soft pt-8 sm:grid-cols-2">
            {newer ? (
              <Link
                href={`/p/${newer.slug}`}
                className="group rounded-lg border border-rule p-4 transition-colors duration-150 hover:border-ink-faint"
              >
                <div className="mb-1 text-[11px] uppercase tracking-[0.08em] text-ink-faint">Newer</div>
                <div className="text-[14px] font-semibold leading-snug text-ink transition-colors group-hover:text-accent">
                  {newer.title || "Untitled"}
                </div>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {older && (
              <Link
                href={`/p/${older.slug}`}
                className="group rounded-lg border border-rule p-4 transition-colors duration-150 hover:border-ink-faint sm:text-right"
              >
                <div className="mb-1 text-[11px] uppercase tracking-[0.08em] text-ink-faint">Older</div>
                <div className="text-[14px] font-semibold leading-snug text-ink transition-colors group-hover:text-accent">
                  {older.title || "Untitled"}
                </div>
              </Link>
            )}
          </nav>
        )}
      </main>
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getBySlug, neighbours } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { excerpt, formatDate, readingTime } from "@/lib/slug";
import Article from "@/components/Article";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBySlug(slug);
  if (!post || post.kind === "import") return { title: "Not found" };
  const title = post.title || "Untitled";
  const description = post.subtitle || excerpt(post.content, 155);
  // Absolute: a link preview should show the article's title alone, not
  // the site name appended by the layout template.
  return {
    title: { absolute: title },
    description,
    openGraph: {
      type: "article",
      title,
      description,
      siteName: SITE_NAME,
      publishedTime: post.published_at ?? undefined,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ArticlePage({ params }: Params) {
  const { slug } = await params;
  const [post, authed] = await Promise.all([getBySlug(slug), isAuthed()]);
  if (!post) notFound();
  // Imports are read in the private library, never at a public address.
  if (post.kind === "import") {
    if (authed) redirect(`/admin/library/${post.id}`);
    notFound();
  }
  if (!post.published && !authed) notFound();

  const { older, newer } = await neighbours(post);
  const date = post.published_at ?? post.created_at;

  return (
    <Article
      post={post}
      authed={authed}
      back={{ href: "/", label: "All writing" }}
      badge={post.published ? undefined : "Draft preview"}
      meta={[
        <time key="date" dateTime={date}>
          {formatDate(date)}
        </time>,
        <span key="time">{readingTime(post.content)} min read</span>,
        ...(authed
          ? [
              <Link key="edit" href={`/admin/${post.id}`} className="transition-colors hover:text-ink">
                Edit
              </Link>,
            ]
          : []),
      ]}
    >
      {(older || newer) && (
        <nav className="mt-16 grid gap-3 border-t border-rule-soft pt-8 sm:grid-cols-2">
          {newer ? (
            <Link
              href={`/p/${newer.slug}`}
              className="group rounded-lg border border-rule p-4 transition-colors duration-150 hover:border-ink-faint"
            >
              <div className="mb-1 text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                Newer
              </div>
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
              <div className="mb-1 text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                Older
              </div>
              <div className="text-[14px] font-semibold leading-snug text-ink transition-colors group-hover:text-accent">
                {older.title || "Untitled"}
              </div>
            </Link>
          )}
        </nav>
      )}
    </Article>
  );
}

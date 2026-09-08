import Link from "next/link";
import { listPublished } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { excerpt, formatDate, readingTime } from "@/lib/slug";
import SiteHeader from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [posts, authed] = await Promise.all([listPublished(), isAuthed()]);
  const tagline = process.env.NEXT_PUBLIC_SITE_TAGLINE || "writing, in the open";

  return (
    <div className="min-h-dvh">
      <SiteHeader authed={authed} />

      <main className="mx-auto max-w-[var(--measure)] px-5 pb-24 sm:px-0">
        <div className="border-b border-rule-soft py-12 sm:py-16">
          <p className="text-[15px] leading-relaxed text-ink-soft">{tagline}</p>
        </div>

        {posts.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-[15px] text-ink-faint">Nothing published yet.</p>
            {authed && (
              <Link
                href="/admin"
                className="mt-3 inline-block text-[14px] text-accent underline underline-offset-4"
              >
                Write the first one
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-rule-soft">
            {posts.map((post, i) => (
              <li key={post.id} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
                <Link href={`/p/${post.slug}`} className="group block py-7 sm:py-8">
                  <div className="mb-1.5 flex items-center gap-2 text-[12px] text-ink-faint tabular">
                    <time dateTime={post.published_at ?? post.created_at}>
                      {formatDate(post.published_at ?? post.created_at)}
                    </time>
                    <span aria-hidden="true">·</span>
                    <span>{readingTime(post.content)} min</span>
                  </div>

                  <h2 className="text-[19px] font-bold leading-snug tracking-[-0.01em] text-ink transition-colors group-hover:text-accent">
                    {post.title || "Untitled"}
                  </h2>

                  {post.subtitle ? (
                    <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{post.subtitle}</p>
                  ) : (
                    <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">
                      {excerpt(post.content, 150)}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* The header already carries Desk when signed in; the footer exists only
          as the quiet way back to the login screen. */}
      {!authed && (
        <footer className="mx-auto max-w-[var(--measure)] px-5 pb-12 sm:px-0">
          <div className="border-t border-rule-soft pt-6">
            <Link
              href="/login"
              aria-label="Sign in"
              className="text-[12px] text-ink-faint transition-colors duration-150 hover:text-ink"
            >
              ·
            </Link>
          </div>
        </footer>
      )}
    </div>
  );
}

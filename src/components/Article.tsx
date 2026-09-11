import { Fragment } from "react";
import type { Post } from "@/lib/db";
import { presentationVars } from "@/lib/presentation";
import { headingsOf } from "@/lib/toc";
import SiteHeader from "./SiteHeader";
import Markdown from "./Markdown";
import ReadingProgress from "./ReadingProgress";
import Toc from "./Toc";

/**
 * The reading page: progress bar, outline, title block and body. Shared by
 * published posts and by imported articles in the private library, which
 * differ only in what sits around them.
 */
export default function Article({
  post,
  authed,
  back,
  badge,
  meta,
  children,
}: {
  post: Post;
  authed: boolean;
  back: { href: string; label: string };
  badge?: string;
  /** Small items under the title, separated by dots. */
  meta: React.ReactNode[];
  /** Whatever follows the article, such as older/newer links. */
  children?: React.ReactNode;
}) {
  const toc = headingsOf(post.content);
  const showToc = toc.length >= 2;

  return (
    // The writer's typeface, size and measure travel with the post.
    <div className="min-h-dvh" style={presentationVars(post)}>
      <ReadingProgress />
      <SiteHeader authed={authed} back={back} />

      {/* Three columns on wide screens: outline | article | spacer. The side
          columns absorb leftover space; the outline hides itself when its
          column gets too narrow to hold it. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_min(var(--measure),100%)_minmax(0,1fr)]">
        {showToc && (
          <aside className="toc-col hidden lg:block">
            <div className="sticky top-20 ml-auto max-w-[13rem] pr-10">
              <Toc items={toc} maxHeight="calc(100dvh - 6rem)" />
            </div>
          </aside>
        )}
        <main className="mx-auto w-full max-w-[var(--measure)] px-5 pb-24 sm:px-0 lg:col-start-2">
          <article className="rise">
            <header className="py-12 sm:py-16">
              {badge && (
                <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-rule bg-rule-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                  {badge}
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

              <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-faint tabular">
                {meta.map((item, i) => (
                  <Fragment key={i}>
                    {i > 0 && <span aria-hidden="true">·</span>}
                    {item}
                  </Fragment>
                ))}
              </div>
            </header>

            <div className="prose pb-4">
              <Markdown>{post.content}</Markdown>
            </div>
          </article>

          {children}
        </main>
      </div>
    </div>
  );
}

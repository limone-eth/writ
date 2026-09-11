import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getById } from "@/lib/db";
import { formatDate, readingTime } from "@/lib/slug";
import Article from "@/components/Article";
import DeleteButton from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = await getById(Number((await params).id));
  return { title: post?.title || "Library" };
}

/** An imported article, read in the same layout as the blog's own posts. */
export default async function LibraryArticle({ params }: Params) {
  const { id } = await params;
  const post = await getById(Number(id));
  if (!post) notFound();
  if (post.kind !== "import") redirect(`/admin/${post.id}`);

  const link = /^https?:\/\//.test(post.source) ? new URL(post.source) : null;

  return (
    <Article
      post={post}
      authed
      back={{ href: "/admin", label: "Desk" }}
      badge="Imported"
      meta={[
        link ? (
          <a
            key="source"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-rule underline-offset-[3px] transition-colors hover:text-ink"
          >
            {link.hostname.replace(/^www\./, "")}
          </a>
        ) : (
          <span key="source">{post.source || "Pasted text"}</span>
        ),
        <span key="date">Imported {formatDate(post.created_at)}</span>,
        <span key="time">{readingTime(post.content)} min read</span>,
        <DeleteButton key="delete" id={post.id} />,
      ]}
    />
  );
}

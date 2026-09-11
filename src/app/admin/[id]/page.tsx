import { notFound, redirect } from "next/navigation";
import { getById } from "@/lib/db";
import Editor from "@/components/Editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editing" };

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getById(Number(id));
  if (!post) notFound();
  // Imports are read-only: the editor cannot hold their tables and images.
  if (post.kind === "import") redirect(`/admin/library/${post.id}`);
  return <Editor post={post} />;
}

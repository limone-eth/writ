"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, ready, getById } from "./db";
import { checkPassword, createSession, destroySession, requireAuth } from "./auth";
import { slugify } from "./slug";
import { normalizePresentation, type Presentation } from "./presentation";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  if (!process.env.AUTH_PASSWORD) {
    return { error: "AUTH_PASSWORD is not set on the server." };
  }
  // Small constant delay to blunt brute forcing.
  await new Promise((r) => setTimeout(r, 400));
  if (!checkPassword(password)) return { error: "Wrong password." };
  await createSession();
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

async function uniqueSlug(desired: string, id: number): Promise<string> {
  const base = slugify(desired);
  let candidate = base;
  for (let i = 2; i < 200; i++) {
    const rs = await db.execute({
      sql: "SELECT id FROM posts WHERE slug = ? AND id != ? LIMIT 1",
      args: [candidate, id],
    });
    if (rs.rows.length === 0) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

export async function createDraft() {
  await requireAuth();
  await ready();
  const now = new Date().toISOString();
  const rs = await db.execute({
    sql: `INSERT INTO posts (slug, title, subtitle, content, published, created_at, updated_at)
          VALUES (?, '', '', '', 0, ?, ?) RETURNING id`,
    args: [`draft-${Date.now().toString(36)}`, now, now],
  });
  const id = Number(rs.rows[0].id);
  redirect(`/admin/${id}`);
}

export type SaveResult = { ok: true; slug: string; updatedAt: string } | { ok: false; error: string };

export async function savePost(input: {
  id: number;
  title: string;
  subtitle: string;
  content: string;
} & Partial<Presentation>): Promise<SaveResult> {
  await requireAuth();
  await ready();
  const post = await getById(input.id);
  if (!post) return { ok: false, error: "Post not found." };
  if (post.kind === "import") return { ok: false, error: "Imported articles are read-only." };

  const title = input.title.trim();
  const now = new Date().toISOString();
  // Keep the slug stable once published so links never break.
  const slug = post.published ? post.slug : await uniqueSlug(title || `draft-${post.id}`, post.id);

  const look = normalizePresentation({
    font: input.font ?? post.font,
    size: input.size ?? post.size,
    width: input.width ?? post.width,
  });

  await db.execute({
    sql: `UPDATE posts SET title = ?, subtitle = ?, content = ?, slug = ?, font = ?, size = ?, width = ?, updated_at = ?
          WHERE id = ?`,
    args: [title, input.subtitle.trim(), input.content, slug, look.font, look.size, look.width, now, post.id],
  });

  revalidatePath("/");
  revalidatePath(`/p/${slug}`);
  revalidatePath("/admin");
  return { ok: true, slug, updatedAt: now };
}

export async function setPublished(id: number, published: boolean) {
  await requireAuth();
  await ready();
  const post = await getById(id);
  // Imports are someone else's writing: they stay in the private library.
  if (!post || post.kind === "import") return;
  const now = new Date().toISOString();

  if (published) {
    const slug = await uniqueSlug(post.title.trim() || `post-${post.id}`, post.id);
    await db.execute({
      sql: `UPDATE posts SET published = 1, slug = ?, published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?`,
      args: [slug, now, now, id],
    });
  } else {
    await db.execute({
      sql: `UPDATE posts SET published = 0, updated_at = ? WHERE id = ?`,
      args: [now, id],
    });
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/p/${post.slug}`);
}

export async function deletePost(id: number) {
  await requireAuth();
  await ready();
  const post = await getById(id);
  await db.execute({ sql: "DELETE FROM posts WHERE id = ?", args: [id] });
  revalidatePath("/");
  revalidatePath("/admin");
  if (post) revalidatePath(`/p/${post.slug}`);
  redirect("/admin");
}

/**
 * Images embedded in an article. The file goes from the browser straight to
 * Vercel Blob, so it never passes through a server function and is not held
 * to Vercel's request body limit. What ends up in the post is an ordinary
 * Markdown image, `![alt](url)`, so the stored text stays portable.
 *
 * Kept free of "use client" so the upload route can share the rules the
 * editor enforces.
 */

import { slugify } from "./slug";

export const IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",
] as const;

export const MAX_IMAGE_MB = 10;
export const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

export function isImage(file: File): boolean {
  return (IMAGE_TYPES as readonly string[]).includes(file.type);
}

/** Every image of a post shares a prefix, so deleting the post can sweep them. */
export function imagePrefix(postId: number): string {
  return `posts/${postId}/`;
}

/**
 * Where a file lands in the store. The name is only a hint — Blob appends a
 * random suffix — but a readable one keeps the store browsable.
 */
export function imagePathname(postId: number, filename: string): string {
  const dot = filename.lastIndexOf(".");
  const name = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  return `${imagePrefix(postId)}${slugify(name)}${ext ? `.${ext}` : ""}`;
}

/** Pulls the image files out of a paste or a drop, ignoring anything else. */
export function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files).filter(isImage);
}

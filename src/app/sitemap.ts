import type { MetadataRoute } from "next";
import { listPublished } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const posts = await listPublished();
  return [
    { url: base, lastModified: new Date() },
    ...posts.map((p) => ({
      url: `${base}/p/${p.slug}`,
      lastModified: new Date(p.updated_at),
    })),
  ];
}

import type { MetadataRoute } from "next";
import { listPublished } from "@/lib/db";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL;
  const posts = await listPublished();
  return [
    { url: base, lastModified: new Date() },
    ...posts.map((p) => ({
      url: `${base}/p/${p.slug}`,
      lastModified: new Date(p.updated_at),
    })),
  ];
}

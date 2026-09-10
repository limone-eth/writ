import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getBySlug } from "@/lib/db";
import { formatDate } from "@/lib/slug";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = "Article preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Params = { params: Promise<{ slug: string }> };

// Read from disk (Node runtime). next.config traces the fonts folder into
// the deployed bundle so the files exist there too.
const font = (file: string) =>
  readFile(path.join(process.cwd(), "src/assets/fonts", file));

/**
 * Link preview card for a post: title, subtitle and site name on the same
 * paper background the site uses, so the card reads as a page of the blog.
 */
export default async function Image({ params }: Params) {
  const { slug } = await params;
  const post = await getBySlug(slug);
  const [regular, bold] = await Promise.all([
    font("Lato-400.ttf"),
    font("Lato-700.ttf"),
  ]);

  // Drafts are not public, so their card must not reveal them either.
  const visible = post && post.published ? post : null;
  const title = visible ? visible.title || "Untitled" : SITE_NAME;
  const subtitle = visible ? visible.subtitle : SITE_TAGLINE;
  const date = visible ? formatDate(visible.published_at ?? visible.created_at) : "";
  // Long titles get a smaller size so they still fit in three lines.
  const titleSize = title.length > 70 ? 52 : title.length > 40 ? 62 : 72;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#fbfaf8",
          color: "#1a1917",
          fontFamily: "Lato",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 26,
            color: "#8a8478",
          }}
        >
          {/* The fallback card already shows the name as its title. */}
          {visible && (
            <span style={{ fontWeight: 700, color: "#1a1917" }}>
              {SITE_NAME}
            </span>
          )}
          {date && <span>·</span>}
          {date && <span>{date}</span>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: titleSize,
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: "-0.02em",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 30,
                lineHeight: 1.4,
                color: "#5d584f",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        <div
          style={{
            width: 64,
            height: 4,
            borderRadius: 2,
            background: "#a8401b",
          }}
        />
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Lato", data: regular, weight: 400, style: "normal" },
        { name: "Lato", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}

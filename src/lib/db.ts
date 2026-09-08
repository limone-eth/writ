import { createClient, type Client } from "@libsql/client";
import { normalizePresentation, type Presentation } from "./presentation";

declare global {
  // eslint-disable-next-line no-var
  var __writDb: Client | undefined;
  // eslint-disable-next-line no-var
  var __writDbReady: Promise<void> | undefined;
}

function makeClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) {
    return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return createClient({ url: "file:./data/writ.db" });
}

export const db: Client = globalThis.__writDb ?? makeClient();
if (process.env.NODE_ENV !== "production") globalThis.__writDb = db;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS posts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    slug         TEXT NOT NULL UNIQUE,
    title        TEXT NOT NULL DEFAULT '',
    subtitle     TEXT NOT NULL DEFAULT '',
    content      TEXT NOT NULL DEFAULT '',
    published    INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    published_at TEXT
  );
`;

// Columns added after the first release. SQLite has no ADD COLUMN IF NOT
// EXISTS, so each is attempted and a "duplicate column" failure is expected.
const ADDED_COLUMNS = [
  "font  TEXT    NOT NULL DEFAULT 'lato'",
  "size  INTEGER NOT NULL DEFAULT 18",
  "width TEXT    NOT NULL DEFAULT 'narrow'",
];

async function migrate() {
  await db.execute(SCHEMA);
  await db.execute(
    "CREATE INDEX IF NOT EXISTS posts_published_idx ON posts (published, published_at DESC)"
  );
  for (const col of ADDED_COLUMNS) {
    try {
      await db.execute(`ALTER TABLE posts ADD COLUMN ${col}`);
    } catch (e) {
      if (!/duplicate column/i.test(String(e))) throw e;
    }
  }
}

export function ready(): Promise<void> {
  globalThis.__writDbReady ??= migrate();
  return globalThis.__writDbReady;
}

export type Post = {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  content: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  published_at: string | null;
} & Presentation;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPost(row: any): Post {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    title: String(row.title ?? ""),
    subtitle: String(row.subtitle ?? ""),
    content: String(row.content ?? ""),
    published: Number(row.published) === 1,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    published_at: row.published_at ? String(row.published_at) : null,
    ...normalizePresentation(row),
  };
}

export async function listPublished(): Promise<Post[]> {
  await ready();
  const rs = await db.execute(
    "SELECT * FROM posts WHERE published = 1 ORDER BY COALESCE(published_at, created_at) DESC"
  );
  return rs.rows.map(toPost);
}

export async function listAll(): Promise<Post[]> {
  await ready();
  const rs = await db.execute("SELECT * FROM posts ORDER BY updated_at DESC");
  return rs.rows.map(toPost);
}

export async function getBySlug(slug: string): Promise<Post | null> {
  await ready();
  const rs = await db.execute({
    sql: "SELECT * FROM posts WHERE slug = ? LIMIT 1",
    args: [slug],
  });
  return rs.rows[0] ? toPost(rs.rows[0]) : null;
}

export async function getById(id: number): Promise<Post | null> {
  await ready();
  const rs = await db.execute({
    sql: "SELECT * FROM posts WHERE id = ? LIMIT 1",
    args: [id],
  });
  return rs.rows[0] ? toPost(rs.rows[0]) : null;
}

export async function neighbours(post: Post) {
  await ready();
  const key = post.published_at ?? post.created_at;
  const [prev, next] = await Promise.all([
    db.execute({
      sql: `SELECT slug, title FROM posts WHERE published = 1 AND COALESCE(published_at, created_at) < ?
            ORDER BY COALESCE(published_at, created_at) DESC LIMIT 1`,
      args: [key],
    }),
    db.execute({
      sql: `SELECT slug, title FROM posts WHERE published = 1 AND COALESCE(published_at, created_at) > ?
            ORDER BY COALESCE(published_at, created_at) ASC LIMIT 1`,
      args: [key],
    }),
  ]);
  return {
    older: prev.rows[0] ? { slug: String(prev.rows[0].slug), title: String(prev.rows[0].title) } : null,
    newer: next.rows[0] ? { slug: String(next.rows[0].slug), title: String(next.rows[0].title) } : null,
  };
}

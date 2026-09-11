// One-off: copy every post from the local ./data/writ.db into the configured Turso
// database. Safe to re-run — posts are matched on slug.
import { createClient } from "@libsql/client";
import { existsSync } from "node:fs";

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("TURSO_DATABASE_URL is not set (run with --env-file=.env.local)");
if (!existsSync("./data/writ.db")) {
  console.log("No local ./data/writ.db — nothing to copy.");
  process.exit(0);
}

const local = createClient({ url: "file:./data/writ.db" });
const remote = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

await remote.execute(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    subtitle TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    published INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    published_at TEXT
  );
`);
await remote.execute(
  "CREATE INDEX IF NOT EXISTS posts_published_idx ON posts (published, published_at DESC)"
);

// Imports must stay imports on the other side, or they would show up as drafts.
for (const col of ["kind TEXT NOT NULL DEFAULT 'post'", "source TEXT NOT NULL DEFAULT ''"]) {
  try {
    await remote.execute(`ALTER TABLE posts ADD COLUMN ${col}`);
  } catch (e) {
    if (!/duplicate column/i.test(String(e))) throw e;
  }
}

const { rows } = await local.execute("SELECT * FROM posts ORDER BY id");
let copied = 0;
for (const r of rows) {
  const res = await remote.execute({
    sql: `INSERT INTO posts (slug, title, subtitle, content, published, created_at, updated_at, published_at, kind, source)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(slug) DO NOTHING`,
    args: [
      r.slug, r.title, r.subtitle, r.content, r.published,
      r.created_at, r.updated_at, r.published_at, r.kind ?? "post", r.source ?? "",
    ],
  });
  if (res.rowsAffected > 0) copied++;
}

const total = await remote.execute("SELECT COUNT(*) AS n FROM posts");
console.log(`copied ${copied} of ${rows.length} local post(s); Turso now holds ${total.rows[0].n}`);

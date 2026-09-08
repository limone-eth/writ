import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:./data/writ.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await db.execute(`
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

const now = new Date().toISOString();
const body = `Most writing tools are built for *editing*. This one is built for the twenty minutes before editing exists, when the only thing that matters is that the words keep coming.

## What it does

- One password. No accounts, no invites, no team.
- Markdown, with the shortcuts you already have in your fingers.
- Four typefaces: **Lato**, **Arial**, **System**, **Serif**.
- Light and dark, following your system unless you tell it otherwise.

## What it doesn't do

There is no comment section. There is no analytics dashboard telling you that fourteen people bounced. There is no newsletter modal.

> The tool should disappear. If you are thinking about the tool, the tool has failed.

Press \`⌘B\`, \`⌘I\`, \`⌘K\` while you write. Everything saves itself. Move the mouse away and the interface fades out, leaving you with a page.

That's the whole thing.`;

await db.execute({
  sql: `INSERT OR IGNORE INTO posts (slug, title, subtitle, content, published, created_at, updated_at, published_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
  args: ["a-place-to-put-words", "A place to put words", "Why this blog has exactly one feature.", body, now, now, now],
});

console.log("seeded");

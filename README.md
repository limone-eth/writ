# writ

A single-author blog. One password, a distraction-free markdown editor, and a reading
experience that gets out of the way.

Reading layout borrows from [article.app](https://article.app); the editor borrows from
Farza's [Freewrite](https://github.com/farzaa/freewrite) — same four typefaces, same
chrome that fades away while you type.

## Features

- **Public**: article list (`/`) and article page (`/p/<slug>`), reading progress bar,
  prev/next navigation, sitemap + robots.
- **Reader controls** (`Aa` in the header): Light / Dark / Auto, four typefaces
  (Lato, Arial, System, Serif), five text sizes. Stored per browser, applied before
  first paint so there's no flash.
- **Editor** (`/admin/<id>`): a WYSIWYG surface, not a textarea. Type `## `, `**bold**`,
  `- ` or `> ` and the markup resolves into real formatting as you type — you never see
  the asterisks. It renders through the same `.prose` styles as the published article,
  so the editor *is* the preview. `⌘B` / `⌘I` / `⌘S`, full undo/redo, a toolbar with live
  active states, inline link entry, autosave, word count, publish/unpublish, delete.
  Markdown remains the storage format: TipTap parses it in and serialises it back out.
- **Import to read** (`/admin/import`): paste a link, text or HTML, or drop a PDF, and it
  comes back as one clean article in a private **Library** on the Desk, read in the same
  layout as a post (outline, progress bar, theme). The source is turned into rough Markdown
  (links are fetched directly, then through [Jina Reader](https://jina.ai/reader) when a
  publisher blocks servers; PDFs through their text layer), cut at headings into parts,
  and each part is rewritten by a model on OpenRouter in parallel: site chrome and PDF
  debris out, every sentence kept. A 30,000-word paper takes a minute or two. Imports are
  read-only, never published, and 404 for everyone but you.
- **Auth**: one password from an env var, an HMAC-signed httpOnly session cookie,
  30-day expiry. No user table, no signup route.
- Mobile responsive throughout.

## Setup

```bash
npm install
cp .env.example .env.local     # then edit it
npm run dev
```

`.env.local`:

| Variable | Purpose |
| --- | --- |
| `AUTH_PASSWORD` | The password you type on `/login`. Required. |
| `SESSION_SECRET` | Signs the session cookie. `openssl rand -hex 32`. Required in production. |
| `TURSO_DATABASE_URL` | Optional. Omit and it uses `./data/writ.db` locally. |
| `TURSO_AUTH_TOKEN` | Token for the Turso database. |
| `NEXT_PUBLIC_SITE_NAME` | Shown in the header and `<title>`. |
| `NEXT_PUBLIC_SITE_TAGLINE` | One line under the header on the list page. |
| `NEXT_PUBLIC_SITE_URL` | Used by `sitemap.xml`. |
| `OPENROUTER_API_KEY` | Needed for imports. |
| `OPENROUTER_MODEL` | Optional. Defaults to `openai/gpt-5.6-luna`. |
| `JINA_API_KEY` | Optional. Raises Jina Reader's rate limit for link imports. |

The `posts` table is created on first query, so there is no migration step.
`npm run seed` drops in a sample post.

### Turso

This blog runs on the Turso database `writ` (group `default`, `aws-eu-west-1`), created
with the Turso CLI:

```bash
turso db create writ --group default
turso db show writ --url            # -> TURSO_DATABASE_URL
turso db tokens create writ         # -> TURSO_AUTH_TOKEN
```

Leave both unset and the app falls back to `./data/writ.db`, which is handy for offline
work. `npm run db:push-local` copies anything written to that local file up into Turso
(matched on slug, so it is safe to re-run).

Inspect the live data with `turso db shell writ`.

## Writing

1. `/login`, enter the password.
2. **Desk** (`/admin`) lists drafts and published posts. **New** opens a blank one.
3. Write. It saves itself ~1s after you stop typing; `⌘S` forces it.
4. **Publish** puts it on the front page. The slug is generated from the title and then
   frozen, so publishing twice never breaks a link.

Unpublished posts are readable at their URL while you're signed in, marked
*Draft preview*, and 404 for everyone else.

## Deploying

Set the four required env vars — `AUTH_PASSWORD`, `SESSION_SECRET`, `TURSO_DATABASE_URL`,
`TURSO_AUTH_TOKEN` — and deploy. Every route that touches the database is `force-dynamic`, so no build-time
database access is needed.

## Stack

Next.js 15 (App Router, server actions) · React 19 · Tailwind v4 · libSQL/Turso ·
TipTap 3 + tiptap-markdown (editor) · react-markdown + remark-gfm (published pages).
No client-side state library, no auth library, no CMS.

/**
 * Site identity, in one place. Safe to import from client components: every
 * value here comes from a NEXT_PUBLIC_ variable, inlined at build time.
 */

export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Simone Staffa";

export const SITE_TAGLINE =
  process.env.NEXT_PUBLIC_SITE_TAGLINE || "notes, essays, half-thoughts";

/**
 * Public origin, used for the absolute URLs that link previews and the
 * sitemap need. Falls back to the Vercel production domain, then to local.
 */
const vercelHost =
  process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (vercelHost ? `https://${vercelHost}` : "http://localhost:3000");

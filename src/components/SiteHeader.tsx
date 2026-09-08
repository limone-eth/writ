import Link from "next/link";
import ReaderSettings from "./ReaderSettings";

export default function SiteHeader({
  authed,
  back,
}: {
  authed: boolean;
  back?: { href: string; label: string };
}) {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "writ";

  return (
    <header className="sticky top-0 z-40 border-b border-rule-soft bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[var(--measure)] items-center justify-between gap-4 px-5 sm:px-0">
        {back ? (
          <Link
            href={back.href}
            className="-ml-1.5 flex items-center gap-1.5 rounded-md px-1.5 py-2 text-[13px] text-ink-soft transition-colors duration-150 hover:text-ink"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {back.label}
          </Link>
        ) : (
          <Link
            href="/"
            className="text-[15px] font-bold tracking-tight text-ink transition-opacity hover:opacity-70"
          >
            {siteName}
          </Link>
        )}

        <div className="flex items-center gap-1">
          {authed && (
            <Link
              href="/admin"
              className="rounded-full px-2.5 py-2 text-[13px] text-ink-soft transition-colors duration-150 hover:bg-rule-soft hover:text-ink"
            >
              Desk
            </Link>
          )}
          <ReaderSettings />
        </div>
      </div>
    </header>
  );
}

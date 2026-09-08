import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-[15px] font-bold tracking-tight">Nothing here.</p>
      <Link href="/" className="text-[14px] text-ink-faint underline underline-offset-4 transition-colors hover:text-ink">
        Back to the blog
      </Link>
    </main>
  );
}

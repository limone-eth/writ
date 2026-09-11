import SiteHeader from "@/components/SiteHeader";
import ImportForm from "@/components/ImportForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import" };

export default function ImportPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader authed back={{ href: "/admin", label: "Desk" }} />
      <main className="mx-auto max-w-[var(--measure)] px-5 pb-24 sm:px-0">
        <div className="rise py-12 sm:py-16">
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">Import to read</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            A link, pasted text or HTML, or a PDF. It comes back as one clean article in your library,
            with its outline, set like everything else here. Only you can see it.
          </p>
          <ImportForm />
        </div>
      </main>
    </div>
  );
}

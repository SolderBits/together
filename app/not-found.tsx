import { PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <PageShell width="narrow" className="py-28">
      <div className="rounded-4xl ring-1 ring-inset ring-line bg-surface p-10 text-center shadow-sm">
        <p className="t-h1 text-ink">404</p>
        <h1 className="t-h2 mt-4 text-ink">This one got away</h1>
        <p className="mx-auto mt-3 max-w-sm text-[14.5px] leading-relaxed text-ink-muted">
          That page doesn&rsquo;t exist. If you were following an invite link, check it was copied
          in one piece.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/" size="lg">All experiences</ButtonLink>
          <ButtonLink href="/hub" size="lg" variant="secondary">
            Your hub
          </ButtonLink>
        </div>
      </div>
    </PageShell>
  );
}

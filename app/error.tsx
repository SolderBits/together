"use client";

import { useEffect } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { Button, ButtonLink } from "@/components/ui/button";

/**
 * The net under every route.
 *
 * Most of what this app keeps lives in browser storage, which means a document
 * written by an older build can deserialise into a shape a component doesn't
 * expect. Without a boundary that takes the whole page down to an unstyled
 * browser error. Here it stays inside the product, and "Try again" re-renders
 * without a full reload.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageShell width="narrow" className="py-24 sm:py-32">
      <div className="rounded-4xl bg-surface p-10 text-center shadow-sm ring-1 ring-inset ring-line sm:p-14">
        <span
          className="mx-auto mb-7 grid h-16 w-16 place-items-center rounded-pill bg-blush-tint text-[26px]"
          aria-hidden="true"
        >
          🫧
        </span>
        <h1 className="t-h2 text-ink">That came apart</h1>
        <p className="t-body mx-auto mt-4 max-w-[42ch] text-[15px]">
          Something on this page stopped working. Nothing you&rsquo;ve saved is affected —
          it all lives on your device.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={reset}>
            Try again
          </Button>
          <ButtonLink href="/" size="lg" variant="secondary">
            All experiences
          </ButtonLink>
        </div>
      </div>
    </PageShell>
  );
}

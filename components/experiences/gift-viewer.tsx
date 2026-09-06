"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { decodeGift, isRevealed } from "@/lib/gift-link";
import { getGift } from "@/lib/store";
import type { GiftPage } from "@/lib/store/types";
import { formatDate, relativeFromNow } from "@/lib/utils";

/**
 * Opens a gift from the URL fragment when there is one, and otherwise from
 * this device's own store — so a shared link works on a phone that has never
 * seen the app before.
 */
export function GiftViewer({ giftId }: { giftId: string }) {
  const [gift, setGift] = useState<GiftPage | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [peeked, setPeeked] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const fromLink = hash ? decodeGift(hash) : null;
    setGift(fromLink ?? getGift(giftId));
    setLoaded(true);
  }, [giftId]);

  const sealed = useMemo(() => (gift ? !isRevealed(gift) && !peeked : false), [gift, peeked]);

  if (!loaded) {
    return (
      <PageShell width="narrow" className="py-28 text-center">
        <span className="mx-auto block h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-ink" />
      </PageShell>
    );
  }

  if (!gift) {
    return (
      <PageShell width="narrow" className="py-24">
        <div className="rounded-4xl ring-1 ring-inset ring-line bg-surface p-9 text-center shadow-sm">
          <h1 className="t-h2 text-ink">This gift isn&rsquo;t here</h1>
          <p className="mx-auto mt-3 max-w-sm text-[14.5px] leading-relaxed text-ink-muted">
            The link may be incomplete — gift pages carry their contents in the part of the URL
            after the <code className="font-mono">#</code>, so it has to be copied whole.
          </p>
          <ButtonLink href="/play/birthday-gift" className="mt-7">
            Make one instead
          </ButtonLink>
        </div>
      </PageShell>
    );
  }

  if (sealed) {
    return (
      <PageShell width="narrow" className="py-24">
        <div
          className="rounded-4xl ring-1 ring-inset ring-line p-12 text-center shadow-sm"
          style={{ backgroundImage: "linear-gradient(140deg,#ffe9f0,#f0ecff 55%,#e2effd)" }}
        >
          <span className="mx-auto grid h-20 w-20 animate-sway place-items-center rounded-4xl bg-white/70 text-[34px]">
            🎁
          </span>
          <h1 className="t-h1 mt-8 text-ink">
            Not yet, {gift.recipient}
          </h1>
          <p className="t-body mx-auto mt-5 max-w-[38ch] text-[15.5px] text-ink-soft">
            {gift.sender} sealed this until {formatDate(gift.revealOn)} — that&rsquo;s{" "}
            {relativeFromNow(gift.revealOn)}.
          </p>
          <Button variant="secondary" className="mt-8" onClick={() => setPeeked(true)}>
            Peek anyway
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell width="narrow" className="pb-24 pt-12">
      <div className="animate-fade-up text-center">
        {peeked && !isRevealed(gift) && (
          <div className="mb-6 flex justify-center">
            <Pill tone="warn">You opened this early. It&rsquo;s between you and them.</Pill>
          </div>
        )}
        <p className="t-eyebrow">
          For {gift.recipient}
        </p>
        <h1 className="t-display mt-5 text-balance text-ink">
          {gift.title}
        </h1>
      </div>

      <div className="mt-10 rounded-4xl ring-1 ring-inset ring-line bg-surface p-8 shadow-sm sm:p-10">
        <p className="whitespace-pre-wrap text-[16px] leading-relaxed text-ink-soft">
          {gift.message}
        </p>
        <p className="t-serif mt-9 text-right text-[19px] text-ink">— {gift.sender}</p>
      </div>

      {gift.photos.length > 0 && (
        <section className="mt-10">
          <p className="mb-4 t-eyebrow">
            Photos
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gift.photos.map((photo, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setLightbox(photo)}
                className="overflow-hidden rounded-[20px] ring-1 ring-inset ring-line transition-transform hover:scale-[1.02]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo}
                  alt={`Photo ${i + 1}`}
                  className="aspect-square w-full object-cover"
                />
              </button>
            ))}
          </div>
        </section>
      )}

      {gift.memories.length > 0 && (
        <section className="mt-10">
          <p className="mb-4 t-eyebrow">
            Memories
          </p>
          <div className="space-y-3">
            {gift.memories.map((memory) => (
              <div key={memory.id} className="rounded-3xl ring-1 ring-inset ring-line bg-surface p-5 shadow-sm">
                <p className="text-[15px] font-bold text-ink">{memory.title}</p>
                {memory.detail && (
                  <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">
                    {memory.detail}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-12 text-center">
        <ButtonLink href="/" variant="secondary">
          See what else is here
        </ButtonLink>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgba(17,17,20,0.8)] p-6"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Photo"
            className="max-h-[86vh] max-w-full rounded-3xl object-contain"
          />
        </div>
      )}
    </PageShell>
  );
}

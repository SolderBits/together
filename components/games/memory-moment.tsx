"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The end of a round.
 *
 * Three choices, always in the same order, on every experience: keep it, do it
 * again, or go and do something else. Saving is offered rather than pushed —
 * and when it happens it's acknowledged once, quietly, rather than with a
 * modal.
 */
export function MemoryMoment({
  extra,
  onSave,
  onAgain,
  againLabel = "Go again",
  saveLabel = "Keep this",
  savedLabel = "Saved to your story",
  className,
}: {
  /** An action specific to this experience — a download, an export — shown first. */
  extra?: React.ReactNode;
  onSave?: () => void;
  onAgain: () => void;
  againLabel?: string;
  saveLabel?: string;
  savedLabel?: string;
  className?: string;
}) {
  const [saved, setSaved] = useState(false);

  return (
    <div className={cn("flex flex-col items-center gap-5", className)}>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {extra}
        {onSave && (
          <Button
            size="xl"
            variant="secondary"
            disabled={saved}
            onClick={() => {
              onSave();
              setSaved(true);
            }}
          >
            {saved ? savedLabel : saveLabel}
          </Button>
        )}
        <Button size="xl" onClick={onAgain}>
          {againLabel}
        </Button>
      </div>

      <div className="flex items-center gap-4 text-[13.5px]">
        {saved && (
          <span className="a-fade flex items-center gap-1.5 font-semibold text-mint-deep">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m5 12.5 4.6 4.5L19 7" />
            </svg>
            It&rsquo;s in your hub
          </span>
        )}
        <ButtonLink href="/" variant="ghost" size="sm">
          Something else
        </ButtonLink>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { composeStrip, type StripSpec } from "@/lib/media/photo-strip";
import { cn } from "@/lib/utils";

/** Renders a composed strip and hands the data URL back for saving/downloading. */
export function PhotoStrip({
  spec,
  width = 900,
  className,
  onComposed,
}: {
  spec: StripSpec;
  width?: number;
  className?: string;
  onComposed?: (dataUrl: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    composeStrip(spec, width)
      .then((dataUrl) => {
        if (cancelled) return;
        setUrl(dataUrl);
        setError(null);
        onComposed?.(dataUrl);
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(spec), width]);

  if (error) {
    return (
      <div className={cn("rounded-3xl ring-1 ring-inset ring-line bg-surface p-6 text-center", className)}>
        <p className="text-[13.5px] text-ink-muted">{error}</p>
      </div>
    );
  }

  if (!url) {
    return (
      <div
        className={cn("animate-pulse rounded-3xl bg-surface-muted", className)}
        style={{ aspectRatio: "1 / 3" }}
        aria-hidden="true"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Your photo strip"
      className={cn("w-full rounded-3xl ring-1 ring-inset ring-line shadow-sm", className)}
    />
  );
}

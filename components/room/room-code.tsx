"use client";

import { useState } from "react";
import { copyText, cn } from "@/lib/utils";

/**
 * The code is the product's handshake, so it is typeset like one: wide
 * letter-spacing, split into two triples, and copyable in a single tap.
 */
export function RoomCode({
  code,
  size = "md",
  className,
}: {
  code: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (await copyText(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  if (size === "lg") {
    return (
      <button
        type="button"
        onClick={copy}
        title="Copy room code"
        className={cn("group/code block w-full text-center", className)}
      >
        <span className="flex items-center justify-center gap-2 sm:gap-3">
          {code.split("").map((char, i) => (
            <span
              key={i}
              className={cn(
                "grid h-[54px] w-[42px] place-items-center rounded-sm bg-surface text-[24px] font-extrabold tracking-normal text-ink",
                "ring-1 ring-inset ring-line shadow-xs transition-all duration-300 ease-out",
                "group-hover/code:-translate-y-[3px] group-hover/code:shadow-sm sm:h-[64px] sm:w-[50px] sm:text-[28px]",
                i === 3 && "ml-2 sm:ml-4",
              )}
              style={{ transitionDelay: `${i * 28}ms` }}
            >
              {char}
            </span>
          ))}
        </span>
        <span className="mt-4 block text-[13px] font-semibold text-ink-faint transition-colors group-hover/code:text-ink">
          {copied ? "Copied" : "Tap to copy"}
        </span>
      </button>
    );
  }

  const sizes = {
    sm: "h-8 px-3 text-[12.5px] tracking-[0.18em]",
    md: "h-10 px-4 text-[15px] tracking-[0.22em]",
  } as const;

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy room code"
      className={cn(
        "group/code inline-flex items-center gap-2.5 rounded-pill bg-surface font-mono font-bold text-ink",
        "ring-1 ring-inset ring-line shadow-xs transition-all duration-200 ease-out",
        "hover:-translate-y-[1px] hover:shadow-sm hover:ring-line-strong",
        sizes[size],
        className,
      )}
    >
      <span>{code}</span>
      <span className="text-ink-faint transition-colors group-hover/code:text-ink">
        {copied ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 12.5 4.6 4.5L19 7" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="8.5" y="8.5" width="12" height="12" rx="3" />
            <path d="M15.5 5.5A2 2 0 0 0 13.5 3.5h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2" />
          </svg>
        )}
      </span>
    </button>
  );
}

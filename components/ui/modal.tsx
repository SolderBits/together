"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Sheet on mobile, centred dialog on desktop. One close affordance, generous
 * padding, and a soft warm scrim rather than a hard black one.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // Remember where focus came from so it can be put back.
    returnFocusTo.current = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    // Move into the dialog. Prefer the first real control over the close button,
    // so a form opens with the cursor where someone would put it themselves.
    const first = focusable().find((el) => el.getAttribute("aria-label") !== "Close");
    (first ?? panelRef.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      // Keep Tab inside the dialog — otherwise it walks onto the page behind,
      // which is still there and still clickable to a keyboard user.
      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;

      if (!e.shiftKey && active === lastItem) {
        e.preventDefault();
        firstItem.focus();
      } else if (e.shiftKey && (active === firstItem || active === panelRef.current)) {
        e.preventDefault();
        lastItem.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      returnFocusTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: "sm:max-w-[420px]", md: "sm:max-w-[560px]", lg: "sm:max-w-[880px]" };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-8">
      {/* The scrim closes the dialog on click, but it is not a control anyone
          needs announced or tabbed to — the close button below is. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="a-fade absolute inset-0 cursor-default bg-[rgba(28,24,18,0.34)] backdrop-blur-[3px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "a-scale relative flex w-full max-h-[92vh] flex-col overflow-hidden rounded-t-[32px] bg-surface shadow-pop",
          "sm:rounded-[32px]",
          widths[size],
        )}
      >
        {/* grab handle, mobile only */}
        <div className="flex justify-center pt-3 sm:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-pill bg-line-strong" />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-pill text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink sm:right-5 sm:top-5"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>

        <div className="scroll-slim overflow-y-auto px-6 pb-8 pt-7 sm:px-9 sm:pb-9 sm:pt-10">
          {title && <h2 className="t-h2 pr-10 text-ink">{title}</h2>}
          {description && (
            <p className="t-body-sm mt-3 max-w-prose">{description}</p>
          )}
          {children && <div className={cn(title && "mt-8")}>{children}</div>}
        </div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface-muted/70 px-6 py-4 sm:px-9 sm:py-5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "soft" | "ghost" | "tinted" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

/**
 * One button. Every affordance in the product is this, so press feel, focus and
 * motion are defined in exactly one place.
 */
const BASE =
  "group/btn relative inline-flex select-none items-center justify-center whitespace-nowrap font-semibold " +
  "transition-[transform,box-shadow,background-color,color,border-color] duration-200 ease-out " +
  "active:translate-y-[1px] active:duration-75 " +
  // A disabled control should read as "not yet", not as a grey slab.
  "disabled:pointer-events-none disabled:bg-surface-sunken disabled:text-ink-faint " +
  "disabled:shadow-none disabled:ring-0 disabled:translate-y-0";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-ink text-ink-inverse shadow-sm hover:-translate-y-[2px] hover:shadow-card-hover",
  secondary:
    "bg-surface text-ink ring-1 ring-inset ring-line shadow-xs hover:-translate-y-[2px] hover:shadow-card hover:ring-line-strong",
  soft: "bg-surface-sunken text-ink hover:bg-[#e9e4db]",
  ghost: "bg-transparent text-ink-muted hover:bg-surface-sunken hover:text-ink",
  tinted:
    "text-[color:var(--accent-deep,var(--text))] shadow-xs hover:-translate-y-[2px] hover:shadow-card",
  danger: "bg-[#fbe6e4] text-[#a5322a] hover:bg-[#f7dbd8]",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 gap-1.5 rounded-pill px-4 text-[13px] tracking-[-0.01em]",
  md: "h-11 gap-2 rounded-pill px-5 text-[14px] tracking-[-0.012em]",
  lg: "h-[52px] gap-2.5 rounded-pill px-7 text-[15px] tracking-[-0.015em]",
  xl: "h-[60px] gap-3 rounded-pill px-9 text-[16.5px] tracking-[-0.018em]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  /** Applies a pastel accent to the `tinted` variant. */
  accent?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", block, accent, className, style, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(BASE, VARIANTS[variant], SIZES[size], block && "w-full", className)}
      style={
        variant === "tinted" && accent
          ? ({
              backgroundColor: `var(--${accent}-tint)`,
              "--accent-deep": `var(--${accent}-deep)`,
              ...style,
            } as React.CSSProperties)
          : style
      }
      {...props}
    />
  );
});

export function ButtonLink({
  variant = "primary",
  size = "md",
  block,
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size; block?: boolean }) {
  return (
    <Link
      className={cn(BASE, VARIANTS[variant], SIZES[size], block && "w-full", className)}
      {...props}
    />
  );
}

/** Square icon control for toolbars. */
export function IconButton({
  label,
  active,
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "grid place-items-center rounded-sm transition-all duration-200 ease-out active:translate-y-[1px]",
        size === "sm" ? "h-9 w-9" : "h-11 w-11",
        active
          ? "bg-ink text-ink-inverse shadow-sm"
          : "bg-transparent text-ink-muted ring-1 ring-inset ring-line hover:bg-surface hover:text-ink hover:ring-line-strong",
        className,
      )}
      {...props}
    />
  );
}

/** Text link with a hairline that grows on hover. */
export function QuietLink({
  className,
  ...props
}: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "group/ql inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink-muted transition-colors hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}

import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The product name lives here and in `lib/site.ts` only — rename in one place.
 *
 * The mark is two overlapping rings: two people, one overlap. Drawn rather than
 * filled so it sits comfortably next to heavy type.
 */
export function BrandMark({ className, size = 30 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn("relative grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" width={size} height={size} fill="none">
        <circle cx="12.5" cy="16" r="8.6" stroke="var(--text)" strokeWidth="2.4" />
        <circle cx="19.5" cy="16" r="8.6" stroke="var(--text)" strokeWidth="2.4" />
        <path
          d="M16 8.6a8.6 8.6 0 0 0 0 14.8 8.6 8.6 0 0 0 0-14.8Z"
          fill="var(--blush-mid)"
          fillOpacity="0.85"
        />
      </svg>
    </span>
  );
}

export function BrandLockup({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("group/brand flex items-center gap-2.5 rounded-sm", className)}
      aria-label="Together — home"
    >
      <span className="transition-transform duration-[420ms] ease-spring group-hover/brand:rotate-[-8deg]">
        <BrandMark />
      </span>
      <span className="text-[19px] font-extrabold tracking-[-0.04em] text-ink">Together</span>
    </Link>
  );
}

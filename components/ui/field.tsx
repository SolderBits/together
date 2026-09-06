import { cn } from "@/lib/utils";

/**
 * Inputs read as quiet sunken wells rather than boxed form controls — a
 * hairline ring, a warm fill, and a clear ink ring on focus.
 */
const FIELD =
  "w-full rounded-sm bg-surface-muted px-4 py-3.5 text-[15px] text-ink " +
  "ring-1 ring-inset ring-transparent transition-all duration-200 ease-out " +
  "placeholder:text-ink-faint hover:bg-surface-sunken " +
  "focus:bg-surface focus:outline-none focus:ring-[1.5px] focus:ring-ink/85 " +
  "disabled:opacity-50";

export function TextField({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, className)} {...props} />;
}

export function TextArea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD, "resize-y leading-[1.62]", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(FIELD, "appearance-none pr-10", className)} {...props} />;
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("t-eyebrow mb-2.5 block", className)} {...props} />;
}

/** Checkbox styled to match the ink-on-warm system. */
export function Check({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label
      className={cn(
        "group/ck flex cursor-pointer select-none items-center gap-3 text-[14px] font-medium text-ink-soft",
        className,
      )}
    >
      <span className="relative grid h-[22px] w-[22px] shrink-0 place-items-center">
        <input type="checkbox" className="peer sr-only" {...props} />
        <span className="absolute inset-0 rounded-[7px] bg-surface-sunken ring-1 ring-inset ring-line transition-all duration-200 peer-checked:bg-ink peer-checked:ring-ink" />
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="relative h-3 w-3 text-ink-inverse opacity-0 transition-opacity duration-200 peer-checked:opacity-100"
          aria-hidden="true"
        >
          <path d="m5 12.5 4.6 4.5L19 7" />
        </svg>
      </span>
      {label}
    </label>
  );
}

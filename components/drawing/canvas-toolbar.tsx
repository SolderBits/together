"use client";

import { IconButton } from "@/components/ui/button";
import { BRUSH_COLORS, BRUSH_SIZES, type StrokeMode } from "./types";
import { cn } from "@/lib/utils";

/**
 * A floating pill of tools rather than a strip of form controls. Grouped
 * pen/eraser, weight, colour, undo/clear — separated by hairlines.
 */
export function CanvasToolbar({
  color,
  onColor,
  size,
  onSize,
  mode,
  onMode,
  onUndo,
  onClear,
  disabled,
  colors = BRUSH_COLORS,
  className,
  children,
}: {
  color: string;
  onColor: (c: string) => void;
  size: number;
  onSize: (s: number) => void;
  mode: StrokeMode;
  onMode: (m: StrokeMode) => void;
  onUndo: () => void;
  onClear: () => void;
  disabled?: boolean;
  colors?: string[];
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-[26px] bg-surface p-2.5 shadow-card ring-1 ring-inset ring-line",
        disabled && "pointer-events-none opacity-45",
        className,
      )}
    >
      <div className="flex items-center gap-1">
        <IconButton label="Pen" size="sm" active={mode === "pen"} onClick={() => onMode("pen")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3.2 20.8 4 17l10.4-10.4 3 3L7 20l-3.8.8Z" />
            <path d="m16.6 4.4 1.6-1.6a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8l-1.6 1.6Z" />
          </svg>
        </IconButton>
        <IconButton
          label="Eraser"
          size="sm"
          active={mode === "eraser"}
          onClick={() => onMode("eraser")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m8.6 20.5-5-5a2 2 0 0 1 0-2.9l8.5-8.5a2 2 0 0 1 2.9 0l5 5a2 2 0 0 1 0 2.9l-8.5 8.5Z" />
            <path d="M20.5 20.5h-12" />
          </svg>
        </IconButton>
      </div>

      <span className="h-6 w-px bg-line" aria-hidden="true" />

      <div className="flex items-center gap-0.5" role="group" aria-label="Brush size">
        {BRUSH_SIZES.map((option) => (
          <button
            key={option.label}
            type="button"
            title={option.label}
            aria-label={option.label}
            aria-pressed={size === option.value}
            onClick={() => onSize(option.value)}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-sm transition-colors duration-200",
              size === option.value ? "bg-surface-sunken" : "hover:bg-surface-muted",
            )}
          >
            <span
              className={cn(
                "rounded-full transition-colors",
                size === option.value ? "bg-ink" : "bg-ink-faint",
              )}
              style={{
                width: Math.max(4, option.value * 105),
                height: Math.max(4, option.value * 105),
              }}
            />
          </button>
        ))}
      </div>

      <span className="h-6 w-px bg-line" aria-hidden="true" />

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Colour">
        {colors.map((c) => {
          const active = color === c && mode === "pen";
          return (
            <button
              key={c}
              type="button"
              title={c}
              aria-label={`Colour ${c}`}
              aria-pressed={active}
              onClick={() => {
                onColor(c);
                onMode("pen");
              }}
              className={cn(
                "relative grid h-8 w-8 place-items-center rounded-pill transition-transform duration-200 ease-spring",
                active ? "scale-110" : "hover:scale-105",
              )}
            >
              <span
                className={cn(
                  "h-6 w-6 rounded-pill ring-1 ring-inset",
                  c.toLowerCase() === "#ffffff" ? "ring-line-strong" : "ring-black/10",
                )}
                style={{ backgroundColor: c }}
              />
              {active && (
                <span className="absolute inset-0 rounded-pill ring-2 ring-ink ring-offset-2 ring-offset-[color:var(--surface)]" />
              )}
            </button>
          );
        })}
      </div>

      <span className="h-6 w-px bg-line" aria-hidden="true" />

      <div className="flex items-center gap-1">
        <IconButton label="Undo" size="sm" onClick={onUndo}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9h9.5a5.5 5.5 0 0 1 0 11H8" />
            <path d="M7.5 5.5 4 9l3.5 3.5" />
          </svg>
        </IconButton>
        <IconButton label="Clear canvas" size="sm" onClick={onClear}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4.5 6.5h15M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7" />
            <path d="M6.5 6.5 7.4 19a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9l.9-12.5" />
          </svg>
        </IconButton>
      </div>

      {children}
    </div>
  );
}

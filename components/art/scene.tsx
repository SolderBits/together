import type { SVGProps } from "react";

/**
 * Shared chrome for every illustration.
 *
 * The scenes are flat pastel shapes with a warm ink outline, drawn on one grid
 * so the whole set reads as a single hand. `tint` / `mid` / `deep` are the
 * experience's own pastel triple, which is what gives each card its identity
 * without breaking the system.
 */
export interface SceneProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  tint?: string;
  mid?: string;
  deep?: string;
}

export const INK = "#16140f";

export function Scene({
  children,
  className,
  ...props
}: SceneProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 200 150"
      fill="none"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <g
        stroke={INK}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      >
        {children}
      </g>
    </svg>
  );
}

/** Loose confetti marks used to break up empty corners. */
export function Sparks({
  points,
  color = INK,
}: {
  points: [number, number, number?][];
  color?: string;
}) {
  return (
    <>
      {points.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r ?? 2.4} fill={color} stroke="none" />
      ))}
    </>
  );
}

export function Twinkle({ x, y, s = 6, color = INK }: { x: number; y: number; s?: number; color?: string }) {
  return (
    <path
      d={`M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s} Z`}
      fill={color}
      stroke="none"
    />
  );
}

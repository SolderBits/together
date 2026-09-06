"use client";

import { useMemo } from "react";
import type { TreeProgress } from "@/lib/games/connection-tree";
import { mulberry32 } from "@/lib/utils";

interface Branch {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  depth: number;
}

/**
 * The tree is generated, not drawn by hand: depth comes from the stage level and
 * leaf density from how many different experiences have been tried, so the same
 * progress always renders the same tree.
 */
function grow(progress: TreeProgress) {
  const rand = mulberry32(1337);
  // Vision-board sessions literally add branches.
  const maxDepth = Math.min(7, 1 + progress.stage.level + (progress.ornaments.branches > 0 ? 1 : 0));
  const branches: Branch[] = [];
  const leaves: { x: number; y: number; r: number; hue: number }[] = [];
  const tips: { x: number; y: number }[] = [];

  function branch(
    x: number,
    y: number,
    angle: number,
    length: number,
    width: number,
    depth: number,
  ) {
    const x2 = x + Math.cos(angle) * length;
    const y2 = y + Math.sin(angle) * length;
    branches.push({ x1: x, y1: y, x2, y2, width, depth });

    if (depth >= maxDepth) {
      tips.push({ x: x2, y: y2 });
      const leafCount = 1 + Math.round(progress.variety * 3);
      for (let i = 0; i < leafCount; i++) {
        leaves.push({
          x: x2 + (rand() - 0.5) * 16,
          y: y2 + (rand() - 0.5) * 16,
          r: 3.5 + rand() * 4.5,
          hue: rand(),
        });
      }
      return;
    }

    const spread = 0.42 + rand() * 0.3;
    const shrink = 0.72 + rand() * 0.1;
    branch(x2, y2, angle - spread, length * shrink, width * 0.7, depth + 1);
    branch(x2, y2, angle + spread, length * shrink, width * 0.7, depth + 1);
    if (depth < 2 && rand() > 0.55) {
      branch(x2, y2, angle + (rand() - 0.5) * 0.3, length * shrink * 0.9, width * 0.6, depth + 1);
    }
  }

  branch(150, 250, -Math.PI / 2, 52 + progress.stage.level * 4, 11, 0);

  /** Ornaments hang from the outermost tips, newest first. */
  const shuffledTips = tips.slice().sort((a, b) => a.y - b.y);
  const pick = (count: number, offset: number) =>
    Array.from({ length: Math.min(count, 8) }, (_, i) => shuffledTips[(i * 3 + offset) % Math.max(1, shuffledTips.length)]).filter(Boolean);

  return {
    branches,
    leaves,
    blossoms: pick(progress.ornaments.blossoms, 0),
    flowers: pick(progress.ornaments.flowers, 1),
    fruit: pick(progress.ornaments.leaves, 2),
  };
}

export function ConnectionTree({ progress }: { progress: TreeProgress }) {
  const { branches, leaves, blossoms, flowers, fruit } = useMemo(() => grow(progress), [progress]);
  const blossoming = progress.stage.level >= 6;
  const fruiting = progress.stage.level >= 7;

  return (
    <svg viewBox="0 0 300 280" className="w-full" role="img" aria-label={`Connection tree: ${progress.stage.name}`}>
      <defs>
        <linearGradient id="ground" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e7e7e2" />
          <stop offset="0.5" stopColor="#d8d8d1" />
          <stop offset="1" stopColor="#e7e7e2" />
        </linearGradient>
      </defs>

      <ellipse cx="150" cy="252" rx="86" ry="9" fill="url(#ground)" />

      {progress.stage.level === 0 ? (
        <>
          <ellipse cx="150" cy="243" rx="9" ry="12" fill="#8a6a4a" />
          <path d="M150 233c0-6 4-10 9-11-1 6-4 10-9 11Z" fill="#4fbd8f" />
        </>
      ) : (
        <g className="animate-sway" style={{ transformOrigin: "150px 250px" }}>
          {branches.map((b, i) => (
            <line
              key={i}
              x1={b.x1}
              y1={b.y1}
              x2={b.x2}
              y2={b.y2}
              stroke={b.depth < 2 ? "#6b4f36" : "#8a6a4a"}
              strokeWidth={Math.max(1.2, b.width)}
              strokeLinecap="round"
            />
          ))}
          {leaves.map((leaf, i) => (
            <circle
              key={i}
              cx={leaf.x}
              cy={leaf.y}
              r={leaf.r}
              fill={
                fruiting && leaf.hue > 0.86
                  ? "var(--blush-mid)"
                  : blossoming && leaf.hue > 0.7
                    ? "var(--blush-tint)"
                    : leaf.hue > 0.5
                      ? "var(--mint-deep)"
                      : "var(--mint-mid)"
              }
              opacity={0.72 + leaf.hue * 0.28}
            />
          ))}

          {/* photobooth strips become blossoms */}
          {blossoms.map((tip, i) => (
            <g key={`b${i}`} transform={`translate(${tip.x} ${tip.y})`}>
              {[0, 72, 144, 216, 288].map((deg) => (
                <ellipse
                  key={deg}
                  rx="3.4"
                  ry="1.9"
                  fill="var(--blush-mid)"
                  transform={`rotate(${deg}) translate(3.2 0)`}
                />
              ))}
              <circle r="1.7" fill="var(--butter-mid)" />
            </g>
          ))}

          {/* sealed letters become a rarer flower */}
          {flowers.map((tip, i) => (
            <g key={`f${i}`} transform={`translate(${tip.x} ${tip.y})`}>
              {[0, 60, 120, 180, 240, 300].map((deg) => (
                <ellipse
                  key={deg}
                  rx="3.8"
                  ry="2"
                  fill="var(--lilac-mid)"
                  transform={`rotate(${deg}) translate(3.6 0)`}
                />
              ))}
              <circle r="1.8" fill="var(--surface)" />
            </g>
          ))}

          {/* saved memories hang as small fruit */}
          {fruit.map((tip, i) => (
            <circle key={`r${i}`} cx={tip.x} cy={tip.y + 4} r="3.2" fill="var(--peach-mid)" />
          ))}
        </g>
      )}
    </svg>
  );
}

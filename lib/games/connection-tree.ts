import { EXPERIENCES } from "@/lib/experiences";
import type { CompletionRecord } from "@/lib/store/types";

/**
 * The Connection Tree.
 *
 * Deliberately not a measure of anything. It's a keepsake that reflects what
 * you've actually done together: quick games nudge it along, the slower and
 * more revealing experiences move it more, and the things you *keep* hang off
 * it as ornaments.
 */

/** Growth per completion. Higher = the experience asked more of you. */
export const GROWTH_WEIGHTS: Record<string, number> = {
  // quick play
  arcade: 1,
  "iq-duel": 1,
  "the-lab": 1,
  "riddle-night": 1,
  scrapbook: 1,
  "couples-hub": 0,

  // takes some nerve
  "truth-or-dare": 2,
  "snap-hunt": 2,
  debate: 2,
  "couples-court": 2,
  "draw-together": 2,
  photobooth: 2,
  "print-studio": 2,
  "watch-together": 2,

  // the ones that actually get somewhere
  "know-me": 3,
  "honest-cards": 3,
  "love-match": 3,
  "our-future": 3,
  letters: 3,
  "birthday-gift": 3,
};

export const DEFAULT_WEIGHT = 1;

export interface TreeStage {
  level: number;
  name: string;
  blurb: string;
  /** Growth points needed to reach this stage. */
  threshold: number;
}

export const TREE_STAGES: TreeStage[] = [
  { level: 0, name: "Seed", blurb: "Nothing planted yet. Finish anything to start it.", threshold: 0 },
  { level: 1, name: "Sprout", blurb: "First shoots. Barely there, definitely alive.", threshold: 2 },
  { level: 2, name: "Seedling", blurb: "Two leaves and some optimism.", threshold: 6 },
  { level: 3, name: "Sapling", blurb: "Standing on its own now.", threshold: 12 },
  { level: 4, name: "Young tree", blurb: "Branching out. Recognisably a tree.", threshold: 22 },
  { level: 5, name: "Full canopy", blurb: "Shade, birds, the works.", threshold: 36 },
  { level: 6, name: "In blossom", blurb: "Flowering. Slightly showing off.", threshold: 54 },
  { level: 7, name: "Bearing fruit", blurb: "The long game, paying out.", threshold: 78 },
];

/** Things you kept, which hang off the tree rather than growing it. */
export interface TreeOrnaments {
  /** Saved memories. */
  leaves: number;
  /** Photobooth strips. */
  blossoms: number;
  /** Vision-board sessions. */
  branches: number;
  /** Sealed letters. */
  flowers: number;
}

export interface TreeProgress {
  stage: TreeStage;
  next: TreeStage | null;
  /** Weighted growth points. */
  growth: number;
  /** Raw number of finished sessions. */
  total: number;
  unique: number;
  /** 0–1 progress toward the next stage. */
  toNext: number;
  /** 0–1 across the whole catalogue, used for leaf density. */
  variety: number;
  ornaments: TreeOrnaments;
  /** What moved the tree most, for the hub copy. */
  biggestContributor: { experienceId: string; growth: number } | null;
}

export function growthFor(experienceId: string) {
  return GROWTH_WEIGHTS[experienceId] ?? DEFAULT_WEIGHT;
}

export function computeTreeProgress(
  completions: CompletionRecord[],
  ornaments: TreeOrnaments = { leaves: 0, blossoms: 0, branches: 0, flowers: 0 },
): TreeProgress {
  const total = completions.reduce((sum, c) => sum + c.count, 0);
  const unique = completions.length;

  const contributions = completions.map((c) => ({
    experienceId: c.experienceId,
    growth: c.count * growthFor(c.experienceId),
  }));
  const growth = contributions.reduce((sum, c) => sum + c.growth, 0);

  let stage = TREE_STAGES[0];
  for (const candidate of TREE_STAGES) {
    if (growth >= candidate.threshold) stage = candidate;
  }
  const next = TREE_STAGES.find((s) => s.threshold > growth) ?? null;
  const span = next ? next.threshold - stage.threshold : 1;
  const toNext = next ? Math.min(1, (growth - stage.threshold) / span) : 1;

  const biggestContributor =
    contributions.length > 0
      ? contributions.reduce((best, c) => (c.growth > best.growth ? c : best))
      : null;

  return {
    stage,
    next,
    growth,
    total,
    unique,
    toNext,
    variety: Math.min(1, unique / EXPERIENCES.length),
    ornaments,
    biggestContributor,
  };
}

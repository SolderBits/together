import type { ComponentType, SVGProps } from "react";
import type { SceneId } from "@/components/art/scenes";
import {
  IconArcade,
  IconBooth,
  IconBrain,
  IconCards,
  IconCompass,
  IconDebate,
  IconDice,
  IconDraw,
  IconDuel,
  IconFlask,
  IconGavel,
  IconGift,
  IconHeartLink,
  IconLetter,
  IconRiddle,
  IconScrapbook,
  IconShirt,
  IconSnap,
  IconTree,
} from "@/components/ui/icons";

export type ExperienceSection = "main" | "more";
export type PlayMode = "room" | "standalone";

/** The six pastels an experience can own. Defined in globals.css. */
export type Palette = "blush" | "sky" | "lilac" | "butter" | "mint" | "peach";

/**
 * Card footprint on the experience grid. The mix is what stops the grid
 * reading as a wall of identical tiles.
 */
export type CardSize = "sm" | "md" | "lg" | "band";

/** What you're actually in the mood for — drives the one filter on the hub. */
export type Mood = "play" | "talk" | "create" | "compete" | "memories";

export const MOODS: { id: Mood; label: string; blurb: string }[] = [
  { id: "play", label: "Play", blurb: "quick and silly" },
  { id: "talk", label: "Talk", blurb: "questions, answers, honesty" },
  { id: "create", label: "Create", blurb: "make something" },
  { id: "compete", label: "Compete", blurb: "someone has to win" },
  { id: "memories", label: "Memories", blurb: "things that keep" },
];

export interface Experience {
  id: string;
  title: string;
  description: string;
  /** Longer copy shown on the experience's own page. */
  blurb: string;
  icon: ComponentType<SVGProps<SVGSVGElement> & { accent?: string }>;
  /** Original illustration for this experience. */
  scene: SceneId;
  palette: Palette;
  size: CardSize;
  /** An experience can sit in more than one mood. */
  moods: Mood[];
  accent: string;
  tint: string;
  section: ExperienceSection;
  isNew?: boolean;
  /** `room` experiences run through the shared lobby; `standalone` open directly. */
  mode: PlayMode;
  /** Whether a single player can meaningfully play alone. */
  soloFriendly: boolean;
  href?: string;
  players: string;
  minutes: string;
}

export const EXPERIENCES: Experience[] = [
  {
    id: "know-me",
    title: "Know Me Quiz",
    description: "guess each other, score at the end",
    blurb:
      "You answer about yourself, they guess. Then you swap. Everything stays hidden until you have both locked in.",
    icon: IconBrain,
    scene: "know-me",
    palette: "blush",
    size: "lg",
    moods: ["talk", "play"],
    accent: "var(--blush-deep)",
    tint: "var(--blush-tint)",
    section: "main",
    mode: "room",
    soloFriendly: false,
    players: "2 players",
    minutes: "10 min",
  },
  {
    id: "truth-or-dare",
    title: "Truth or Dare",
    description: "lose the minigame, pick your fate",
    blurb:
      "A quick reflex duel decides who is on the hook. Lose it and you choose: answer honestly or do the dare.",
    icon: IconDice,
    scene: "truth-or-dare",
    palette: "lilac",
    size: "sm",
    moods: ["play", "talk"],
    accent: "var(--lilac-deep)",
    tint: "var(--lilac-tint)",
    section: "main",
    isNew: true,
    mode: "room",
    soloFriendly: false,
    players: "2 players",
    minutes: "15 min",
  },
  {
    id: "honest-cards",
    title: "Honest Cards",
    description: "the questions you keep avoiding",
    blurb:
      "One card at a time, from light to genuinely vulnerable. No scores, no timer — just the question and the two of you.",
    icon: IconCards,
    scene: "honest-cards",
    palette: "sky",
    size: "sm",
    moods: ["talk"],
    accent: "var(--sky-deep)",
    tint: "var(--sky-tint)",
    section: "main",
    mode: "standalone",
    soloFriendly: true,
    href: "/play/honest-cards",
    players: "1–2 players",
    minutes: "open ended",
  },
  {
    id: "iq-duel",
    title: "IQ Duel",
    description: "same questions, head to head",
    blurb:
      "Identical questions, independent answers, a timer on every round. Reveal shows who was right and who was fast.",
    icon: IconDuel,
    scene: "iq-duel",
    palette: "butter",
    size: "sm",
    moods: ["compete", "play"],
    accent: "var(--butter-deep)",
    tint: "var(--butter-tint)",
    section: "main",
    mode: "room",
    soloFriendly: true,
    players: "2 players",
    minutes: "8 min",
  },
  {
    id: "riddle-night",
    title: "Riddle Night",
    description: "famous riddles, talk it out",
    blurb:
      "Classic riddles, one at a time. Talk it through out loud, submit one answer together, then see the solution.",
    icon: IconRiddle,
    scene: "riddle-night",
    palette: "lilac",
    size: "sm",
    moods: ["play", "talk"],
    accent: "var(--lilac-deep)",
    tint: "var(--lilac-tint)",
    section: "main",
    mode: "room",
    soloFriendly: true,
    players: "1–2 players",
    minutes: "12 min",
  },
  {
    id: "the-lab",
    title: "The Lab",
    description: "math & science, versus or co-op",
    blurb:
      "Mental math, pattern spotting, physics and logic. Play solo, race each other, or pool your answers as a team.",
    icon: IconFlask,
    scene: "the-lab",
    palette: "mint",
    size: "sm",
    moods: ["compete", "play"],
    accent: "var(--mint-deep)",
    tint: "var(--mint-tint)",
    section: "main",
    isNew: true,
    mode: "room",
    soloFriendly: true,
    players: "1–2 players",
    minutes: "10 min",
  },
  {
    id: "arcade",
    title: "Arcade",
    description: "your face, ten tiny games",
    blurb:
      "Five fast minigames with a shared high-score shelf. Reaction, memory, tapping, colour and numbers.",
    icon: IconArcade,
    scene: "arcade",
    palette: "peach",
    size: "sm",
    moods: ["play", "compete"],
    accent: "var(--peach-deep)",
    tint: "var(--peach-tint)",
    section: "main",
    mode: "standalone",
    soloFriendly: true,
    href: "/play/arcade",
    players: "1–2 players",
    minutes: "5 min",
  },
  {
    id: "debate",
    title: "Debate",
    description: "argue it out, AI judges",
    blurb:
      "You get a topic and a side. Write your case, then a judge scores argument, evidence, creativity and persuasion.",
    icon: IconDebate,
    scene: "debate",
    palette: "lilac",
    size: "sm",
    moods: ["compete", "talk"],
    accent: "var(--lilac-deep)",
    tint: "var(--lilac-tint)",
    section: "main",
    mode: "room",
    soloFriendly: false,
    players: "2 players",
    minutes: "15 min",
  },
  {
    id: "draw-together",
    title: "Draw Together",
    description: "same prompt, two canvases",
    blurb:
      "One prompt, two canvases, one synchronised timer. Strokes stream live, then you compare side by side.",
    icon: IconDraw,
    scene: "draw-together",
    palette: "sky",
    size: "lg",
    moods: ["create", "play"],
    accent: "var(--sky-deep)",
    tint: "var(--sky-tint)",
    section: "main",
    isNew: true,
    mode: "room",
    soloFriendly: true,
    players: "2 players",
    minutes: "5 min",
  },
  {
    id: "couples-court",
    title: "Couples Court",
    description: "plead your case, get a verdict",
    blurb:
      "Someone files the complaint, someone answers it. Submit evidence, then the bench delivers a very silly ruling.",
    icon: IconGavel,
    scene: "couples-court",
    palette: "butter",
    size: "sm",
    moods: ["play", "compete"],
    accent: "var(--butter-deep)",
    tint: "var(--butter-tint)",
    section: "main",
    mode: "room",
    soloFriendly: false,
    players: "2 players",
    minutes: "12 min",
  },
  {
    id: "snap-hunt",
    title: "Snap Hunt",
    description: "race to find it, snap it",
    blurb:
      "\"Find something blue.\" The clock starts. Photograph it before the timer dies, then see what they found.",
    icon: IconSnap,
    scene: "snap-hunt",
    palette: "mint",
    size: "md",
    moods: ["play", "compete", "memories"],
    accent: "var(--mint-deep)",
    tint: "var(--mint-tint)",
    section: "main",
    mode: "room",
    soloFriendly: true,
    players: "2 players",
    minutes: "10 min",
  },
  {
    id: "love-match",
    title: "Love Match",
    description: "same personality test, one match score",
    blurb:
      "The same questions, answered apart. We line them up and turn the overlap into one honest compatibility number.",
    icon: IconHeartLink,
    scene: "love-match",
    palette: "blush",
    size: "md",
    moods: ["talk"],
    accent: "var(--blush-deep)",
    tint: "var(--blush-tint)",
    section: "main",
    mode: "room",
    soloFriendly: false,
    players: "2 players",
    minutes: "8 min",
  },
  {
    id: "watch-together",
    title: "Watch Together",
    description: "same video, same second, from anywhere",
    blurb:
      "Paste a link and the two players stay on the same timestamp. Pause together, seek together, react without talking over it.",
    icon: IconBooth,
    scene: "watch-together",
    palette: "lilac",
    size: "band",
    moods: ["play", "memories"],
    accent: "var(--lilac-deep)",
    tint: "var(--lilac-tint)",
    section: "main",
    isNew: true,
    mode: "room",
    soloFriendly: true,
    players: "2 players",
    minutes: "as long as it takes",
  },
  {
    id: "our-future",
    title: "Our Future",
    description: "design it together — vision board payoff",
    blurb:
      "A shared board for the plans you keep half-saying. Drop goals, places and dates, drag them anywhere, both see it live.",
    icon: IconCompass,
    scene: "our-future",
    palette: "mint",
    size: "lg",
    moods: ["talk", "create", "memories"],
    accent: "var(--mint-deep)",
    tint: "var(--mint-tint)",
    section: "main",
    isNew: true,
    mode: "room",
    soloFriendly: true,
    players: "1–2 players",
    minutes: "open ended",
  },
  {
    id: "birthday-gift",
    title: "Birthday Gift",
    description: "her own gift page, sealed in a heart QR",
    blurb:
      "Build a private page of photos, memories and a message. It stays sealed until the date, then opens from a QR code.",
    icon: IconGift,
    scene: "birthday-gift",
    palette: "peach",
    size: "sm",
    moods: ["create", "memories"],
    accent: "var(--peach-deep)",
    tint: "var(--peach-tint)",
    section: "main",
    mode: "standalone",
    soloFriendly: true,
    href: "/play/birthday-gift",
    players: "1 player",
    minutes: "15 min",
  },
  {
    id: "letters",
    title: "Letters",
    description: "write now, delivered years from now",
    blurb:
      "Write to a future version of someone. Seal it, pick a date, and it stays shut until that morning arrives.",
    icon: IconLetter,
    scene: "letters",
    palette: "lilac",
    size: "band",
    moods: ["talk", "memories"],
    accent: "var(--lilac-deep)",
    tint: "var(--lilac-tint)",
    section: "main",
    mode: "standalone",
    soloFriendly: true,
    href: "/play/letters",
    players: "1 player",
    minutes: "10 min",
  },
  {
    id: "print-studio",
    title: "Print Studio",
    description:
      "design matching shirts together — draw, type, AI couple art, then wear them",
    blurb:
      "A real editor: type, draw, drop in photos and shapes, then preview the pair on shirts and export print-ready art.",
    icon: IconShirt,
    scene: "print-studio",
    palette: "sky",
    size: "md",
    moods: ["create"],
    accent: "var(--sky-deep)",
    tint: "var(--sky-tint)",
    section: "more",
    isNew: true,
    mode: "standalone",
    soloFriendly: true,
    href: "/studio",
    players: "1–2 players",
    minutes: "20 min",
  },
  {
    id: "scrapbook",
    title: "Digital Scrapbook",
    description:
      "your photobooth strips on paper — tape them down, write on them, keep it",
    blurb:
      "Every strip you keep lands here on paper, taped down, with room for a caption and the date it happened.",
    icon: IconScrapbook,
    scene: "scrapbook",
    palette: "butter",
    size: "md",
    moods: ["memories", "create"],
    accent: "var(--butter-deep)",
    tint: "var(--butter-tint)",
    section: "more",
    mode: "standalone",
    soloFriendly: true,
    href: "/scrapbook",
    players: "1–2 players",
    minutes: "open ended",
  },
  {
    id: "couples-hub",
    title: "Couples Hub",
    description: "your shared home — grow the Connection Tree",
    blurb:
      "One place for your profile, memories, letters, goals and the tree that grows every time you finish something together.",
    icon: IconTree,
    scene: "couples-hub",
    palette: "mint",
    size: "md",
    moods: ["memories"],
    accent: "var(--mint-deep)",
    tint: "var(--mint-tint)",
    section: "more",
    mode: "standalone",
    soloFriendly: true,
    href: "/hub",
    players: "2 players",
    minutes: "open ended",
  },
  {
    id: "photobooth",
    title: "Photobooth",
    description: "four shots, one strip, together from anywhere",
    blurb:
      "Synchronised countdowns, simultaneous capture, filters and frames — then a print-resolution strip you can download.",
    icon: IconBooth,
    scene: "photobooth",
    palette: "blush",
    size: "band",
    moods: ["create", "memories", "play"],
    accent: "var(--blush-deep)",
    tint: "var(--blush-tint)",
    section: "more",
    mode: "standalone",
    soloFriendly: true,
    href: "/photobooth",
    players: "1–2 players",
    minutes: "5 min",
  },
];

export const MAIN_EXPERIENCES = EXPERIENCES.filter((e) => e.section === "main");
export const MORE_EXPERIENCES = EXPERIENCES.filter((e) => e.section === "more");

/** Resolves an experience's pastel triple to concrete CSS variable strings. */
export function paletteVars(palette: Palette) {
  return {
    tint: `var(--${palette}-tint)`,
    mid: `var(--${palette}-mid)`,
    deep: `var(--${palette}-deep)`,
  };
}

export function experiencesInMood(list: Experience[], moods: Mood[]) {
  if (!moods.length) return list;
  return list.filter((e) => e.moods.some((m) => moods.includes(m)));
}

export function getExperience(id: string) {
  return EXPERIENCES.find((e) => e.id === id);
}

/** Where a card should link to: its own page, or the room launcher. */
export function experienceHref(experience: Experience) {
  return experience.href ?? `/play/${experience.id}`;
}

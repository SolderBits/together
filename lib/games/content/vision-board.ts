export type VisionKind = "goal" | "dream" | "place" | "date" | "note" | "image";

export const VISION_KINDS: {
  id: VisionKind;
  label: string;
  placeholder: string;
  accent: string;
  tint: string;
}[] = [
  { id: "goal", label: "Goal", placeholder: "Something we finish", accent: "var(--mint-deep)", tint: "var(--mint-tint)" },
  { id: "dream", label: "Dream", placeholder: "Something unreasonable", accent: "var(--lilac-deep)", tint: "var(--lilac-tint)" },
  { id: "place", label: "Place", placeholder: "Somewhere we go", accent: "var(--sky-deep)", tint: "var(--sky-tint)" },
  { id: "date", label: "Future date", placeholder: "A day we plan", accent: "var(--blush-deep)", tint: "var(--blush-tint)" },
  { id: "note", label: "Note", placeholder: "Anything else", accent: "var(--butter-deep)", tint: "var(--butter-tint)" },
  { id: "image", label: "Image", placeholder: "Upload a picture", accent: "var(--peach-deep)", tint: "var(--peach-tint)" },
];

export interface BoardTemplate {
  id: string;
  title: string;
  blurb: string;
  /** Seeded cards, dropped onto the board when the template is chosen. */
  cards: { kind: VisionKind; text: string }[];
}

/** Each template is a different conversation, not just a different label. */
export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: "dream-home",
    title: "Dream Home",
    blurb: "the place, and what's in it",
    cards: [
      { kind: "place", text: "The area we'd actually live in" },
      { kind: "goal", text: "A kitchen worth cooking in" },
      { kind: "dream", text: "One room purely for something useless" },
      { kind: "note", text: "The thing neither of us will compromise on" },
      { kind: "goal", text: "What we'd fix first" },
      { kind: "dream", text: "A view from one window" },
    ],
  },
  {
    id: "travel-list",
    title: "Travel List",
    blurb: "somewhere, eventually",
    cards: [
      { kind: "place", text: "The one we keep talking about" },
      { kind: "place", text: "Somewhere neither of us can pronounce" },
      { kind: "date", text: "The trip we book this year" },
      { kind: "dream", text: "A journey rather than a destination" },
      { kind: "note", text: "The trip we'd do badly on purpose" },
      { kind: "place", text: "Somewhere we've been that deserves a second go" },
    ],
  },
  {
    id: "five-year",
    title: "Five-Year Vision",
    blurb: "the shape of it",
    cards: [
      { kind: "goal", text: "Where we're living" },
      { kind: "goal", text: "What we've stopped doing" },
      { kind: "dream", text: "The unreasonable one" },
      { kind: "note", text: "What we want an ordinary Tuesday to feel like" },
      { kind: "goal", text: "Something we've built" },
      { kind: "date", text: "A milestone we'd like to hit" },
    ],
  },
  {
    id: "things-to-try",
    title: "Things We Want To Try",
    blurb: "low stakes, high return",
    cards: [
      { kind: "goal", text: "A skill neither of us has" },
      { kind: "note", text: "A food we've been avoiding" },
      { kind: "dream", text: "Something mildly terrifying" },
      { kind: "goal", text: "A class we'd both be bad at" },
      { kind: "note", text: "A hobby with no purpose" },
      { kind: "date", text: "A thing to try this month" },
    ],
  },
  {
    id: "perfect-weekend",
    title: "Our Perfect Weekend",
    blurb: "hour by hour",
    cards: [
      { kind: "note", text: "Friday night, exactly" },
      { kind: "note", text: "Saturday morning" },
      { kind: "place", text: "Where we'd eat" },
      { kind: "note", text: "The bit with nothing planned" },
      { kind: "note", text: "Sunday, protected" },
      { kind: "dream", text: "The version with no budget" },
    ],
  },
  {
    id: "bucket-list",
    title: "Bucket List",
    blurb: "the big ones",
    cards: [
      { kind: "dream", text: "The one we'd regret not doing" },
      { kind: "place", text: "A place worth planning years for" },
      { kind: "goal", text: "Something we'd need to train for" },
      { kind: "dream", text: "A thing we'd tell people about forever" },
      { kind: "note", text: "The one that scares us both" },
      { kind: "date", text: "The first one, with a date on it" },
    ],
  },
  {
    id: "this-year",
    title: "This Year",
    blurb: "twelve months, realistically",
    cards: [
      { kind: "goal", text: "The one thing that matters most" },
      { kind: "date", text: "A trip we actually book" },
      { kind: "note", text: "Something we do less of" },
      { kind: "goal", text: "A person we see more of" },
      { kind: "note", text: "A habit worth keeping" },
      { kind: "dream", text: "The stretch goal" },
    ],
  },
];

export const VISION_STARTERS = [
  "Learn to cook one thing properly",
  "A weekend with no plans at all",
  "See the northern lights",
  "Get better at saying no",
  "Somewhere with mountains",
  "Adopt something with four legs",
  "Finish the thing we started",
  "A room that's actually finished",
  "One trip a year, non-negotiable",
  "Learn each other's language",
  "A proper dinner party",
  "Swim somewhere cold",
  "Take a train instead of a plane",
  "Stop checking work after seven",
  "A long walk with no destination",
  "Save enough to stop worrying",
  "Grow something edible",
  "See a band neither of us knows",
];

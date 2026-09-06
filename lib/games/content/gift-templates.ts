export interface GiftTemplate {
  id: string;
  title: string;
  blurb: string;
  /** Pre-fills the gift title. */
  giftTitle: string;
  /** Pre-fills the message with a scaffold worth editing. */
  message: string;
  /** Seeded memory rows. */
  memories: { title: string; detail: string }[];
}

/**
 * Templates exist to get past the blank page. Every one is written to be
 * rewritten — the structure is the gift, not the words.
 */
export const GIFT_TEMPLATES: GiftTemplate[] = [
  {
    id: "love-letter",
    title: "Love Letter",
    blurb: "one long message, properly written",
    giftTitle: "A letter, for you",
    message:
      "I'm not good at saying this out loud, so I've written it instead.\n\nWhat I noticed first about you was —\n\nWhat I've come to rely on is —\n\nAnd the thing I'd never want to lose is —",
    memories: [],
  },
  {
    id: "memory-timeline",
    title: "Memory Timeline",
    blurb: "the story so far, in order",
    giftTitle: "Us, in order",
    message: "Everything that got us here, roughly in the right sequence.",
    memories: [
      { title: "The first time", detail: "Where we were and what was said" },
      { title: "The one that nearly went wrong", detail: "And how it didn't" },
      { title: "The ordinary day I still think about", detail: "Nothing happened, and that was the point" },
      { title: "The best decision we made", detail: "It didn't feel like a decision at the time" },
    ],
  },
  {
    id: "reasons",
    title: "Reasons I Love You",
    blurb: "specific, not generic",
    giftTitle: "Reasons, specifically",
    message:
      "Not the obvious ones. These are the small, exact, slightly odd reasons.",
    memories: [
      { title: "The way you", detail: "Something you do without noticing" },
      { title: "How you handle", detail: "A situation most people handle badly" },
      { title: "The thing you say", detail: "That I've quietly started saying too" },
      { title: "What you're like when", detail: "Nobody else is watching" },
    ],
  },
  {
    id: "photo-story",
    title: "Photo Story",
    blurb: "pictures with the context added",
    giftTitle: "A few photos, with the full story",
    message:
      "These are the ones I kept. Here's what was actually happening in each of them.",
    memories: [
      { title: "Photo one", detail: "What you can't see in the frame" },
      { title: "Photo two", detail: "What happened five minutes later" },
      { title: "Photo three", detail: "Why I've kept this one" },
    ],
  },
  {
    id: "countdown",
    title: "Birthday Countdown",
    blurb: "a thing a day, until the day",
    giftTitle: "Counting down",
    message:
      "One small thing for each day until yours. Read one a day, or all at once — I'm not going to police it.",
    memories: [
      { title: "Day one", detail: "Something you're good at" },
      { title: "Day two", detail: "A memory from this year" },
      { title: "Day three", detail: "Something I'm looking forward to" },
      { title: "The day itself", detail: "What I'd say if I were braver" },
    ],
  },
  {
    id: "open-when",
    title: "Open When…",
    blurb: "a message for each kind of day",
    giftTitle: "Open when…",
    message:
      "Different messages for different days. Read the one that matches how today is going.",
    memories: [
      { title: "Open when it's a bad day", detail: "Written for exactly that" },
      { title: "Open when you're proud of something", detail: "So am I" },
      { title: "Open when you miss me", detail: "Here's the thing to remember" },
      { title: "Open when you can't sleep", detail: "Something boring and comforting" },
    ],
  },
];

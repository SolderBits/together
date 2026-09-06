export interface LetterPrompt {
  id: string;
  label: string;
  /** Dropped into the letter body as a starting point. */
  opener: string;
  /** Suggested delivery distance, in years. */
  years: number;
}

/**
 * Prompts exist because the blank page is the reason most letters never get
 * written. Each one gives you a first line and a reason to keep going.
 */
export const LETTER_PROMPTS: LetterPrompt[] = [
  {
    id: "one-year",
    label: "A letter to us, one year from now",
    opener:
      "By the time you read this, a year will have gone. Here's what today actually looked like:\n\n",
    years: 1,
  },
  {
    id: "realised",
    label: "The day you first realised",
    opener: "I've never told you exactly when I knew. It was\n\n",
    years: 2,
  },
  {
    id: "never-changes",
    label: "What you hope never changes",
    opener: "If everything else moves, I hope this doesn't:\n\n",
    years: 5,
  },
  {
    id: "never-said",
    label: "Something you've never said out loud",
    opener: "I've thought this for a while and never found the moment to say it.\n\n",
    years: 1,
  },
  {
    id: "hard-year",
    label: "For a year that turns out to be hard",
    opener:
      "If you're reading this in a bad week, I want you to remember something about right now:\n\n",
    years: 3,
  },
  {
    id: "proud",
    label: "What you're proud of them for",
    opener: "You'd never say this about yourself, so I'm writing it down.\n\n",
    years: 1,
  },
  {
    id: "ordinary-day",
    label: "An ordinary day, described exactly",
    opener:
      "Nothing happened today, which is why I'm writing it down. Here's how it went:\n\n",
    years: 5,
  },
  {
    id: "future-self",
    label: "A letter to your own future self",
    opener: "Right now I want you to remember that\n\n",
    years: 2,
  },
  {
    id: "thank-you",
    label: "The thank you you keep forgetting",
    opener: "I don't think I've properly thanked you for\n\n",
    years: 1,
  },
  {
    id: "ten-years",
    label: "Ten years out",
    opener:
      "Ten years is long enough that I have no idea who's reading this. Here's what we wanted:\n\n",
    years: 10,
  },
  {
    id: "apology",
    label: "The apology you owe",
    opener: "I've been meaning to say this properly rather than in passing.\n\n",
    years: 1,
  },
  {
    id: "promise",
    label: "A promise with a deadline",
    opener: "I'm putting this in writing so it counts. By the time you read this, I will have\n\n",
    years: 2,
  },
];

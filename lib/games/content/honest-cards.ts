export type CardCategory =
  | "easy"
  | "memories"
  | "relationship"
  | "future"
  | "deep"
  | "vulnerable"
  | "flirty";

/** How exposed the question makes you feel, not how hard it is to answer. */
export type CardIntensity = "low" | "medium" | "deep";

export interface HonestCard {
  id: string;
  category: CardCategory;
  intensity: CardIntensity;
  question: string;
}

export const CARD_CATEGORIES: {
  id: CardCategory;
  label: string;
  blurb: string;
  accent: string;
  tint: string;
}[] = [
  { id: "easy", label: "Easy", blurb: "openers", accent: "var(--butter-deep)", tint: "var(--butter-tint)" },
  { id: "memories", label: "Memories", blurb: "back then", accent: "var(--peach-deep)", tint: "var(--peach-tint)" },
  { id: "relationship", label: "Relationship", blurb: "about us", accent: "var(--blush-deep)", tint: "var(--blush-tint)" },
  { id: "future", label: "Future", blurb: "what's next", accent: "var(--mint-deep)", tint: "var(--mint-tint)" },
  { id: "deep", label: "Deep", blurb: "slower, bigger", accent: "var(--sky-deep)", tint: "var(--sky-tint)" },
  { id: "vulnerable", label: "Vulnerable", blurb: "the hard ones", accent: "var(--lilac-deep)", tint: "var(--lilac-tint)" },
  { id: "flirty", label: "Flirty", blurb: "tasteful", accent: "var(--blush-deep)", tint: "var(--blush-tint)" },
];

/**
 * The three decks are meant to be genuinely different in kind, not just in
 * temperature. Low is conversation. Medium asks for something true about you.
 * Deep asks a question you can't answer on autopilot — and deliberately isn't
 * just "more romantic".
 */
export const CARD_INTENSITIES: {
  id: CardIntensity;
  label: string;
  blurb: string;
  /** Shown once under the selector so the choice means something. */
  promise: string;
}[] = [
  {
    id: "low",
    label: "Low",
    blurb: "easy conversation",
    promise: "Questions you could answer at a dinner table with other people there.",
  },
  {
    id: "medium",
    label: "Medium",
    blurb: "personal, meaningful",
    promise: "Questions about you specifically. You'll have to actually think about one or two.",
  },
  {
    id: "deep",
    label: "Deep",
    blurb: "the ones worth sitting with",
    promise: "Questions with no easy answer. Some are about the two of you; plenty aren't.",
  },
];

export const HONEST_CARDS: HonestCard[] = [
  // ----------------------------------------------------------------- easy
  { id: "e01", category: "easy", intensity: "low", question: "What's the best thing that happened to you this week that you haven't told anyone?" },
  { id: "e02", category: "easy", intensity: "low", question: "What song would play over the trailer for your life?" },
  { id: "e03", category: "easy", intensity: "low", question: "What's a small luxury you refuse to give up?" },
  { id: "e04", category: "easy", intensity: "low", question: "What's the most useless skill you're weirdly proud of?" },
  { id: "e05", category: "easy", intensity: "low", question: "If today had a title, what would it be?" },
  { id: "e06", category: "easy", intensity: "low", question: "What have you eaten recently that you're still thinking about?" },
  { id: "e07", category: "easy", intensity: "low", question: "What's the last thing that made you laugh properly?" },
  { id: "e08", category: "easy", intensity: "low", question: "What's your most irrational strong opinion?" },
  { id: "e09", category: "easy", intensity: "low", question: "What would you do with a completely empty week?" },
  { id: "e10", category: "easy", intensity: "low", question: "What's the last photo you took, and why?" },
  { id: "e12", category: "easy", intensity: "low", question: "What's the most overrated thing everyone seems to love?" },
  { id: "e13", category: "easy", intensity: "low", question: "What did you want to be at seven, and what happened to that?" },
  { id: "e14", category: "easy", intensity: "low", question: "What's your comfort meal when nobody's watching?" },
  { id: "e15", category: "easy", intensity: "low", question: "What's a hill you'd genuinely die on?" },
  { id: "e16", category: "easy", intensity: "low", question: "What's something you're good at that nobody would guess?" },
  { id: "e17", category: "easy", intensity: "low", question: "What's the best money you've ever spent?" },
  { id: "e18", category: "easy", intensity: "low", question: "What's the last thing you looked up because you were too embarrassed to ask?" },

  // ------------------------------------------------------------- memories
  { id: "m01", category: "memories", intensity: "low", question: "What's the earliest thing you can actually remember?" },
  { id: "m02", category: "memories", intensity: "medium", question: "What's a day you'd live again exactly as it was?" },
  { id: "m03", category: "memories", intensity: "medium", question: "What's a smell that puts you somewhere else instantly?" },
  { id: "m04", category: "memories", intensity: "low", question: "What was your bedroom like when you were fifteen?" },
  { id: "m05", category: "memories", intensity: "medium", question: "Who was the first person outside your family who really got you?" },
  { id: "m06", category: "memories", intensity: "medium", question: "What's the best trip you've ever taken, and what made it?" },
  { id: "m07", category: "memories", intensity: "medium", question: "What's a moment you knew something had ended?" },
  { id: "m08", category: "memories", intensity: "low", question: "What was your most embarrassing phase, honestly?" },
  { id: "m09", category: "memories", intensity: "medium", question: "What's a piece of advice you got that you're still using?" },
  { id: "m10", category: "memories", intensity: "deep", question: "What's a memory you've never told anyone in full?" },
  { id: "m11", category: "memories", intensity: "medium", question: "What did you think adulthood would be like?" },
  { id: "m12", category: "memories", intensity: "medium", question: "Who's someone you've lost touch with that you still think about?" },
  { id: "m13", category: "memories", intensity: "low", question: "What's the most fun you've had for under a tenner?" },
  { id: "m14", category: "memories", intensity: "deep", question: "What's the hardest year you've had, and what got you through it?" },
  { id: "m15", category: "memories", intensity: "medium", question: "What's something you used to believe about yourself that turned out to be nonsense?" },

  // ---------------------------------------------------------- relationship
  { id: "r01", category: "relationship", intensity: "low", question: "When did you first know this was something?" },
  { id: "r02", category: "relationship", intensity: "medium", question: "What's the kindest thing I've done that I probably forgot about?" },
  { id: "r03", category: "relationship", intensity: "medium", question: "What do we do well that we never talk about?" },
  { id: "r04", category: "relationship", intensity: "deep", question: "What's a fight we keep having in different clothes?" },
  { id: "r05", category: "relationship", intensity: "medium", question: "How do you like to be comforted when you're upset?" },
  { id: "r06", category: "relationship", intensity: "medium", question: "What do I do that makes you feel safest?" },
  { id: "r07", category: "relationship", intensity: "low", question: "What's the most ordinary thing about us that you'd miss?" },
  { id: "r08", category: "relationship", intensity: "medium", question: "What did you think of me in the first ten minutes?" },
  { id: "r09", category: "relationship", intensity: "deep", question: "What's something you've wanted to ask me but haven't?" },
  { id: "r10", category: "relationship", intensity: "medium", question: "When do you feel most disconnected from me?" },
  { id: "r11", category: "relationship", intensity: "low", question: "What's a habit of mine you've quietly adopted?" },
  { id: "r12", category: "relationship", intensity: "medium", question: "What would you want more of from me, if asking were easy?" },
  { id: "r13", category: "relationship", intensity: "deep", question: "What do you think I get wrong about you?" },
  { id: "r14", category: "relationship", intensity: "medium", question: "What's the best thing we've ever decided together?" },
  { id: "r15", category: "relationship", intensity: "low", question: "What do you think our friends say about us when we're not there?" },
  { id: "r16", category: "relationship", intensity: "deep", question: "What's something I do that hurts more than I realise?" },
  { id: "r17", category: "relationship", intensity: "medium", question: "How do you know when I'm not okay?" },
  { id: "r18", category: "relationship", intensity: "medium", question: "What's one thing you'd change about how we handle money?" },
  { id: "r19", category: "relationship", intensity: "low", question: "What's the last thing I said that stuck with you?" },
  { id: "r20", category: "relationship", intensity: "deep", question: "What are you most afraid of losing about us?" },

  // ---------------------------------------------------------------- future
  { id: "f01", category: "future", intensity: "medium", question: "Where do you actually want to be living in five years?" },
  { id: "f02", category: "future", intensity: "low", question: "What's one thing you want us to have done by this time next year?" },
  { id: "f03", category: "future", intensity: "medium", question: "What kind of old person do you want to be?" },
  { id: "f04", category: "future", intensity: "medium", question: "What would you do if money stopped being the deciding factor?" },
  { id: "f05", category: "future", intensity: "low", question: "What tradition do you want us to start?" },
  { id: "f06", category: "future", intensity: "deep", question: "What's a risk you want to take before you talk yourself out of it?" },
  { id: "f07", category: "future", intensity: "medium", question: "What does 'enough' look like to you?" },
  { id: "f08", category: "future", intensity: "medium", question: "What do you want your daily life to feel like, not look like?" },
  { id: "f09", category: "future", intensity: "deep", question: "What are you postponing that you shouldn't be?" },
  { id: "f10", category: "future", intensity: "low", question: "What's the next thing you want to be good at?" },
  { id: "f11", category: "future", intensity: "medium", question: "Who do you want to be closer to in a year's time?" },
  { id: "f12", category: "future", intensity: "medium", question: "What would make next year feel like it counted?" },
  { id: "f13", category: "future", intensity: "deep", question: "What would you need to stop doing to get what you want?" },
  { id: "f14", category: "future", intensity: "low", question: "If we could only take one trip in the next three years, where?" },

  // ------------------------------------------------------------------ deep
  { id: "d01", category: "deep", intensity: "medium", question: "What belief did you hold at twenty that you've since dropped?" },
  { id: "d02", category: "deep", intensity: "deep", question: "What do you think you're still recovering from?" },
  { id: "d03", category: "deep", intensity: "medium", question: "When do you feel most like yourself?" },
  { id: "d04", category: "deep", intensity: "medium", question: "What's a decision you made that quietly changed everything?" },
  { id: "d05", category: "deep", intensity: "medium", question: "What are you tired of pretending not to care about?" },
  { id: "d06", category: "deep", intensity: "deep", question: "Who do you compare yourself to, and is it fair?" },
  { id: "d07", category: "deep", intensity: "medium", question: "What would you do differently if nobody would ever find out?" },
  { id: "d08", category: "deep", intensity: "medium", question: "What's the difference between who you are and who you present as?" },
  { id: "d09", category: "deep", intensity: "deep", question: "What do you want that you'd feel embarrassed admitting?" },
  { id: "d10", category: "deep", intensity: "medium", question: "What's something you've forgiven that you didn't expect to?" },
  { id: "d11", category: "deep", intensity: "medium", question: "What does a good life actually mean to you?" },
  { id: "d12", category: "deep", intensity: "deep", question: "What's the thing you'd change about how you were raised?" },
  { id: "d13", category: "deep", intensity: "medium", question: "When did you last change your mind about something that mattered?" },
  { id: "d14", category: "deep", intensity: "deep", question: "What are you avoiding thinking about at the moment?" },
  { id: "d15", category: "deep", intensity: "medium", question: "What's a compliment that would actually land with you?" },
  { id: "d16", category: "deep", intensity: "medium", question: "What do you do with anger?" },
  { id: "d17", category: "deep", intensity: "deep", question: "What would you want said about you if you couldn't hear it?" },

  // ------------------------------------------------------------ vulnerable
  { id: "v01", category: "vulnerable", intensity: "deep", question: "What's something you need but find hard to ask for?" },
  { id: "v02", category: "vulnerable", intensity: "deep", question: "What do you worry I think about you?" },
  { id: "v03", category: "vulnerable", intensity: "deep", question: "When did you last feel lonely next to someone?" },
  { id: "v04", category: "vulnerable", intensity: "deep", question: "What part of yourself do you hide first?" },
  { id: "v05", category: "vulnerable", intensity: "deep", question: "What are you afraid I'd think if you told me the whole truth?" },
  { id: "v06", category: "vulnerable", intensity: "deep", question: "What's the loneliest you've ever been?" },
  { id: "v07", category: "vulnerable", intensity: "deep", question: "What do you do when you don't want to be a burden?" },
  { id: "v08", category: "vulnerable", intensity: "deep", question: "What's a thing about yourself you've stopped trying to fix?" },
  { id: "v09", category: "vulnerable", intensity: "deep", question: "When did you last cry, and what was it actually about?" },
  { id: "v10", category: "vulnerable", intensity: "deep", question: "What would you need to hear right now?" },
  { id: "v11", category: "vulnerable", intensity: "medium", question: "What's something you're carrying that you've never named out loud?" },
  { id: "v12", category: "vulnerable", intensity: "deep", question: "Where do you think you're hardest on yourself?" },
  { id: "v13", category: "vulnerable", intensity: "medium", question: "What do you need me to stop assuming about you?" },
  { id: "v14", category: "vulnerable", intensity: "deep", question: "What's the apology you're still waiting for?" },

  // ---------------------------------------------------------------- flirty
  { id: "t02", category: "flirty", intensity: "low", question: "What do I do that you find unreasonably attractive?" },
  { id: "t03", category: "flirty", intensity: "medium", question: "When did you first want to kiss me?" },
  { id: "t04", category: "flirty", intensity: "low", question: "What's your favourite thing I wear?" },
  { id: "t07", category: "flirty", intensity: "medium", question: "What makes you feel most wanted?" },
  { id: "t08", category: "flirty", intensity: "low", question: "What's your ideal way to be woken up?" },
  { id: "t09", category: "flirty", intensity: "medium", question: "What would a perfect night in look like, in detail?" },
  { id: "t10", category: "flirty", intensity: "low", question: "What's something small I do that you'd never admit you like?" },
  { id: "t11", category: "flirty", intensity: "medium", question: "Where's your favourite place to be touched that isn't obvious?" },
  { id: "t12", category: "flirty", intensity: "low", question: "What's the flirtiest thing you've ever done badly?" },
  { id: "e19", category: "easy", intensity: "low", question: "What's something you pretend to enjoy?" },
  { id: "e20", category: "easy", intensity: "low", question: "What's the pettiest thing that ruins your day?" },
  { id: "m16", category: "memories", intensity: "medium", question: "What's a night you thought would be ordinary and wasn't?" },
  { id: "m17", category: "memories", intensity: "low", question: "What's the best gift you've ever been given?" },
  { id: "r21", category: "relationship", intensity: "medium", question: "What's a version of us you'd like more of?" },
  { id: "d18", category: "deep", intensity: "medium", question: "What do you think you owe the people who raised you?" },
  { id: "f15", category: "future", intensity: "medium", question: "What would you regret not trying?" },
  { id: "v15", category: "vulnerable", intensity: "medium", question: "What's the thing you most want to be understood about?" },
  { id: "t13", category: "flirty", intensity: "medium", question: "What's the most attractive thing that has nothing to do with looks?" },
  { id: "t14", category: "flirty", intensity: "low", question: "What would you want to hear more often?" },

  // --- deep, and deliberately not about romance ---------------------------
  { id: "p01", category: "deep", intensity: "deep", question: "What do you think you're wrong about, but haven't changed your mind on yet?" },
  { id: "p02", category: "deep", intensity: "deep", question: "If you had to justify how you spend your time to a stranger, which part would be hardest to defend?" },
  { id: "p03", category: "deep", intensity: "deep", question: "What's something you believe that most people you know would disagree with?" },
  { id: "p04", category: "deep", intensity: "deep", question: "Who have you become that your twenty-year-old self would find hardest to understand?" },
  { id: "p05", category: "deep", intensity: "deep", question: "What would have to be true for you to consider your life a success at seventy?" },
  { id: "p06", category: "deep", intensity: "deep", question: "What's a kindness you received that you've never repaid, and probably can't?" },
  { id: "p07", category: "deep", intensity: "deep", question: "Where in your life are you choosing comfort over what you actually want?" },
  { id: "p08", category: "deep", intensity: "deep", question: "What do you think you'd be like if nothing bad had ever happened to you?" },
  { id: "p09", category: "deep", intensity: "deep", question: "What's the last thing you did purely because it was the right thing, with no upside?" },
  { id: "p10", category: "deep", intensity: "deep", question: "Which of your opinions is really just a habit you've never examined?" },
  { id: "p11", category: "deep", intensity: "deep", question: "What would you want to be doing on an ordinary Wednesday in ten years?" },
  { id: "p12", category: "deep", intensity: "deep", question: "What are you still doing only because you'd feel like a quitter if you stopped?" },
  { id: "p13", category: "deep", intensity: "deep", question: "What's the most useful thing anyone has ever said to you, and did they know it landed?" },
  { id: "p14", category: "deep", intensity: "deep", question: "If your closest friend described you honestly to a stranger, what would sting?" },
];

export const cardsFor = (
  categories: CardCategory[],
  intensities: CardIntensity[],
) =>
  HONEST_CARDS.filter(
    (c) =>
      (categories.length === 0 || categories.includes(c.category)) &&
      (intensities.length === 0 || intensities.includes(c.intensity)),
  );

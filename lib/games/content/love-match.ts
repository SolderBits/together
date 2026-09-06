/**
 * Love Match.
 *
 * Questions belong to a *dimension* — the thing they're really asking about.
 * Dimensions carry weights, because agreeing on how you argue matters rather
 * more than agreeing on breakfast, and the result should reflect that without
 * ever pretending to be a real instrument.
 */
export type MatchDimension =
  | "lifestyle"
  | "values"
  | "communication"
  | "money"
  | "future"
  | "social"
  | "adventure"
  | "conflict"
  | "affection"
  | "everyday";

export interface MatchDimensionMeta {
  id: MatchDimension;
  label: string;
  /** Higher weight = counts for more in the final number. */
  weight: number;
  /** Used in the "you're aligned on / you differ on" lines. */
  aligned: string;
  divided: string;
}

export const MATCH_DIMENSIONS: MatchDimensionMeta[] = [
  { id: "conflict", label: "How you argue", weight: 1.6, aligned: "how you handle a row", divided: "how you handle a row" },
  { id: "communication", label: "Communication", weight: 1.5, aligned: "how you say the hard things", divided: "how you say the hard things" },
  { id: "values", label: "Values", weight: 1.5, aligned: "what you think actually matters", divided: "what you think actually matters" },
  { id: "future", label: "The future", weight: 1.4, aligned: "where this is all heading", divided: "where this is all heading" },
  { id: "money", label: "Money", weight: 1.3, aligned: "what money is for", divided: "what money is for" },
  { id: "affection", label: "Affection", weight: 1.2, aligned: "how you show it", divided: "how you show it" },
  { id: "lifestyle", label: "Lifestyle", weight: 1.1, aligned: "the shape of an ordinary week", divided: "the shape of an ordinary week" },
  { id: "social", label: "People", weight: 1.0, aligned: "how much of other people you want", divided: "how much of other people you want" },
  { id: "adventure", label: "Adventure", weight: 0.9, aligned: "how far you'd go for a good story", divided: "how far you'd go for a good story" },
  { id: "everyday", label: "Everyday", weight: 0.6, aligned: "the small daily stuff", divided: "the small daily stuff" },
];

export interface MatchQuestion {
  id: string;
  dimension: MatchDimension;
  question: string;
  /** Ordered along one axis, so adjacent answers score partial credit. */
  options: [string, string, string, string];
}

export const MATCH_QUESTIONS: MatchQuestion[] = [
  // ------------------------------------------------------------- conflict
  { id: "c01", dimension: "conflict", question: "Something's wrong. What do you want first?", options: ["Talk it through right now", "A hug, then talking", "An hour of space, then talking", "To skip it and move on"] },
  { id: "c02", dimension: "conflict", question: "Mid-argument, what's your instinct?", options: ["Say everything immediately", "Slow down and get precise", "Go quiet and think", "Leave the room"] },
  { id: "c03", dimension: "conflict", question: "Who should apologise first?", options: ["Whoever was wrong", "Whoever notices first", "Whoever cares less about winning", "Nobody — just move on"] },
  { id: "c04", dimension: "conflict", question: "How do you feel about arguing in front of friends?", options: ["Fine, it's normal", "Mild version only", "Absolutely not", "Depends on the friends"] },
  { id: "c05", dimension: "conflict", question: "The same disagreement keeps coming back. You…", options: ["Sit down and solve it properly", "Compromise and let it go", "Accept it as part of the deal", "Get quietly resentful"] },
  { id: "c06", dimension: "conflict", question: "Going to bed on an argument?", options: ["Never, we fix it", "Sometimes, sleep helps", "Usually — mornings are better", "It genuinely doesn't bother me"] },
  { id: "c07", dimension: "conflict", question: "When you're wrong, how fast do you admit it?", options: ["Immediately, out loud", "After a short sulk", "Eventually, quietly", "I concede rather than admit"] },
  { id: "c08", dimension: "conflict", question: "Someone raises their voice. You…", options: ["Match it", "Go very calm", "Shut down", "Leave and come back"] },

  // -------------------------------------------------------- communication
  { id: "m01", dimension: "communication", question: "How do you deliver bad news?", options: ["Straight out, no build-up", "Softened, with context", "In writing first", "Hint until it's noticed"] },
  { id: "m02", dimension: "communication", question: "How much detail do you want about their day?", options: ["All of it, chronologically", "The headlines", "Only if something happened", "Ask me and I'll ask you"] },
  { id: "m03", dimension: "communication", question: "Texting while apart, ideally…", options: ["Constant, low-effort chatter", "A few real check-ins", "Whenever there's something to say", "Save it for a call"] },
  { id: "m04", dimension: "communication", question: "Something small is bothering you. Do you mention it?", options: ["Immediately", "Once it happens twice", "Only if asked directly", "Almost never"] },
  { id: "m05", dimension: "communication", question: "How do you feel about being asked 'are you okay?'", options: ["Grateful, always ask", "Fine, but once is enough", "It makes it worse", "Depends who's asking"] },
  { id: "m06", dimension: "communication", question: "Big decisions get talked about…", options: ["Early and repeatedly", "Once there's something to decide", "After I've made my mind up", "Out loud, at 1am"] },
  { id: "m07", dimension: "communication", question: "Silence in a room together is…", options: ["Completely comfortable", "Fine, mostly", "A bit loaded", "Something to fill"] },
  { id: "m08", dimension: "communication", question: "Feedback on something you made?", options: ["Honest, immediately", "Kind first, honest second", "Only if I ask", "Encouragement only, please"] },

  // ---------------------------------------------------------------- values
  { id: "v01", dimension: "values", question: "What matters more?", options: ["Being kind", "Being honest", "Being reliable", "Being interesting"] },
  { id: "v02", dimension: "values", question: "A friend does something you think is wrong. You…", options: ["Say so directly", "Say so gently, later", "Say nothing, judge quietly", "Assume there's context"] },
  { id: "v03", dimension: "values", question: "How important is being good at your work?", options: ["It's most of my identity", "Very, but not everything", "It pays for the rest", "It's just a job"] },
  { id: "v04", dimension: "values", question: "Family obligations vs your own plans?", options: ["Family first, mostly", "Balanced, case by case", "My plans, with guilt", "My plans, without"] },
  { id: "v05", dimension: "values", question: "What would you not compromise on?", options: ["Honesty", "Independence", "Ambition", "Peace and quiet"] },
  { id: "v06", dimension: "values", question: "Someone's rude to a waiter. That tells you…", options: ["Everything I need to know", "A lot, but not everything", "They're having a bad day", "Not much, honestly"] },
  { id: "v07", dimension: "values", question: "Success looks like…", options: ["Freedom over my time", "Making something that lasts", "Security, no anxiety", "Being close to people I love"] },
  { id: "v08", dimension: "values", question: "Keeping a secret for a friend that affects someone else?", options: ["Never — I'd tell", "Depends how serious", "Yes, it's not mine to share", "Yes, always"] },

  // ---------------------------------------------------------------- future
  { id: "f01", dimension: "future", question: "Five years out, the priority is…", options: ["Somewhere settled", "Career momentum", "Adventure and change", "Honestly no idea yet"] },
  { id: "f02", dimension: "future", question: "Where do you want to end up?", options: ["A city, properly", "A small town", "Near water or hills", "Wherever the people are"] },
  { id: "f03", dimension: "future", question: "How do you feel about a big unplanned move?", options: ["Ready tomorrow", "With a good reason", "Terrified but tempted", "No"] },
  { id: "f04", dimension: "future", question: "Kids, pets, neither, both?", options: ["Both, eventually", "Pets, definitely", "Undecided and fine with that", "Neither, happily"] },
  { id: "f05", dimension: "future", question: "How far ahead do you plan your life?", options: ["Years", "About a year", "A season", "This week"] },
  { id: "f06", dimension: "future", question: "Retirement, honestly?", options: ["As early as possible", "Slow down, never stop", "Never thought about it", "I'll be working forever anyway"] },
  { id: "f07", dimension: "future", question: "A job offer somewhere far away. First reaction?", options: ["Let's go", "Let's talk about it properly", "Only if we both benefit", "Instant no"] },
  { id: "f08", dimension: "future", question: "What should the next year be about?", options: ["Building something", "Slowing down", "Seeing more people", "Getting somewhere new"] },

  // ----------------------------------------------------------------- money
  { id: "n01", dimension: "money", question: "Money mostly means…", options: ["Security — save it", "Balance, mostly saving", "Balance, mostly spending", "Freedom — spend it"] },
  { id: "n02", dimension: "money", question: "An unexpected windfall. What happens?", options: ["Straight into savings", "Half saved, half spent", "One big thing", "Gone within a month"] },
  { id: "n03", dimension: "money", question: "Splitting things between you?", options: ["Everything shared, no counting", "Roughly even, no ledger", "Proportional to income", "Strictly separate"] },
  { id: "n04", dimension: "money", question: "How do you feel about debt?", options: ["Avoid entirely", "Fine for the right thing", "It's a normal tool", "I try not to look"] },
  { id: "n05", dimension: "money", question: "Where would you happily overspend?", options: ["Food and eating out", "Travel", "The home", "Nothing — I hate overspending"] },
  { id: "n06", dimension: "money", question: "Talking about money together is…", options: ["Easy and frequent", "Fine when needed", "Slightly awkward", "Avoided entirely"] },
  { id: "n07", dimension: "money", question: "Expensive gift or thoughtful cheap one?", options: ["Thoughtful, always", "Thoughtful, but effort shows", "Either — I like nice things", "Expensive, let's be honest"] },

  // ------------------------------------------------------------- affection
  { id: "a01", dimension: "affection", question: "How do you show you care?", options: ["Doing things for them", "Saying it out loud", "Time and full attention", "Small gifts, often"] },
  { id: "a02", dimension: "affection", question: "Public affection?", options: ["Constant, unbothered", "Hand-holding level", "Minimal", "Not in front of people"] },
  { id: "a03", dimension: "affection", question: "How often do you want to hear it?", options: ["Daily", "A few times a week", "When it's meant", "I'd rather see it than hear it"] },
  { id: "a04", dimension: "affection", question: "Best way to be comforted?", options: ["Held, no talking", "Talked through properly", "Distracted entirely", "Left alone first"] },
  { id: "a05", dimension: "affection", question: "Surprises?", options: ["Love them, always", "Love them, small ones", "Prefer a warning", "Please, no"] },
  { id: "a06", dimension: "affection", question: "How much time apart is healthy?", options: ["Very little", "An evening here and there", "A weekend regularly", "Weeks, honestly"] },

  // ------------------------------------------------------------- lifestyle
  { id: "y01", dimension: "lifestyle", question: "A free Saturday. What actually happens?", options: ["Plans, people, out all day", "One outing, then home", "Home, but productive", "Horizontal, unapologetically"] },
  { id: "y02", dimension: "lifestyle", question: "How far ahead do you like plans made?", options: ["Months", "A couple of weeks", "A few days", "Ask me when it starts"] },
  { id: "y03", dimension: "lifestyle", question: "Mess tolerance at home?", options: ["Spotless or nothing", "Tidy-ish, mostly", "Lived-in is fine", "It's a system, don't touch"] },
  { id: "y04", dimension: "lifestyle", question: "Mornings or nights?", options: ["Up at six, genuinely", "Morning-ish", "Evening person", "Awake at 1am, always"] },
  { id: "y05", dimension: "lifestyle", question: "Ideal evening in?", options: ["Cooking something together", "A film, no phones", "Both on our own thing, same sofa", "Friends over"] },
  { id: "y06", dimension: "lifestyle", question: "How much do you want to be out of the house?", options: ["Most evenings", "Two or three a week", "Once a week is plenty", "Almost never"] },
  { id: "y07", dimension: "lifestyle", question: "Holidays should be…", options: ["Packed with things", "A mix", "Mostly lying down", "Somewhere with nothing to do"] },

  // ---------------------------------------------------------------- social
  { id: "o01", dimension: "social", question: "A room of strangers. You…", options: ["Work the room", "Find two good conversations", "Stick with who I came with", "Leave early, quietly"] },
  { id: "o02", dimension: "social", question: "How big is your ideal dinner?", options: ["Ten people, chaos", "Six, comfortable", "Four, proper conversation", "Two"] },
  { id: "o03", dimension: "social", question: "Someone cancels on you last minute.", options: ["Genuinely annoyed", "Mildly annoyed", "Relieved", "Delighted"] },
  { id: "o04", dimension: "social", question: "Friends of theirs you don't click with?", options: ["I'd go anyway, happily", "I'd go sometimes", "You go without me", "I'd want that discussed"] },
  { id: "o05", dimension: "social", question: "How often should you see family?", options: ["Weekly", "Monthly", "A few times a year", "As little as possible"] },
  { id: "o06", dimension: "social", question: "Your phone at dinner?", options: ["Away, face down", "Out but ignored", "Checked occasionally", "In hand, obviously"] },

  // ------------------------------------------------------------- adventure
  { id: "e01", dimension: "adventure", question: "Ideal holiday?", options: ["Itinerary, museums, walking", "A mix of both", "Beach and a book", "Stay home"] },
  { id: "e02", dimension: "adventure", question: "Somewhere new or somewhere you love?", options: ["Always somewhere new", "Mostly new", "Mostly the same place", "The same place, forever"] },
  { id: "e03", dimension: "adventure", question: "Food you can't identify?", options: ["Order it immediately", "Ask, then order it", "Only if someone else tries", "Absolutely not"] },
  { id: "e04", dimension: "adventure", question: "The flight's cancelled. You…", options: ["Turn it into a better story", "Sort it calmly", "Get properly stressed", "Go home and give up"] },
  { id: "e05", dimension: "adventure", question: "Camping?", options: ["Love it, properly wild", "Yes, with a real bed nearby", "One night, maximum", "Never"] },
  { id: "e06", dimension: "adventure", question: "A completely unplanned weekend away, leaving in an hour?", options: ["Yes, packing now", "Yes, if I can shower first", "Only with a plan", "That sounds like a nightmare"] },

  // -------------------------------------------------------------- everyday
  { id: "x01", dimension: "everyday", question: "Who's driving?", options: ["Me, always", "Whoever's least tired", "You, please", "Neither — public transport"] },
  { id: "x02", dimension: "everyday", question: "Deciding where to eat?", options: ["I'll pick, confidently", "I'll shortlist, you choose", "You pick, I'll agree", "Neither of us ever decides"] },
  { id: "x03", dimension: "everyday", question: "Temperature in the bedroom?", options: ["Window open, freezing", "Cool", "Warm", "Buried under everything"] },
  { id: "x04", dimension: "everyday", question: "Chores get done…", options: ["On a rota", "Whoever notices first", "In one big weekly go", "Eventually, under duress"] },
  { id: "x05", dimension: "everyday", question: "Sunday morning?", options: ["Up early, out", "Slow breakfast", "Back to sleep", "Depends on Saturday night"] },
  { id: "x06", dimension: "everyday", question: "Watching a series together, one of you is ahead.", options: ["Unforgivable", "Annoying but survivable", "Fine, rewatch with me", "Who cares"] },
  { id: "x07", dimension: "everyday", question: "How loud is your home usually?", options: ["Music or TV always on", "Background noise, low", "Mostly quiet", "Silent, and I like it"] },
  { id: "c09", dimension: "conflict", question: "Being told to calm down mid-argument?", options: ["Fine, it usually works", "Depends how it's said", "It makes it worse", "That ends the conversation"] },
  { id: "c10", dimension: "conflict", question: "After it's resolved, do you revisit it?", options: ["Never, it's closed", "Once, to check we're fine", "A few days later", "It comes up again eventually"] },
  { id: "m09", dimension: "communication", question: "Someone's clearly upset but says they're fine.", options: ["Push, gently", "Leave it and stay close", "Take them at their word", "Ask again in an hour"] },
  { id: "m10", dimension: "communication", question: "Voice notes?", options: ["Love them", "Fine, if short", "Only when I can't type", "Never send one to me"] },
  { id: "v09", dimension: "values", question: "Is it okay to read your partner's messages if you suspect something?", options: ["Never, under any circumstances", "Only after asking first", "If it's serious enough, yes", "Yes — nothing should be hidden"] },
  { id: "v10", dimension: "values", question: "A white lie to avoid hurting someone?", options: ["Always wrong", "Fine for small things", "Fine most of the time", "It's just kindness"] },
  { id: "f09", dimension: "future", question: "Would you rather have unlimited travel or never pay for food again?", options: ["Travel, easily", "Travel, reluctantly", "Food, reluctantly", "Food, easily"] },
  { id: "n08", dimension: "money", question: "Buying something big without discussing it?", options: ["Never above a small amount", "Discuss anything notable", "My money, my call", "We're separate anyway"] },
  { id: "a07", dimension: "affection", question: "Being woken up for a hug?", options: ["Always welcome", "If it's not too early", "Rarely", "Do not touch me before 9am"] },
  { id: "y08", dimension: "lifestyle", question: "How much notice for someone coming over?", options: ["None needed", "A few hours", "A day", "A week and a warning"] },
  { id: "o07", dimension: "social", question: "Your partner's friends without you there?", options: ["Great, go", "Fine, tell me about it", "Slightly odd", "I'd rather come"] },
  { id: "e07", dimension: "adventure", question: "An activity you're bad at, in public?", options: ["Sign me up", "If we're all bad at it", "Only with no audience", "Absolutely not"] },
  { id: "x08", dimension: "everyday", question: "The washing-up gets done…", options: ["Immediately after eating", "Before bed", "In the morning", "When we run out of plates"] },
  { id: "x09", dimension: "everyday", question: "Shoes in the house?", options: ["Off at the door, always", "Off, but I don't police it", "Whatever", "On, obviously"] },
];

/** Playful, never clinical — the copy on the result screen. */
export const MATCH_VERDICTS: { min: number; headline: string; line: string }[] = [
  { min: 88, headline: "Suspiciously aligned", line: "Either you've been together a long time or one of you was reading over the other's shoulder." },
  { min: 74, headline: "Very much the same page", line: "You agree about the things that cause arguments, which is the useful kind of agreeing." },
  { min: 60, headline: "Comfortably compatible", line: "Enough overlap to make plans easily, enough difference to still be interesting." },
  { min: 46, headline: "Complementary, mostly", line: "You'd describe the same weekend in completely different words and both enjoy it." },
  { min: 32, headline: "Opposites, functioning", line: "This works because you're different, not despite it. Probably. Mostly." },
  { min: 0, headline: "Genuinely unalike", line: "On paper this shouldn't work. On paper is not where you live." },
];

/** Extra colour, chosen based on the actual answer pattern. */
export const MATCH_OBSERVATIONS: {
  test: (s: { perfect: number; near: number; far: number; total: number }) => boolean;
  text: string;
}[] = [
  { test: (s) => s.perfect / s.total >= 0.7, text: "You picked the identical answer on most of these, which is either lovely or slightly worrying." },
  { test: (s) => (s.perfect + s.near) / s.total >= 0.8 && s.perfect / s.total < 0.7, text: "Rarely identical, almost never far apart — the useful kind of similar." },
  { test: (s) => s.far / s.total >= 0.35, text: "You're properly different on a third of these. That's a feature until it's a Tuesday." },
  { test: (s) => s.perfect / s.total < 0.2, text: "Very few exact matches. Whatever's working here clearly isn't sameness." },
  { test: (s) => s.near / s.total >= 0.45, text: "Loads of near-misses: same instinct, different wording." },
  { test: () => true, text: "A normal amount of overlap — enough to agree on dinner, not enough to get bored." },
];

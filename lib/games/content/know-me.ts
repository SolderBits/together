export type KnowMeCategory =
  | "light"
  | "funny"
  | "unexpected"
  | "relationship"
  | "deep"
  | "future"
  | "flirty";

export interface KnowMeQuestion {
  id: string;
  category: KnowMeCategory;
  /** Asked of the guesser, in the second person about the subject. */
  prompt: string;
  /** Short restatement used when the subject answers about themselves. */
  subject: string;
  options: [string, string, string, string];
}

export const KNOW_ME_CATEGORIES: {
  id: KnowMeCategory;
  label: string;
  blurb: string;
}[] = [
  { id: "light", label: "Light", blurb: "habits and everyday tells" },
  { id: "funny", label: "Funny", blurb: "the embarrassing stuff" },
  { id: "unexpected", label: "Unexpected", blurb: "questions from an odd angle" },
  { id: "relationship", label: "Relationship", blurb: "us, specifically" },
  { id: "deep", label: "Deep", blurb: "fears, values, the real answers" },
  { id: "future", label: "Future", blurb: "what happens next" },
  { id: "flirty", label: "Flirty", blurb: "tasteful, mostly" },
];

/**
 * Data-driven. Add a question and it enters rotation immediately; the game
 * picks a balanced spread across categories from the room seed, so no two
 * rooms open with the same eight.
 */
export const KNOW_ME_QUESTIONS: KnowMeQuestion[] = [
  // ---------------------------------------------------------------- light
  { id: "l01", category: "light", prompt: "What's my actual coffee order?", subject: "my real order", options: ["Black, no ceremony", "Something milky and sweet", "Whatever's fastest", "I don't drink it and you know this"] },
  { id: "l02", category: "light", prompt: "How do I load a dishwasher?", subject: "my dishwasher method", options: ["A system, and it's correct", "Wherever it fits", "Rinse everything first, obsessively", "I avoid the dishwasher entirely"] },
  { id: "l03", category: "light", prompt: "What's the first thing I do when I get home?", subject: "my first move at home", options: ["Shoes off, phone down, silence", "Straight to the fridge", "Change clothes immediately", "Collapse somewhere horizontal"] },
  { id: "l04", category: "light", prompt: "How many alarms do I actually set?", subject: "my alarm situation", options: ["One, and I get up", "Three, minimum", "One, snoozed six times", "None — I just wake up"] },
  { id: "l05", category: "light", prompt: "What's in my bag that shouldn't be?", subject: "the thing in my bag", options: ["An embarrassing number of receipts", "Something that should be refrigerated", "Chargers for devices I no longer own", "Nothing — my bag is immaculate"] },
  { id: "l06", category: "light", prompt: "How do I handle a long queue?", subject: "me in a queue", options: ["Phone out, gone", "Quietly seething", "Chatting to someone", "I leave"] },
  { id: "l07", category: "light", prompt: "What's my temperature preference in bed?", subject: "how I sleep", options: ["Window open, freezing", "Buried under everything", "One leg out, always", "Depends entirely on the day"] },
  { id: "l08", category: "light", prompt: "How do I eat pizza?", subject: "my pizza method", options: ["Folded, walking", "Knife and fork, unashamed", "Crust first", "Crust abandoned on the plate"] },
  { id: "l09", category: "light", prompt: "What am I like at the supermarket?", subject: "me shopping", options: ["List, route, done in nine minutes", "No list, three impulse buys", "Every label read twice", "I send someone else"] },
  { id: "l10", category: "light", prompt: "How full is my phone storage?", subject: "my phone storage", options: ["Nearly empty, all backed up", "Permanently at 98%", "Full of screenshots I'll never open", "I have no idea and don't want one"] },
  { id: "l11", category: "light", prompt: "What's my relationship with houseplants?", subject: "me and plants", options: ["Thriving jungle", "One survivor, barely", "I've stopped trying", "I forget I own any"] },
  { id: "l14", category: "light", prompt: "How do I watch a film I've seen before?", subject: "me on a rewatch", options: ["Fully engaged, again", "On my phone for most of it", "Quoting the lines out loud", "Asleep by minute twenty"] },
  { id: "l15", category: "light", prompt: "What's my hair like on a day off?", subject: "day-off hair", options: ["Exactly the same as always", "Genuinely untouched", "Under a hat", "A situation I'm ignoring"] },
  { id: "l16", category: "light", prompt: "What's my go-to karaoke song?", subject: "my karaoke song", options: ["Something everyone can sing", "Something wildly out of my range", "A ballad, taken seriously", "I do not sing in public"] },
  { id: "l18", category: "light", prompt: "What do I do with the last bite of something good?", subject: "my last bite", options: ["Savour it deliberately", "Offer it to you", "Eaten before I noticed", "Left there, mysteriously"] },
  { id: "l19", category: "light", prompt: "What's my browser tab situation?", subject: "my tabs", options: ["Fewer than five, always", "Somewhere past forty", "Closed nightly, ritually", "Multiple windows, no hope"] },
  { id: "l20", category: "light", prompt: "How early do I get to the airport?", subject: "my airport timing", options: ["Three hours, non-negotiable", "Comfortably on time", "Sprinting, every time", "Depends who's booking"] },

  // ---------------------------------------------------------------- funny
  { id: "f01", category: "funny", prompt: "What would I do if I walked into a glass door in public?", subject: "me after walking into glass", options: ["Laugh loudest, own it", "Pretend it didn't happen", "Blame the door out loud", "Leave the building"] },
  { id: "f02", category: "unexpected", prompt: "What's my most unhinged 3am thought?", subject: "my 3am thought", options: ["Something I said in 2014", "Whether the door is locked", "A genuinely good business idea", "Nothing — I'm asleep"] },
  { id: "f03", category: "funny", prompt: "What noise do I make standing up from a low sofa?", subject: "my getting-up noise", options: ["A full old-man groan", "A small involuntary 'hup'", "Nothing, I'm silent", "A complaint aimed at nobody"] },
  { id: "f04", category: "unexpected", prompt: "What would I do if I accidentally waved back at someone waving past me?", subject: "the phantom wave", options: ["Convert it into a hair-touch", "Commit and keep waving", "Immediately tell you", "Never speak of it again"] },
  { id: "f05", category: "unexpected", prompt: "How would I behave in a zombie apocalypse?", subject: "me in an apocalypse", options: ["Alarmingly competent", "Panic, then adapt", "Immediately negotiating with zombies", "Gone in the first ten minutes"] },
  { id: "f06", category: "funny", prompt: "What's my most irrational fear?", subject: "my irrational fear", options: ["Something in the deep water", "The bit where the escalator ends", "Phone calls from unknown numbers", "Being perceived while eating"] },
  { id: "f07", category: "funny", prompt: "What do I do when a waiter says 'enjoy your meal'?", subject: "my waiter response", options: ["'You too' — every time", "A clean thank you", "An awkward half-nod", "I've said something worse"] },
  { id: "f08", category: "funny", prompt: "If I were a background character in a film, what would I be doing?", subject: "my background role", options: ["Reading a newspaper suspiciously", "Carrying an enormous box", "Laughing at nothing in a café", "Walking the wrong way through everything"] },
  { id: "f09", category: "funny", prompt: "What's the pettiest thing I've held a grudge about?", subject: "my pettiest grudge", options: ["Something about a queue", "A misused word", "Someone else's driving", "Being told to calm down"] },
  { id: "f10", category: "unexpected", prompt: "What would I do with a completely free hour and no phone?", subject: "an hour, no phone", options: ["Sleep immediately", "Reorganise something", "Go outside on purpose", "Spiral quietly"] },
  { id: "f11", category: "funny", prompt: "How do I react to a jump scare?", subject: "me, jump-scared", options: ["Full scream, no shame", "Total silence, then shaking", "Laugh instantly", "I saw it coming and said so"] },
  { id: "f12", category: "funny", prompt: "What's my worst kitchen habit?", subject: "my kitchen crime", options: ["Leaving one thing to 'soak'", "Tasting with the stirring spoon", "Using every pan available", "Declaring things 'still fine'"] },
  { id: "f13", category: "funny", prompt: "If I got famous, what would it be for?", subject: "my hypothetical fame", options: ["Something mildly embarrassing", "A skill nobody asked about", "Being in the background of something", "An extremely specific opinion"] },
  { id: "f14", category: "funny", prompt: "What do I do when I can't find my phone?", subject: "the phone hunt", options: ["Ask you to call it", "Retrace every step out loud", "Find it in my hand", "Accept it's gone forever"] },
  { id: "f15", category: "funny", prompt: "What's my dance floor strategy?", subject: "me dancing", options: ["Two moves, deployed confidently", "The edge, holding drinks", "Fully committed after one drink", "Genuinely quite good"] },
  { id: "f16", category: "funny", prompt: "What lie do I tell most often?", subject: "my most common lie", options: ["'I'm five minutes away'", "'I've already eaten'", "'I'm not tired'", "'Sure, I read it'"] },
  { id: "f17", category: "funny", prompt: "How do I behave in a group photo?", subject: "me in group photos", options: ["Same face every time", "Blinking, always", "Trying something and regretting it", "Hiding at the back"] },
  { id: "f18", category: "unexpected", prompt: "What would I panic-buy first?", subject: "my panic buy", options: ["Absurd amounts of one food", "Batteries and torches", "Something completely useless", "Nothing — I'd assume it's fine"] },

  // --------------------------------------------------------- relationship
  { id: "r01", category: "relationship", prompt: "What do I remember most clearly about when we met?", subject: "what I remember", options: ["Something you said", "What you were wearing", "How nervous I was", "A detail you'd find odd"] },
  { id: "r02", category: "relationship", prompt: "What do I do when I'm annoyed but pretending not to be?", subject: "my tell", options: ["Get very polite", "Go quiet", "Suddenly start tidying", "Ask a loaded question"] },
  { id: "r03", category: "relationship", prompt: "How do I like to be comforted?", subject: "what comforts me", options: ["Held, no talking", "Talked through it properly", "Distracted entirely", "Left alone for an hour first"] },
  { id: "r04", category: "relationship", prompt: "What's my love language, honestly?", subject: "how I show love", options: ["Doing things without being asked", "Saying it, often", "Time with no phones", "Small gifts, badly wrapped"] },
  { id: "r05", category: "relationship", prompt: "What do I find most attractive about you?", subject: "what gets me", options: ["How you talk about things you love", "Your face, obviously", "How you treat other people", "Your complete lack of shame"] },
  { id: "r06", category: "relationship", prompt: "What's the thing I'd never admit annoys me?", subject: "my quiet annoyance", options: ["A noise you make", "How you tell stories", "Your timekeeping", "Something about the bed"] },
  { id: "r07", category: "relationship", prompt: "How long do I stay upset after an argument?", subject: "my recovery time", options: ["Ten minutes, then fine", "A few hours, quietly", "Until it's properly resolved", "Longer than I let on"] },
  { id: "r08", category: "relationship", prompt: "What did I think of you within the first five minutes?", subject: "my first read", options: ["This one's trouble", "Genuinely intimidated", "Instantly comfortable", "Not much, honestly — that came later"] },
  { id: "r09", category: "relationship", prompt: "What's my favourite ordinary thing we do?", subject: "my favourite ordinary thing", options: ["The drive somewhere", "Cooking badly together", "Sitting in the same room, silent", "The walk after dinner"] },
  { id: "r10", category: "relationship", prompt: "What would I say is our worst habit as a pair?", subject: "our worst habit", options: ["Never deciding where to eat", "Both waiting for the other to sort it", "Staying up far too late", "Having the same argument twice"] },
  { id: "r11", category: "relationship", prompt: "What's something you do that I quietly copied?", subject: "what I stole from you", options: ["A phrase I now say constantly", "How you make coffee", "An opinion I pretend was mine", "The way you handle people"] },
  { id: "r12", category: "relationship", prompt: "How do I actually feel about surprises from you?", subject: "me and your surprises", options: ["Love them without reservation", "Love them, need a warning", "Prefer to be consulted", "Depends entirely on the surprise"] },
  { id: "r13", category: "relationship", prompt: "What do I miss most when you're away?", subject: "what I miss", options: ["The noise of you being there", "Someone to tell things to", "The routine", "Honestly, the food improves"] },
  { id: "r14", category: "relationship", prompt: "What's the kindest thing I've done that I never mentioned?", subject: "my unmentioned kindness", options: ["Handled something so you didn't have to", "Defended you when you weren't there", "Remembered something small", "Paid for something quietly"] },
  { id: "r15", category: "relationship", prompt: "Which of us apologises first, usually?", subject: "who folds first", options: ["Me, almost always", "You, almost always", "Whoever's more tired", "Nobody — we just move on"] },
  { id: "r16", category: "relationship", prompt: "What do I think our friends say about us?", subject: "what they say", options: ["That we're weirdly similar", "That we bicker constantly", "That we're annoyingly fine", "That they can't picture us apart"] },
  { id: "r17", category: "relationship", prompt: "What's the thing I'd want you to say more often?", subject: "what I want to hear", options: ["That you're proud of me", "That I was right", "What you're actually thinking", "Nothing — you say plenty"] },
  { id: "r18", category: "relationship", prompt: "How do I feel about doing nothing together?", subject: "me and doing nothing", options: ["It's the whole point", "Fine for an hour, then restless", "Only if there's a plan later", "I struggle with it"] },

  // ----------------------------------------------------------------- deep
  { id: "d01", category: "deep", prompt: "What am I most afraid of, genuinely?", subject: "my real fear", options: ["Being a disappointment", "Running out of time", "Being alone with it", "Not having tried"] },
  { id: "d02", category: "deep", prompt: "What do I think I'm worst at?", subject: "my weak spot", options: ["Asking for help", "Letting things go", "Saying no", "Sitting still"] },
  { id: "d03", category: "deep", prompt: "What would I change about how I was raised?", subject: "what I'd change", options: ["More honesty at home", "Less pressure", "More encouragement to leave", "Nothing — it worked"] },
  { id: "d04", category: "deep", prompt: "When do I feel most like myself?", subject: "when I'm most me", options: ["Working on something I chose", "With people who knew me early", "Alone, moving", "Late at night, no plans"] },
  { id: "d05", category: "deep", prompt: "What compliment would actually land with me?", subject: "the compliment that lands", options: ["That I'm good to be around", "That I did the hard thing", "That I've changed for the better", "That I'm funny"] },
  { id: "d06", category: "deep", prompt: "What do I think people misread about me?", subject: "what people get wrong", options: ["That I'm confident", "That I don't care", "That I'm easy-going", "That I'm difficult"] },
  { id: "d07", category: "deep", prompt: "What would I do with a year off and no consequences?", subject: "my year off", options: ["Leave and keep moving", "Finally make the thing", "Learn something properly", "Rest, genuinely rest"] },
  { id: "d08", category: "deep", prompt: "What do I regret not saying?", subject: "what I didn't say", options: ["Something to family", "Something to an old friend", "Something to you, earlier", "That I wasn't okay"] },
  { id: "d09", category: "deep", prompt: "What's my relationship with being wrong?", subject: "me, being wrong", options: ["Fine, once I've had a minute", "Genuinely enjoy it", "Hate it and show it", "Hate it and hide it"] },
  { id: "d10", category: "deep", prompt: "What do I need more of right now?", subject: "what I need", options: ["Sleep, unglamorously", "Something to look forward to", "Less noise from everyone", "Someone to tell me it's fine"] },
  { id: "d11", category: "deep", prompt: "What am I proudest of that nobody knows about?", subject: "my quiet pride", options: ["Something I stopped doing", "A thing I made and shelved", "Someone I helped", "Getting through a specific year"] },
  { id: "d12", category: "deep", prompt: "What does home mean to me?", subject: "home, to me", options: ["A place", "A person", "A feeling I'm still chasing", "Wherever my stuff is"] },
  { id: "d13", category: "unexpected", prompt: "What would younger me think of me now?", subject: "younger me's verdict", options: ["Relieved", "Confused but impressed", "Disappointed about one thing", "Wouldn't recognise me"] },
  { id: "d14", category: "deep", prompt: "What do I do when I'm not okay?", subject: "how I cope", options: ["Get very busy", "Go quiet and vanish", "Overshare with the wrong person", "Sleep through it"] },
  { id: "d15", category: "deep", prompt: "What's a belief I've changed my mind about?", subject: "what I changed my mind on", options: ["What success looks like", "Who deserves patience", "Whether people change", "How much I need other people"] },
  { id: "d16", category: "deep", prompt: "What do I want to be remembered for?", subject: "what I'd want said", options: ["That I was kind about it", "That I made something", "That I was fun to be near", "That I showed up"] },

  // --------------------------------------------------------------- future
  { id: "u01", category: "future", prompt: "Where do I actually want to live in ten years?", subject: "where I'd live", options: ["A city, properly in it", "Somewhere small and green", "Near water, non-negotiable", "Wherever the work is"] },
  { id: "u02", category: "future", prompt: "What's my dream home like?", subject: "my dream home", options: ["Old, with character and problems", "New, warm, low-maintenance", "Small and paid for", "Big enough for everyone"] },
  { id: "u03", category: "future", prompt: "What trip do I most want to take?", subject: "the trip I want", options: ["Somewhere with no plan at all", "A long train journey", "Somewhere I've been before", "Somewhere I can't pronounce"] },
  { id: "u04", category: "future", prompt: "How do I feel about a big move?", subject: "me and moving", options: ["Ready tomorrow", "Only with a real reason", "Terrified but tempted", "Absolutely not"] },
  { id: "u05", category: "unexpected", prompt: "What would I do if money genuinely stopped mattering?", subject: "money-free me", options: ["Keep working, differently", "Stop entirely and travel", "Build something", "Give most of it away"] },
  { id: "u06", category: "future", prompt: "What kind of old person will I be?", subject: "old me", options: ["Impossible and delighted about it", "Serene and gardening", "Still working on something", "Loudly opinionated in a café"] },
  { id: "u07", category: "future", prompt: "What tradition do I want us to start?", subject: "my tradition", options: ["The same trip every year", "A ridiculous annual photo", "One meal we always cook", "A day where we cancel everything"] },
  { id: "u08", category: "future", prompt: "What skill do I actually intend to learn?", subject: "my next skill", options: ["A language, properly this time", "An instrument", "Something with my hands", "To drive / drive better"] },
  { id: "u09", category: "future", prompt: "How do I picture our perfect ordinary Sunday in five years?", subject: "our future Sunday", options: ["Slow, at home, no plans", "Out early, back late", "People round for food", "Genuinely no idea yet"] },
  { id: "u10", category: "future", prompt: "What's the thing I most want to stop worrying about?", subject: "what I want to drop", options: ["Money", "What people think", "Whether I'm behind", "My health"] },
  { id: "u11", category: "future", prompt: "What's my honest position on pets?", subject: "me and pets", options: ["A dog, immediately", "A cat, obviously", "Something low-effort", "None, and I'll hold that line"] },
  { id: "u12", category: "future", prompt: "What does 'settled' mean to me?", subject: "settled, to me", options: ["A place that's ours", "Not checking my bank app", "Knowing next year's shape", "It doesn't appeal at all"] },
  { id: "u13", category: "unexpected", prompt: "What's the risk I'll probably take?", subject: "my likely risk", options: ["Quitting something good", "Moving somewhere unreasonable", "Putting money into an idea", "Saying the thing out loud"] },
  { id: "u14", category: "future", prompt: "What do I want the next year to be about?", subject: "my next year", options: ["Building something", "Slowing down", "Seeing more people", "Getting somewhere new"] },

  // --------------------------------------------------------------- flirty
  { id: "s01", category: "flirty", prompt: "What do I notice first when you walk in?", subject: "what I notice", options: ["Your face doing something", "What you've done with your hair", "How you're carrying yourself", "Whatever you're wearing"] },
  { id: "s03", category: "flirty", prompt: "What makes me visibly flustered?", subject: "what flusters me", options: ["Being complimented in front of people", "You looking at me too long", "Being called something soft", "Genuinely nothing"] },
  { id: "s04", category: "flirty", prompt: "What's my ideal way to be woken up?", subject: "how to wake me", options: ["Coffee, no conversation", "Gently, and slowly", "Not at all, ideally", "Whatever's happening, I'm in"] },
  { id: "s05", category: "flirty", prompt: "Where's my favourite place to be kissed?", subject: "my favourite spot", options: ["Forehead, every time", "The side of the neck", "Hand, out of nowhere", "Anywhere, mid-sentence"] },
  { id: "s06", category: "flirty", prompt: "What's the most romantic thing I've actually done?", subject: "my most romantic act", options: ["Something small and daily", "A trip I planned in secret", "Something I wrote down", "Turned up when it was hard"] },
  { id: "s07", category: "flirty", prompt: "How do I flirt when I'm out of practice?", subject: "my rusty flirting", options: ["Relentless teasing", "Go weirdly formal", "Compliments that land oddly", "Just stare, apparently"] },
  { id: "s08", category: "flirty", prompt: "What's my ideal date night, no budget?", subject: "my perfect night", options: ["Somewhere absurdly nice, dressed up", "A dive bar and no phones", "Home, cooking, terrible film", "Somewhere neither of us has been"] },
  { id: "s10", category: "flirty", prompt: "What do I do when you're getting ready and I'm waiting?", subject: "me, waiting", options: ["Watch and say nothing", "Hurry you every 90 seconds", "Get distracted entirely", "Quietly enjoy it"] },
  { id: "s11", category: "flirty", prompt: "What's my move when I want attention?", subject: "my attention move", options: ["Stand suspiciously close", "Start a pointless argument", "Say something outrageous", "Sulk until noticed"] },
  { id: "x01", category: "unexpected", prompt: "If I had to give a twenty-minute talk with no notes, what would it be on?", subject: "my no-notes talk", options: ["A grievance I've refined for years", "Something I'm genuinely expert in", "A conspiracy I half-believe", "How to do one very small thing properly"] },
  { id: "x02", category: "unexpected", prompt: "What would I do first if I woke up as a completely different person?", subject: "me, as someone else", options: ["Go through their phone", "Try their job for a day", "Contact my own family immediately", "Enjoy it and tell nobody"] },
  { id: "x03", category: "unexpected", prompt: "What's the first thing I'd grab if the building had to be emptied in sixty seconds?", subject: "what I'd grab", options: ["Something with photos on it", "Documents, boringly", "Something with no monetary value", "Nothing — I'd just leave"] },
  { id: "x04", category: "unexpected", prompt: "What smell would put me somewhere else instantly?", subject: "my time-machine smell", options: ["Something from a kitchen", "Rain on hot pavement", "A specific perfume or aftershave", "Something industrial and odd"] },
  { id: "x05", category: "unexpected", prompt: "If someone made a documentary about me, what would the misleading title be?", subject: "my documentary title", options: ["Something dramatic and undeserved", "A single word, ominously", "Something aggressively boring", "A pun I'd hate"] },
  { id: "x06", category: "unexpected", prompt: "What would I be unreasonably good at in a parallel life?", subject: "my parallel-life talent", options: ["Something physical and outdoorsy", "Something with numbers", "Talking people into things", "Something with my hands"] },
  { id: "x07", category: "unexpected", prompt: "What's the most useless thing I'd defend in an argument?", subject: "my useless hill", options: ["The correct way to load a dishwasher", "A film nobody else likes", "How a word should be pronounced", "The right route somewhere"] },
  { id: "x08", category: "unexpected", prompt: "If I could delete one thing from the world entirely, what goes?", subject: "what I'd delete", options: ["A specific sound", "A social obligation", "An entire category of admin", "One food, permanently"] },
  { id: "x09", category: "unexpected", prompt: "What would I do with a day that nobody could ever find out about?", subject: "my untraceable day", options: ["Sleep, honestly", "Something mildly illegal", "Confront somebody", "Exactly what I'd do anyway"] },
  { id: "x10", category: "unexpected", prompt: "What object in my home would surprise you most?", subject: "my surprising object", options: ["Something I've kept far too long", "Something wildly impractical", "Something I've never mentioned", "Something broken I refuse to bin"] },
  { id: "s14", category: "flirty", prompt: "What do I find unreasonably attractive?", subject: "my weakness", options: ["Someone being good at something", "Being genuinely funny", "Confidence about small things", "Kindness to strangers"] },
  { id: "u15", category: "future", prompt: "What's the first thing I'd buy for a place that was ours?", subject: "my first purchase", options: ["An absurdly good sofa", "Something for the kitchen", "Art nobody else would pick", "Plants I'd then kill"] },
  { id: "u16", category: "future", prompt: "How do I feel about having people to stay?", subject: "me and houseguests", options: ["Love it, cook too much", "Fine for two nights", "Only people I really like", "I'd rather not"] },
  { id: "d17", category: "deep", prompt: "What do I do with a compliment I don't believe?", subject: "compliments I doubt", options: ["Accept it and privately dismiss it", "Argue with it out loud", "Ask what they mean", "Keep it and think about it later"] },
  { id: "d18", category: "deep", prompt: "What's the thing I'd fix about myself if it were one click?", subject: "my one-click fix", options: ["Stop overthinking", "Be less defensive", "Care less what people think", "Actually finish things"] },
];

export const KNOW_ME_BY_CATEGORY = (category: KnowMeCategory) =>
  KNOW_ME_QUESTIONS.filter((q) => q.category === category);

/**
 * The shape of a round.
 *
 * A session should warm up, get funny, get personal, then land somewhere that
 * actually matters — rather than opening with "what are you most afraid of".
 * Each slot names the category the question is drawn from, in order.
 */
export const KNOW_ME_ARC: KnowMeCategory[] = [
  "light",
  "light",
  "funny",
  "funny",
  "relationship",
  "relationship",
  "unexpected",
  "unexpected",
  "deep",
  "flirty",
];

/** A shorter arc for when people want a quick round. */
export const KNOW_ME_SHORT_ARC: KnowMeCategory[] = [
  "light",
  "funny",
  "relationship",
  "unexpected",
  "deep",
  "flirty",
];

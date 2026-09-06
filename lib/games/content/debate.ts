export type DebateCategory =
  | "relationships"
  | "everyday"
  | "money"
  | "travel"
  | "food"
  | "culture"
  | "wouldrather"
  | "hottake"
  | "funny"
  | "absurd"
  | "serious";

export interface DebateTopic {
  id: string;
  motion: string;
  sideA: string;
  sideB: string;
  category: DebateCategory;
  /**
   * How much it'll actually cost you to argue this one.
   * 1 = pure fun, 2 = you'll have an opinion, 3 = someone will get invested.
   * Later rounds bias toward higher heat, so a session escalates.
   */
  heat: 1 | 2 | 3;
}

export const DEBATE_CATEGORIES: { id: DebateCategory; label: string }[] = [
  { id: "funny", label: "Funny" },
  { id: "hottake", label: "Hot takes" },
  { id: "wouldrather", label: "Would you rather" },
  { id: "everyday", label: "Everyday" },
  { id: "food", label: "Food" },
  { id: "travel", label: "Travel" },
  { id: "culture", label: "Pop culture" },
  { id: "money", label: "Money" },
  { id: "relationships", label: "Relationships" },
  { id: "absurd", label: "Absurd" },
  { id: "serious", label: "Serious" },
];

export const DEBATE_TOPICS: DebateTopic[] = [
  // relationships
  { id: "r01", motion: "The person who started the argument should apologise first", sideA: "They should", sideB: "Whoever's calmer should", category: "relationships", heat: 3 },
  { id: "r02", motion: "It's okay to read your partner's messages if you genuinely suspect something", sideA: "Sometimes justified", sideB: "Never justified", category: "relationships", heat: 3 },
  { id: "r03", motion: "Couples should share all their passwords", sideA: "Share everything", sideB: "Keep them separate", category: "relationships", heat: 3 },
  { id: "r04", motion: "Going to bed angry is always a mistake", sideA: "Always fix it first", sideB: "Sleep helps", category: "relationships", heat: 3 },
  { id: "r05", motion: "You should tell your partner everything about your past", sideA: "Full disclosure", sideB: "Some things stay yours", category: "relationships", heat: 3 },
  { id: "r06", motion: "Separate holidays are healthy", sideA: "Healthy", sideB: "A warning sign", category: "relationships", heat: 3 },
  { id: "r07", motion: "It's fine to be close friends with an ex", sideA: "Completely fine", sideB: "Asking for trouble", category: "relationships", heat: 3 },
  { id: "r08", motion: "Couples should have entirely separate finances", sideA: "Separate", sideB: "Combined", category: "money", heat: 3 },
  { id: "r10", motion: "Saying 'I'm fine' when you're not is a form of lying", sideA: "It is", sideB: "It's self-protection", category: "relationships", heat: 3 },
  { id: "r11", motion: "Big gestures matter more than small daily ones", sideA: "Big gestures", sideB: "Small daily ones", category: "relationships", heat: 3 },
  { id: "r12", motion: "You should always answer your partner's calls", sideA: "Always", sideB: "Call back when you can", category: "relationships", heat: 3 },
  { id: "r14", motion: "Keeping one small secret is healthy", sideA: "Healthy", sideB: "Corrosive", category: "relationships", heat: 3 },
  { id: "r15", motion: "Public displays of affection should be kept minimal", sideA: "Keep it minimal", sideB: "Who cares", category: "relationships", heat: 3 },

  // money
  { id: "m01", motion: "Experiences are always better value than things", sideA: "Experiences", sideB: "Things last", category: "money", heat: 3 },
  { id: "m02", motion: "You should never lend money to friends", sideA: "Never lend", sideB: "Lend freely", category: "money", heat: 3 },
  { id: "m03", motion: "Tipping culture has gone too far", sideA: "Too far", sideB: "It's fine", category: "money", heat: 3 },
  { id: "m04", motion: "Buying a house is always better than renting", sideA: "Buy", sideB: "Rent", category: "money", heat: 3 },
  { id: "m05", motion: "It's worth paying more for something that lasts", sideA: "Always", sideB: "Rarely worth it", category: "money", heat: 3 },
  { id: "m06", motion: "Splitting the bill evenly is the fairest way", sideA: "Split evenly", sideB: "Pay for what you had", category: "money", heat: 3 },
  { id: "m07", motion: "Talking about salary openly should be normal", sideA: "Be open", sideB: "Keep it private", category: "money", heat: 3 },
  { id: "m08", motion: "Saving for retirement matters more than enjoying your thirties", sideA: "Save", sideB: "Enjoy it", category: "money", heat: 3 },
  { id: "m09", motion: "Subscriptions are a scam", sideA: "A scam", sideB: "Good value", category: "money", heat: 3 },

  // travel
  { id: "t01", motion: "Surprise trips are better than planned ones", sideA: "Surprise", sideB: "Planned", category: "travel", heat: 2 },
  { id: "t02", motion: "Returning to the same place every year is a waste", sideA: "A waste", sideB: "The whole point", category: "travel", heat: 2 },
  { id: "t03", motion: "You should never book the first flight of the day", sideA: "Never", sideB: "Always", category: "travel", heat: 2 },
  { id: "t04", motion: "Three hours early at the airport is reasonable", sideA: "Reasonable", sideB: "Absurd", category: "travel", heat: 2 },
  { id: "t05", motion: "Holidays should have zero itinerary", sideA: "Zero plans", sideB: "Plan it properly", category: "travel", heat: 2 },
  { id: "t06", motion: "Hand luggage only is always the right call", sideA: "Always", sideB: "Check the bag", category: "travel", heat: 2 },
  { id: "t07", motion: "Tourist attractions are usually worth it", sideA: "Worth it", sideB: "Overrated", category: "travel", heat: 2 },
  { id: "t08", motion: "A road trip beats a flight every time", sideA: "Road trip", sideB: "Fly", category: "travel", heat: 2 },
  { id: "t09", motion: "You should learn some of the language before you go", sideA: "Learn it", sideB: "Don't bother", category: "travel", heat: 2 },
  { id: "t10", motion: "Would you rather have unlimited travel or never pay for food again?", sideA: "Unlimited travel", sideB: "Free food forever", category: "wouldrather", heat: 1 },

  // food
  { id: "f01", motion: "Pineapple belongs on pizza", sideA: "For", sideB: "Against", category: "food", heat: 1 },
  { id: "f02", motion: "Breakfast food is acceptable at any hour", sideA: "Any hour", sideB: "Mornings only", category: "food", heat: 1 },
  { id: "f03", motion: "Cereal counts as a meal", sideA: "It counts", sideB: "It doesn't", category: "food", heat: 1 },
  { id: "f04", motion: "Cooking together is better than eating out", sideA: "Cook", sideB: "Go out", category: "food", heat: 1 },
  { id: "f05", motion: "There's no such thing as too much garlic", sideA: "No such thing", sideB: "There absolutely is", category: "food", heat: 1 },
  { id: "f06", motion: "Sharing plates ruins a meal", sideA: "Ruins it", sideB: "Makes it", category: "food", heat: 1 },
  { id: "f07", motion: "A sandwich is a sandwich regardless of shape", sideA: "It is", sideB: "Shape matters", category: "food", heat: 1 },
  { id: "f08", motion: "Dessert should come before the main course", sideA: "Dessert first", sideB: "Traditional order", category: "food", heat: 1 },
  { id: "f09", motion: "Coriander tastes of soap and that's a fact", sideA: "Soap", sideB: "Delicious", category: "food", heat: 1 },
  { id: "f10", motion: "Leftovers are better the next day", sideA: "Better", sideB: "Worse", category: "food", heat: 1 },
  { id: "f11", motion: "You should never send food back in a restaurant", sideA: "Never", sideB: "Send it back", category: "food", heat: 1 },
  { id: "f12", motion: "Instant coffee is genuinely fine", sideA: "Fine", sideB: "An insult", category: "food", heat: 1 },

  // lifestyle
  { id: "l01", motion: "The bed should be made every morning", sideA: "Make it", sideB: "Leave it", category: "everyday", heat: 2 },
  { id: "l02", motion: "Shoes should always come off at the door", sideA: "Always off", sideB: "Who cares", category: "everyday", heat: 2 },
  { id: "l03", motion: "It's fine to text during a film", sideA: "Fine", sideB: "Never", category: "everyday", heat: 2 },
  { id: "l04", motion: "Living in a city beats living somewhere quiet", sideA: "City", sideB: "Quiet", category: "everyday", heat: 2 },
  { id: "l05", motion: "Chores should be split by strict rota", sideA: "Rota", sideB: "By feel", category: "everyday", heat: 2 },
  { id: "l06", motion: "Early mornings are morally superior", sideA: "They are", sideB: "Nonsense", category: "everyday", heat: 2 },
  { id: "l07", motion: "You should reply to a message within a day", sideA: "Within a day", sideB: "Whenever", category: "everyday", heat: 2 },
  { id: "l08", motion: "Owning fewer things makes you happier", sideA: "Fewer things", sideB: "Keep your stuff", category: "everyday", heat: 2 },
  { id: "l09", motion: "Phones should be banned from the dinner table", sideA: "Banned", sideB: "Relax", category: "everyday", heat: 2 },
  { id: "l10", motion: "Working from home is better in every way", sideA: "Better", sideB: "Worse", category: "everyday", heat: 2 },
  { id: "l12", motion: "Plants make a home; ornaments don't", sideA: "Plants", sideB: "Ornaments", category: "everyday", heat: 2 },

  // pop culture
  { id: "c01", motion: "Reading the book first ruins the film", sideA: "Ruins it", sideB: "Improves it", category: "culture", heat: 2 },
  { id: "c02", motion: "Binge-watching is worse than weekly episodes", sideA: "Weekly is better", sideB: "Binge", category: "culture", heat: 2 },
  { id: "c03", motion: "Remakes are almost always worse", sideA: "Worse", sideB: "Often better", category: "culture", heat: 2 },
  { id: "c04", motion: "Subtitles should be on by default", sideA: "Always on", sideB: "Off", category: "culture", heat: 2 },
  { id: "c05", motion: "Spoilers genuinely ruin things", sideA: "They ruin it", sideB: "It doesn't matter", category: "culture", heat: 2 },
  { id: "c06", motion: "The best album of any artist is their second", sideA: "The second", sideB: "Nonsense", category: "culture", heat: 2 },
  { id: "c07", motion: "Live music is always worth the price", sideA: "Always", sideB: "Rarely", category: "culture", heat: 2 },
  { id: "c08", motion: "Sequels should be banned", sideA: "Ban them", sideB: "Keep them coming", category: "culture", heat: 2 },
  { id: "c09", motion: "A film over two and a half hours needs to justify itself", sideA: "It does", sideB: "Length is fine", category: "culture", heat: 2 },
  { id: "c10", motion: "Physical media is better than streaming", sideA: "Physical", sideB: "Streaming", category: "culture", heat: 2 },

  // funny
  { id: "n01", motion: "Cats are better companions than dogs", sideA: "Team cat", sideB: "Team dog", category: "funny", heat: 1 },
  { id: "n02", motion: "Surprise parties are a good idea", sideA: "Wonderful", sideB: "A menace", category: "funny", heat: 1 },
  { id: "n03", motion: "Socks with sandals is a defensible choice", sideA: "Defensible", sideB: "Indefensible", category: "funny", heat: 1 },
  { id: "n04", motion: "A hot dog is a sandwich", sideA: "It is", sideB: "It absolutely isn't", category: "funny", heat: 1 },
  { id: "n05", motion: "Singing in the shower should be encouraged", sideA: "Encourage it", sideB: "Stop it", category: "funny", heat: 1 },
  { id: "n06", motion: "Group chats should have a maximum of five people", sideA: "Five max", sideB: "The more the better", category: "funny", heat: 1 },
  { id: "n07", motion: "Voice notes are a hostile act", sideA: "Hostile", sideB: "Efficient", category: "funny", heat: 1 },
  { id: "n08", motion: "Everyone should have one completely useless hobby", sideA: "Everyone", sideB: "Waste of time", category: "funny", heat: 1 },
  { id: "n09", motion: "Sending 'we need to talk' should be a criminal offence", sideA: "Criminal", sideB: "Perfectly fine", category: "funny", heat: 1 },
  { id: "n10", motion: "Putting the milk in first is a personality flaw", sideA: "A flaw", sideB: "The correct method", category: "funny", heat: 1 },
  { id: "n11", motion: "You should be legally required to reply to a wave", sideA: "Legally required", sideB: "Optional", category: "funny", heat: 1 },
  { id: "n12", motion: "Cargo shorts deserve a comeback", sideA: "Bring them back", sideB: "Never again", category: "funny", heat: 1 },

  // absurd
  { id: "a01", motion: "It's better to be slightly too hot than slightly too cold", sideA: "Too hot", sideB: "Too cold", category: "absurd", heat: 1 },
  { id: "a02", motion: "Would you rather always be ten minutes early or always five minutes late?", sideA: "Ten early", sideB: "Five late", category: "wouldrather", heat: 1 },
  { id: "a03", motion: "You'd survive longer in a zombie apocalypse than your partner", sideA: "I would", sideB: "They would", category: "absurd", heat: 1 },
  { id: "a04", motion: "Time travel to the past beats time travel to the future", sideA: "Past", sideB: "Future", category: "wouldrather", heat: 1 },
  { id: "a05", motion: "One horse-sized duck beats a hundred duck-sized horses", sideA: "The big duck", sideB: "The tiny horses", category: "wouldrather", heat: 1 },
  { id: "a06", motion: "You'd rather never need sleep than never need food", sideA: "No sleep needed", sideB: "No food needed", category: "wouldrather", heat: 1 },
  { id: "a07", motion: "Being able to fly beats being invisible", sideA: "Flight", sideB: "Invisibility", category: "wouldrather", heat: 1 },
  { id: "a08", motion: "It's worse to lose your phone than your keys", sideA: "Phone", sideB: "Keys", category: "wouldrather", heat: 1 },
  { id: "a09", motion: "You'd rather be famous for something embarrassing than never known at all", sideA: "Famous", sideB: "Anonymous", category: "wouldrather", heat: 1 },
  { id: "a10", motion: "Teleportation would ruin holidays", sideA: "Ruin them", sideB: "Improve them", category: "absurd", heat: 1 },

  // serious
  { id: "s01", motion: "Honesty matters more than kindness", sideA: "Honesty", sideB: "Kindness", category: "serious", heat: 3 },
  { id: "s02", motion: "People genuinely change", sideA: "They do", sideB: "They don't", category: "serious", heat: 3 },
  { id: "s03", motion: "Ambition is overrated", sideA: "Overrated", sideB: "Essential", category: "serious", heat: 3 },
  { id: "s04", motion: "You owe your family more than you owe your friends", sideA: "Family", sideB: "Friends", category: "serious", heat: 3 },
  { id: "s05", motion: "It's better to regret doing something than not doing it", sideA: "Do it", sideB: "Don't", category: "serious", heat: 3 },
  { id: "s06", motion: "Social media has made life worse overall", sideA: "Worse", sideB: "Better", category: "serious", heat: 3 },
  { id: "s07", motion: "Forgiveness should be earned, not given", sideA: "Earned", sideB: "Given freely", category: "serious", heat: 3 },
  { id: "s08", motion: "Success is mostly luck", sideA: "Mostly luck", sideB: "Mostly effort", category: "serious", heat: 3 },
  { id: "s09", motion: "Being liked matters less than being respected", sideA: "Respected", sideB: "Liked", category: "serious", heat: 3 },
  { id: "s10", motion: "A job should be more than a paycheque", sideA: "More than", sideB: "Just a paycheque", category: "serious", heat: 3 },

  { id: "h01", motion: "Most people would be happier without a smartphone", sideA: "Ditch it", sideB: "Nonsense", category: "hottake", heat: 2 },
  { id: "h02", motion: "Being on time is a personality trait, not a skill", sideA: "A trait", sideB: "A skill", category: "hottake", heat: 2 },
  { id: "h03", motion: "Nobody actually enjoys camping — they enjoy having camped", sideA: "Correct", sideB: "Wrong", category: "hottake", heat: 2 },
  { id: "h04", motion: "Small talk is a genuinely useful skill worth practising", sideA: "Worth it", sideB: "A waste", category: "hottake", heat: 2 },
  { id: "h05", motion: "You can tell everything about someone from how they treat a bad meal", sideA: "Everything", sideB: "Very little", category: "hottake", heat: 2 },
  { id: "h06", motion: "Group holidays ruin friendships more often than they build them", sideA: "They ruin", sideB: "They build", category: "hottake", heat: 2 },
  { id: "h07", motion: "Nostalgia is mostly a failure of imagination", sideA: "It is", sideB: "It isn't", category: "hottake", heat: 3 },
  { id: "h08", motion: "Most advice is really the giver talking to their younger self", sideA: "Always", sideB: "Rarely", category: "hottake", heat: 3 },
  { id: "h09", motion: "Having a favourite anything past thirty is a bit suspicious", sideA: "Suspicious", sideB: "Perfectly normal", category: "hottake", heat: 1 },
  { id: "h10", motion: "You should be allowed to leave a party without saying goodbye", sideA: "Just go", sideB: "Say goodbye", category: "hottake", heat: 1 },
  { id: "h11", motion: "Enjoying something ironically eventually becomes enjoying it", sideA: "It does", sideB: "It doesn't", category: "hottake", heat: 1 },
  { id: "h12", motion: "The best version of most people is the one that's slightly tired", sideA: "True", sideB: "Absurd", category: "hottake", heat: 2 },
  { id: "w01", motion: "Would you rather always know when someone's lying, or always be believed?", sideA: "Detect lies", sideB: "Always believed", category: "wouldrather", heat: 2 },
  { id: "w02", motion: "Would you rather lose every photo you own, or every message you've sent?", sideA: "Lose photos", sideB: "Lose messages", category: "wouldrather", heat: 2 },
  { id: "w03", motion: "Would you rather have one perfect day on repeat, or a new mediocre one every day?", sideA: "Perfect repeat", sideB: "New each time", category: "wouldrather", heat: 2 },
  { id: "w04", motion: "Would you rather be feared by strangers or forgotten by them?", sideA: "Feared", sideB: "Forgotten", category: "wouldrather", heat: 2 },
  { id: "w05", motion: "Would you rather never be bored again, or never be tired again?", sideA: "Never bored", sideB: "Never tired", category: "wouldrather", heat: 1 },
  { id: "w06", motion: "Would you rather read minds for a day, or rewind one day of your life?", sideA: "Read minds", sideB: "Rewind a day", category: "wouldrather", heat: 2 },
];

export const JUDGE_CRITERIA = [
  { id: "argument", label: "Argument quality", blurb: "Is the case coherent and structured?" },
  { id: "evidence", label: "Evidence", blurb: "Are there concrete reasons, examples or facts?" },
  { id: "creativity", label: "Creativity", blurb: "Does it find an angle nobody expected?" },
  { id: "persuasiveness", label: "Persuasiveness", blurb: "Would it actually move someone?" },
] as const;

export type JudgeCriterionId = (typeof JUDGE_CRITERIA)[number]["id"];

export const topicsIn = (categories: DebateCategory[]) =>
  categories.length ? DEBATE_TOPICS.filter((t) => categories.includes(t.category)) : DEBATE_TOPICS;

/**
 * A session should escalate. Round one stays light; by round four the pool has
 * opened up to the ones people actually get invested in.
 */
export function topicsForRound(pool: DebateTopic[], round: number) {
  const ceiling = round <= 0 ? 1 : round === 1 ? 2 : 3;
  const eligible = pool.filter((t) => t.heat <= ceiling);
  return eligible.length ? eligible : pool;
}

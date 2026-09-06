export type CourtCategory = "domestic" | "timekeeping" | "food" | "tech" | "social" | "petty";

export interface CourtCase {
  id: string;
  title: string;
  summary: string;
  category: CourtCategory;
}

export const COURT_CATEGORIES: { id: CourtCategory; label: string }[] = [
  { id: "domestic", label: "Domestic" },
  { id: "timekeeping", label: "Timekeeping" },
  { id: "food", label: "Food" },
  { id: "tech", label: "Devices" },
  { id: "social", label: "Social" },
  { id: "petty", label: "Genuinely petty" },
];

/**
 * Starter grievances. The bar for inclusion is "oh, this is literally us" —
 * the plaintiff can always file their own instead.
 */
export const COURT_CASES: CourtCase[] = [
  { id: "c01", title: "The Last Slice", summary: "Something clearly labelled as shared was eaten by one party, who then said nothing about it.", category: "food" },
  { id: "c02", title: "The Thermostat Wars", summary: "One party keeps adjusting the temperature and denying all knowledge of having done so.", category: "domestic" },
  { id: "c03", title: "The Five More Minutes", summary: "'Five minutes' has now been in progress for twenty-two minutes.", category: "timekeeping" },
  { id: "c04", title: "One Episode Ahead", summary: "A show declared sacred was watched alone. The defendant then pretended to be surprised.", category: "tech" },
  { id: "c05", title: "Left To Soak", summary: "A pan has been soaking for a period that now exceeds any reasonable definition of soaking.", category: "domestic" },
  { id: "c06", title: "Aux Cord Tyranny", summary: "Music privileges were seized twenty minutes into a journey and never returned.", category: "tech" },
  { id: "c07", title: "The Plan I Never Agreed To", summary: "Plans exist. One party has no memory of agreeing to them. Both are certain they are right.", category: "social" },
  { id: "c08", title: "I Definitely Told You", summary: "Information was allegedly delivered. It was allegedly received. Nobody can produce a witness.", category: "petty" },
  { id: "c09", title: "Who Takes Longer", summary: "Both parties maintain the other is the reason they are always late. Evidence required.", category: "timekeeping" },
  { id: "c10", title: "Read At 14:02", summary: "A message was read at 14:02 and answered at 21:40 with a single word.", category: "tech" },
  { id: "c11", title: "Who Started It", summary: "The origin of last night's disagreement is disputed. Both accounts are suspiciously flattering.", category: "petty" },
  { id: "c12", title: "The Fridge Situation", summary: "Something in the fridge has been there long enough to be considered a resident.", category: "food" },
  { id: "c13", title: "Duvet Redistribution", summary: "Overnight, the bedding migrated entirely to one side. This has happened every night this week.", category: "domestic" },
  { id: "c14", title: "The Snooze Marathon", summary: "An alarm was snoozed six times. Both parties were awake for all six.", category: "timekeeping" },
  { id: "c15", title: "The Damp Towel", summary: "A wet towel was found on a surface that should never have met a wet towel.", category: "domestic" },
  { id: "c16", title: "That Was Mine", summary: "Something bought specifically for one person was eaten by the other, who claims it was 'going off'.", category: "food" },
  { id: "c17", title: "Volume Disputes", summary: "The correct television volume has never been agreed and is renegotiated nightly.", category: "tech" },
  { id: "c18", title: "The Group Chat Leak", summary: "Something said in confidence appeared, near-verbatim, in a group chat.", category: "social" },
  { id: "c19", title: "I Know A Shortcut", summary: "A shortcut was insisted upon. The journey took eleven minutes longer.", category: "petty" },
  { id: "c20", title: "Charger Custody", summary: "A charging cable has relocated to one side of the bed and shows no intention of returning.", category: "tech" },
  { id: "c21", title: "The Ordering Incident", summary: "One party ordered badly, expressed regret, and then ate a third of the good order.", category: "food" },
  { id: "c22", title: "The Departure Task", summary: "At the exact moment of leaving, one party began an entirely optional task.", category: "timekeeping" },
  { id: "c23", title: "We'd Love To Come", summary: "Plans were accepted on both parties' behalf. Only one party was consulted.", category: "social" },
  { id: "c24", title: "The Red Sock", summary: "A dark item entered a light load. The consequences are visible and ongoing.", category: "domestic" },
  { id: "c25", title: "Unsolicited Spoiler", summary: "A key plot point was revealed with the phrase 'oh, you've not got to that bit yet?'", category: "tech" },
  { id: "c26", title: "The Bin Standoff", summary: "A full bin was walked past by both parties for three consecutive days.", category: "domestic" },
  { id: "c27", title: "I Don't Mind, You Pick", summary: "Twenty-five minutes were lost to mutual deference. Nobody ate until nine.", category: "food" },
  { id: "c28", title: "The Chewing Complaint", summary: "A complaint was raised about chewing volume. It cannot now be un-raised.", category: "petty" },
  { id: "c29", title: "Suitcase Imperialism", summary: "Shared luggage space was allocated unilaterally and without notice.", category: "social" },
  { id: "c30", title: "The Forgotten Date", summary: "A date of some significance passed entirely unacknowledged until 9pm.", category: "social" },
  { id: "c31", title: "The Better Space", summary: "A parking space was rejected as 'too tight'. A worse one was accepted nine minutes later.", category: "petty" },
  { id: "c32", title: "Borrowed, Returned Differently", summary: "An item of clothing was borrowed and came back in a materially different condition.", category: "domestic" },
  { id: "c33", title: "The Unanswered Question", summary: "A direct question received a hum, a nod, and nothing else.", category: "petty" },
  { id: "c34", title: "Shopping List Failure", summary: "One item was requested. Fourteen were purchased. It was not among them.", category: "food" },
  { id: "c35", title: "The Loud Typing", summary: "One party types as though the keyboard has personally wronged them.", category: "petty" },
  { id: "c36", title: "It'll Take Twenty Minutes", summary: "It took two hours and eleven minutes. This estimate is now submitted as evidence of a pattern.", category: "timekeeping" },
  { id: "c37", title: "The Phone At Dinner", summary: "A phone appeared at the table 'just to check something' and stayed for the entire meal.", category: "social" },
  { id: "c38", title: "Who Actually Cleaned", summary: "Both parties claim to have cleaned the kitchen. The kitchen suggests otherwise.", category: "domestic" },
  { id: "c39", title: "The Half-Finished Job", summary: "A task was started with enthusiasm and abandoned at exactly the point it became boring.", category: "domestic" },
  { id: "c40", title: "You Were On Your Phone", summary: "A story was told in full. The listener was demonstrably elsewhere. A summary was then demanded.", category: "petty" },
];

/**
 * Randomised exhibits. Court is funnier when the evidence is specific, and
 * people freeze at a blank field — so we hand them a form to fill in.
 */
export const EVIDENCE_PROMPTS = [
  "Exhibit A: a photograph of the sink, timestamped.",
  "Exhibit A: three witnesses, all of whom would side with me.",
  "Exhibit A: the message, still unanswered, screenshotted.",
  "Exhibit A: a pattern of behaviour dating back to at least last March.",
  "Exhibit A: the receipt, which clearly shows one of us paid.",
  "Exhibit A: my own testimony, which the court will find unusually credible.",
  "Exhibit A: a verbal admission made at approximately 11pm and later denied.",
  "Exhibit A: the object in question, which speaks for itself.",
  "Exhibit A: a calendar entry that does not exist, because it was never made.",
  "Exhibit A: the state of the room, which I invite the court to consider.",
  "Exhibit A: a sequence of events that only makes sense one way.",
  "Exhibit A: the defendant's own words, repeated back at volume.",
  "Exhibit A: eleven minutes of dashcam footage I am prepared to play in full.",
  "Exhibit A: a text sent at 14:02 and read at 14:02.",
];

export const VERDICT_TEMPLATES = [
  "The court finds for {winner}. {reason} Sentence: {sentence}",
  "After careful deliberation, {winner} carries the day. {reason} The court orders: {sentence}",
  "Judgment for {winner}. {reason} Accordingly: {sentence}",
  "This court sides with {winner}, though not without reservations. {reason} The penalty: {sentence}",
];

export const SENTENCES = [
  "the losing party makes tea for a week, unprompted",
  "one uncontested choice of film, to be used within thirty days",
  "a written apology of no fewer than three sentences, read aloud",
  "the loser handles the next round of dishes without commentary",
  "a compliment must be paid, in public, with a straight face",
  "the winner picks the next takeaway, no negotiation",
  "one morning of breakfast in bed, at a time of the winner's choosing",
  "the losing party surrenders aux privileges for one full journey",
  "the loser is thermostat custodian for a week, at the winner's preferred setting",
  "one chore of the winner's choosing, done without sighing",
  "the loser must say 'you were right' out loud, at normal volume",
  "the winner chooses the next weekend plan in full",
];

export const casesIn = (categories: CourtCategory[]) =>
  categories.length ? COURT_CASES.filter((c) => categories.includes(c.category)) : COURT_CASES;

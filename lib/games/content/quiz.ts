export type Difficulty = "easy" | "medium" | "hard";

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
  seconds: number;
}

export type IqCategory = "logic" | "pattern" | "math" | "spatial" | "knowledge";

export interface IqQuestion extends QuizQuestion {
  category: IqCategory;
  difficulty: Difficulty;
}

export const IQ_CATEGORIES: { id: IqCategory; label: string }[] = [
  { id: "logic", label: "Logic" },
  { id: "pattern", label: "Patterns" },
  { id: "math", label: "Math" },
  { id: "spatial", label: "Spatial" },
  { id: "knowledge", label: "Knowledge" },
];

export const DIFFICULTIES: { id: Difficulty; label: string; blurb: string }[] = [
  { id: "easy", label: "Easy", blurb: "warm up" },
  { id: "medium", label: "Medium", blurb: "a fair fight" },
  { id: "hard", label: "Hard", blurb: "genuinely tricky" },
];

export const IQ_QUESTIONS: IqQuestion[] = [
  // ----------------------------------------------------------------- logic
  { id: "lg01", category: "logic", difficulty: "easy", question: "All roses fade. Some flowers fade quickly. Therefore…", options: ["All roses fade quickly", "Some roses are flowers", "Nothing certain follows", "No flowers are roses"], answer: 2, explanation: "Nothing links roses to the 'quickly' group.", seconds: 30 },
  { id: "lg02", category: "logic", difficulty: "easy", question: "A bat and ball cost £1.10. The bat costs £1 more than the ball. The ball costs…", options: ["10p", "5p", "1p", "11p"], answer: 1, explanation: "5p + £1.05 = £1.10, a difference of exactly £1.", seconds: 30 },
  { id: "lg03", category: "logic", difficulty: "easy", question: "Five machines take 5 minutes to make 5 widgets. How long for 100 machines to make 100 widgets?", options: ["100 minutes", "20 minutes", "5 minutes", "1 minute"], answer: 2, explanation: "Each machine takes 5 minutes per widget; they work in parallel.", seconds: 30 },
  { id: "lg04", category: "logic", difficulty: "medium", question: "A lily pad doubles daily and covers the lake on day 48. When was it half covered?", options: ["Day 24", "Day 46", "Day 47", "Day 12"], answer: 2, explanation: "One doubling before full is exactly half.", seconds: 25 },
  { id: "lg05", category: "logic", difficulty: "medium", question: "You overtake the person in second place. What position are you in?", options: ["First", "Second", "Third", "Depends on the field"], answer: 1, explanation: "You take their place, not the leader's.", seconds: 20 },
  { id: "lg06", category: "logic", difficulty: "medium", question: "If some Bloops are Razzies and all Razzies are Lazzies, then…", options: ["All Bloops are Lazzies", "Some Bloops are Lazzies", "No Bloops are Lazzies", "Nothing follows"], answer: 1, explanation: "Some Bloops are Razzies, and every Razzie is a Lazzie — so those Bloops must be Lazzies too.", seconds: 30 },
  { id: "lg07", category: "logic", difficulty: "medium", question: "A farmer has 17 sheep. All but nine run away. How many remain?", options: ["8", "9", "17", "0"], answer: 1, explanation: "'All but nine' means nine are left.", seconds: 20 },
  { id: "lg08", category: "logic", difficulty: "hard", question: "Eight balls, one heavier. Fewest weighings on a balance scale?", options: ["1", "2", "3", "4"], answer: 1, explanation: "Weigh 3 v 3, then 1 v 1.", seconds: 35 },
  { id: "lg09", category: "logic", difficulty: "hard", question: "Twelve coins, one fake of unknown weight. Fewest weighings?", options: ["2", "3", "4", "6"], answer: 1, explanation: "Three weighings suffice with careful grouping.", seconds: 35 },
  { id: "lg10", category: "logic", difficulty: "hard", question: "A snail climbs 3m a day and slides 2m a night up a 10m wall. Days to the top?", options: ["7", "8", "9", "10"], answer: 1, explanation: "On day 8 it reaches the top before sliding.", seconds: 35 },
  { id: "lg11", category: "logic", difficulty: "easy", question: "How many times can you subtract 10 from 100?", options: ["Once", "Ten times", "Nine times", "Infinitely"], answer: 0, explanation: "After the first subtraction you're no longer subtracting from 100.", seconds: 20 },
  { id: "lg12", category: "logic", difficulty: "medium", question: "A doctor gives you 3 pills, one every half hour. How long until they're gone?", options: ["30 min", "1 hour", "1.5 hours", "2 hours"], answer: 1, explanation: "The first is immediate, then two more.", seconds: 25 },
  { id: "lg13", category: "logic", difficulty: "hard", question: "Three switches, one bulb upstairs, one trip. How do you identify the switch?", options: ["Impossible", "Use the bulb's heat", "Guess", "Flick two at once"], answer: 1, explanation: "Leave one on for a while, switch it off, switch a second on, then go up: lit is the second, warm-and-off is the first.", seconds: 30 },
  { id: "lg15", category: "logic", difficulty: "easy", question: "Which statement must be false if 'all cats are grey' is false?", options: ["No cats are grey", "Some cats are grey", "At least one cat isn't grey", "Every cat is grey"], answer: 3, explanation: "If 'all cats are grey' is false, then 'every cat is grey' must also be false — it's the same claim.", seconds: 25 },
  { id: "lg16", category: "logic", difficulty: "hard", question: "Rope burns unevenly in exactly 60 minutes. How do you measure 45 minutes with two ropes?", options: ["Burn one from both ends", "Burn one both ends and one one end, then the second's both ends", "Cut one in half", "It can't be done"], answer: 1, explanation: "30 minutes, then light the second rope's other end for 15 more.", seconds: 40 },

  // --------------------------------------------------------------- pattern
  { id: "pt01", category: "pattern", difficulty: "easy", question: "2, 6, 12, 20, 30, … what comes next?", options: ["36", "40", "42", "46"], answer: 2, explanation: "Gaps grow by two: +4, +6, +8, +10, +12.", seconds: 25 },
  { id: "pt02", category: "pattern", difficulty: "easy", question: "1, 1, 2, 3, 5, 8, … next?", options: ["11", "12", "13", "15"], answer: 2, explanation: "Each term is the sum of the two before it.", seconds: 20 },
  { id: "pt03", category: "pattern", difficulty: "easy", question: "3, 9, 27, 81, …", options: ["162", "216", "243", "324"], answer: 2, explanation: "Multiply by three.", seconds: 20 },
  { id: "pt04", category: "pattern", difficulty: "easy", question: "1, 4, 9, 16, 25, …", options: ["30", "36", "42", "49"], answer: 1, explanation: "Square numbers.", seconds: 20 },
  { id: "pt05", category: "pattern", difficulty: "medium", question: "A, C, F, J, …", options: ["M", "N", "O", "P"], answer: 2, explanation: "Gaps grow: +2, +3, +4, +5.", seconds: 30 },
  { id: "pt06", category: "pattern", difficulty: "medium", question: "2, 3, 5, 7, 11, …", options: ["12", "13", "14", "15"], answer: 1, explanation: "Primes.", seconds: 20 },
  { id: "pt07", category: "pattern", difficulty: "medium", question: "1, 11, 21, 1211, 111221, … next?", options: ["312211", "122111", "111222", "212211"], answer: 0, explanation: "Look-and-say: each line describes the one above.", seconds: 40 },
  { id: "pt08", category: "pattern", difficulty: "medium", question: "64, 32, 16, 8, …", options: ["6", "4", "2", "0"], answer: 1, explanation: "Halving.", seconds: 15 },
  { id: "pt09", category: "pattern", difficulty: "hard", question: "1, 2, 6, 24, 120, …", options: ["240", "600", "720", "840"], answer: 2, explanation: "Factorials — multiply by the next integer.", seconds: 30 },
  { id: "pt10", category: "pattern", difficulty: "hard", question: "O, T, T, F, F, S, S, …", options: ["E", "N", "T", "O"], answer: 0, explanation: "First letters of one, two, three… so Eight.", seconds: 35 },
  { id: "pt11", category: "pattern", difficulty: "medium", question: "Which doesn't belong: 8, 27, 64, 100?", options: ["8", "27", "64", "100"], answer: 3, explanation: "The others are cubes.", seconds: 25 },
  { id: "pt12", category: "pattern", difficulty: "easy", question: "5, 10, 20, 40, …", options: ["60", "70", "80", "100"], answer: 2, explanation: "Each term doubles.", seconds: 15 },
  { id: "pt13", category: "pattern", difficulty: "hard", question: "2, 5, 10, 17, 26, …", options: ["35", "37", "39", "41"], answer: 1, explanation: "n² + 1.", seconds: 30 },
  { id: "pt14", category: "pattern", difficulty: "medium", question: "Z, X, V, T, …", options: ["S", "R", "Q", "P"], answer: 1, explanation: "Every other letter, backwards.", seconds: 25 },
  { id: "pt15", category: "pattern", difficulty: "medium", question: "3, 6, 11, 18, 27, …", options: ["36", "38", "40", "42"], answer: 1, explanation: "Add consecutive odd numbers: +3, +5, +7, +9, +11.", seconds: 30 },
  { id: "pt16", category: "pattern", difficulty: "easy", question: "Which shape doesn't belong: square, rhombus, rectangle, triangle?", options: ["Square", "Rhombus", "Rectangle", "Triangle"], answer: 3, explanation: "Every other shape has four sides.", seconds: 15 },

  // ------------------------------------------------------------------ math
  { id: "mt01", category: "math", difficulty: "easy", question: "17 × 6", options: ["96", "102", "108", "112"], answer: 1, explanation: "17 × 6 = (17 × 3) × 2 = 51 × 2.", seconds: 20 },
  { id: "mt02", category: "math", difficulty: "easy", question: "15% of 240", options: ["24", "36", "32", "40"], answer: 1, explanation: "10% is 24, 5% is 12, so 15% is 36.", seconds: 25 },
  { id: "mt03", category: "math", difficulty: "easy", question: "√576", options: ["22", "24", "26", "28"], answer: 1, explanation: "24 × 24 = 576.", seconds: 20 },
  { id: "mt04", category: "math", difficulty: "easy", question: "A jacket is £80 with 25% off. You pay…", options: ["£55", "£60", "£64", "£65"], answer: 1, explanation: "A quarter of £80 is £20, so you pay £60.", seconds: 25 },
  { id: "mt05", category: "math", difficulty: "easy", question: "1/3 + 1/4 =", options: ["2/7", "5/12", "7/12", "1/2"], answer: 2, explanation: "Common denominator 12: 4/12 + 3/12.", seconds: 25 },
  { id: "mt06", category: "math", difficulty: "medium", question: "A shirt costs £27 after a third off. Original price?", options: ["£36", "£38.50", "£40.50", "£45"], answer: 2, explanation: "£27 is two-thirds of the original, so a third is £13.50 and the whole is £40.50.", seconds: 30 },
  { id: "mt07", category: "math", difficulty: "medium", question: "If 3 painters take 6 hours, how long for 4 painters?", options: ["4.5 hours", "5 hours", "6 hours", "8 hours"], answer: 0, explanation: "Three painters take 18 painter-hours in total; split across four, that's 4.5 hours each.", seconds: 30 },
  { id: "mt08", category: "math", difficulty: "medium", question: "What's 12% of 350?", options: ["36", "42", "45", "48"], answer: 1, explanation: "10% is 35, 2% is 7, so 12% is 42.", seconds: 25 },
  { id: "mt09", category: "math", difficulty: "medium", question: "A price rises 20% then falls 20%. Net change?", options: ["No change", "Down 4%", "Up 4%", "Down 2%"], answer: 1, explanation: "1.2 × 0.8 = 0.96.", seconds: 30 },
  { id: "mt10", category: "math", difficulty: "hard", question: "Two trains 300km apart approach at 60 and 90 km/h. When do they meet?", options: ["1 hour", "2 hours", "2.5 hours", "3 hours"], answer: 1, explanation: "Closing speed 150 km/h.", seconds: 35 },
  { id: "mt11", category: "math", difficulty: "hard", question: "What's the probability of rolling a total of 7 with two dice?", options: ["1/6", "1/8", "1/9", "1/12"], answer: 0, explanation: "Six of thirty-six combinations.", seconds: 30 },
  { id: "mt12", category: "math", difficulty: "medium", question: "8 is to 4 as 18 is to…", options: ["9", "12", "14", "6"], answer: 0, explanation: "Halve the first number.", seconds: 15 },
  { id: "mt13", category: "math", difficulty: "hard", question: "How many 3-digit numbers can you make from 1–5 with no repeats?", options: ["30", "60", "125", "20"], answer: 1, explanation: "5 × 4 × 3.", seconds: 35 },
  { id: "mt15", category: "math", difficulty: "hard", question: "Compound: £1,000 at 10% for 2 years?", options: ["£1,200", "£1,210", "£1,100", "£1,220"], answer: 1, explanation: "Year one adds £100, year two adds 10% of £1,100.", seconds: 30 },
  { id: "mt16", category: "math", difficulty: "easy", question: "What's a quarter of 3/4?", options: ["1/8", "3/16", "1/4", "3/8"], answer: 1, explanation: "Three-quarters divided by four is 3/16.", seconds: 25 },


  // --------------------------------------------------------------- spatial
  { id: "sp01", category: "spatial", difficulty: "easy", question: "A cube painted red is cut into 27 small cubes. How many have no paint?", options: ["0", "1", "6", "8"], answer: 1, explanation: "Only the very centre cube.", seconds: 30 },
  { id: "sp02", category: "spatial", difficulty: "medium", question: "How many faces does a triangular prism have?", options: ["4", "5", "6", "8"], answer: 1, explanation: "Two triangular ends plus three rectangular sides.", seconds: 20 },
  { id: "sp03", category: "spatial", difficulty: "medium", question: "You fold a square in half three times. How many equal sections?", options: ["4", "6", "8", "16"], answer: 2, explanation: "Each fold doubles the sections: 2, 4, 8.", seconds: 25 },
  { id: "sp04", category: "spatial", difficulty: "hard", question: "27 small cubes, all faces painted. How many have exactly two painted faces?", options: ["6", "8", "12", "18"], answer: 2, explanation: "The twelve edge cubes.", seconds: 35 },
  { id: "sp05", category: "spatial", difficulty: "easy", question: "At 3:00, what's the angle between clock hands?", options: ["45°", "60°", "90°", "120°"], answer: 2, explanation: "Each hour mark is 30°, and 3 o'clock is three of them from twelve.", seconds: 20 },
  { id: "sp06", category: "spatial", difficulty: "hard", question: "At 3:15, what's the angle between the hands?", options: ["0°", "7.5°", "15°", "22.5°"], answer: 1, explanation: "The hour hand has moved a quarter of the way to four.", seconds: 35 },
  { id: "sp08", category: "spatial", difficulty: "medium", question: "How many edges does a cube have?", options: ["6", "8", "12", "16"], answer: 2, explanation: "Twelve edges, eight vertices, six faces.", seconds: 15 },
  { id: "sp09", category: "spatial", difficulty: "hard", question: "Four points, all equidistant from each other. What shape?", options: ["Square", "Rhombus", "Tetrahedron", "Impossible"], answer: 2, explanation: "Four equidistant points can't lie flat — you need the third dimension.", seconds: 30 },
  { id: "sp10", category: "spatial", difficulty: "medium", question: "Rotate the letter 'b' 180° in the plane. What do you get?", options: ["d", "p", "q", "b"], answer: 2, explanation: "Turning 'b' upside down and backwards gives 'q'.", seconds: 20 },
  { id: "sp11", category: "spatial", difficulty: "easy", question: "How many sides does a hexagon have?", options: ["5", "6", "7", "8"], answer: 1, explanation: "Hex means six.", seconds: 12 },
  { id: "sp12", category: "spatial", difficulty: "hard", question: "A chessboard with two opposite corners removed — can 31 dominoes cover it?", options: ["Yes", "No", "Only diagonally", "Depends on the corners"], answer: 1, explanation: "The removed squares share a colour; each domino needs one of each.", seconds: 35 },

  // ------------------------------------------------------------- knowledge
  { id: "kn01", category: "knowledge", difficulty: "easy", question: "Which planet has the shortest day?", options: ["Mercury", "Jupiter", "Mars", "Venus"], answer: 1, explanation: "Jupiter spins once in about ten hours.", seconds: 25 },
  { id: "kn02", category: "knowledge", difficulty: "easy", question: "What's the most abundant gas in Earth's atmosphere?", options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Argon"], answer: 2, explanation: "Nitrogen is about 78% of the atmosphere; oxygen is only around 21%.", seconds: 20 },
  { id: "kn03", category: "knowledge", difficulty: "easy", question: "How many bones are in an adult human body?", options: ["186", "196", "206", "216"], answer: 2, explanation: "Babies start with around 300; many fuse together as you grow.", seconds: 20 },
  { id: "kn04", category: "knowledge", difficulty: "medium", question: "Which organ produces insulin?", options: ["Liver", "Pancreas", "Kidney", "Spleen"], answer: 1, explanation: "The pancreas, from its islet cells.", seconds: 20 },
  { id: "kn05", category: "knowledge", difficulty: "medium", question: "Roughly how fast does light travel in a vacuum?", options: ["300 km/s", "3,000 km/s", "300,000 km/s", "3,000,000 km/s"], answer: 2, explanation: "Close to 300,000 kilometres every second.", seconds: 20 },
  { id: "kn06", category: "knowledge", difficulty: "medium", question: "What's the longest river in the world by most measures?", options: ["Amazon", "Nile", "Yangtze", "Mississippi"], answer: 1, explanation: "The Nile, by the most commonly used measurement — though the Amazon is contested.", seconds: 20 },
  { id: "kn07", category: "knowledge", difficulty: "hard", question: "Which element has the chemical symbol W?", options: ["Tungsten", "Wolframite", "Tin", "Uranium"], answer: 0, explanation: "From wolfram, its old name.", seconds: 25 },
  { id: "kn08", category: "knowledge", difficulty: "medium", question: "How many time zones does Russia span?", options: ["5", "8", "11", "14"], answer: 2, explanation: "Eleven, from Kaliningrad in the west to Kamchatka in the east.", seconds: 25 },
  { id: "kn09", category: "knowledge", difficulty: "hard", question: "What's the smallest country in the world by area?", options: ["Monaco", "Nauru", "Vatican City", "San Marino"], answer: 2, explanation: "Vatican City, at roughly 0.44 square kilometres.", seconds: 20 },
  { id: "kn10", category: "knowledge", difficulty: "easy", question: "How many continents are there?", options: ["5", "6", "7", "8"], answer: 2, explanation: "Seven, on the model most of the world is taught.", seconds: 15 },
  { id: "kn11", category: "knowledge", difficulty: "medium", question: "Which sea has no coastline?", options: ["Sargasso Sea", "Dead Sea", "Black Sea", "Red Sea"], answer: 0, explanation: "The Sargasso Sea is bounded by ocean currents rather than land.", seconds: 25 },
  { id: "kn12", category: "knowledge", difficulty: "hard", question: "What's the hardest naturally occurring substance?", options: ["Quartz", "Diamond", "Corundum", "Topaz"], answer: 1, explanation: "Diamond, at 10 on the Mohs scale.", seconds: 20 },
  { id: "kn13", category: "knowledge", difficulty: "medium", question: "Doubling an object's speed multiplies its kinetic energy by…", options: ["2", "3", "4", "8"], answer: 2, explanation: "Kinetic energy scales with velocity squared.", seconds: 25 },
  { id: "kn14", category: "knowledge", difficulty: "easy", question: "What force keeps a satellite in orbit?", options: ["Magnetism", "Gravity", "Centrifugal force", "Air pressure"], answer: 1, explanation: "Gravity — the satellite is permanently falling and permanently missing.", seconds: 20 },
  { id: "kn15", category: "knowledge", difficulty: "medium", question: "Drop a feather and hammer on the Moon. Which lands first?", options: ["The hammer", "The feather", "Together", "Neither falls"], answer: 2, explanation: "No air resistance, so both accelerate identically.", seconds: 20 },
  { id: "lg17", category: "logic", difficulty: "easy", question: "Which is heavier: a kilo of feathers or a kilo of steel?", options: ["Feathers", "Steel", "The same", "Depends on volume"], answer: 2, explanation: "A kilo is a kilo. Steel just takes up less room.", seconds: 12 },
  { id: "lg18", category: "logic", difficulty: "medium", question: "You have one match and enter a dark room with a lamp, a candle and a fire. What do you light first?", options: ["The lamp", "The candle", "The fire", "The match"], answer: 3, explanation: "You can't light anything else without lighting the match first.", seconds: 20 },
  { id: "pt17", category: "pattern", difficulty: "medium", question: "1, 3, 6, 10, 15, …", options: ["18", "20", "21", "24"], answer: 2, explanation: "Triangular numbers.", seconds: 25 },
  { id: "pt18", category: "pattern", difficulty: "hard", question: "4, 9, 16, 25, 36, … which is NOT in this sequence?", options: ["49", "64", "72", "81"], answer: 2, explanation: "72 isn't a square.", seconds: 25 },
  { id: "mt17", category: "math", difficulty: "medium", question: "What's 40% of 65?", options: ["24", "26", "28", "30"], answer: 1, explanation: "10% is 6.5, so 40% is four lots of that.", seconds: 25 },
  { id: "mt18", category: "math", difficulty: "hard", question: "A 20% tip on £47.50 is about…", options: ["£8.50", "£9.50", "£10.50", "£11.50"], answer: 1, explanation: "10% of £47.50 is £4.75, so 20% is about £9.50.", seconds: 25 },
  { id: "sp13", category: "spatial", difficulty: "medium", question: "How many vertices does a cube have?", options: ["4", "6", "8", "12"], answer: 2, explanation: "Eight corners on a cube.", seconds: 15 },
  { id: "sp14", category: "spatial", difficulty: "hard", question: "27 cubes, all outer faces painted. How many have exactly three painted faces?", options: ["4", "6", "8", "12"], answer: 2, explanation: "The eight corners.", seconds: 30 },
  { id: "kn17", category: "knowledge", difficulty: "medium", question: "Which country has the most natural lakes?", options: ["Russia", "Canada", "Finland", "Brazil"], answer: 1, explanation: "Canada, with more lakes than the rest of the world combined.", seconds: 25 },
  { id: "kn18", category: "knowledge", difficulty: "hard", question: "What's the only letter not in any US state name?", options: ["Q", "X", "Z", "J"], answer: 0, explanation: "Q — every other letter appears in at least one state name.", seconds: 25 },
];

/* ==========================================================================
   THE LAB — a small collection of challenge types, not just more questions.
   ========================================================================== */

export type LabTrack =
  | "reaction"
  | "observation"
  | "math"
  | "pattern"
  | "physics"
  | "probability"
  | "logic";

/**
 * Each track plays differently, not just reads differently.
 *
 *  - `flash`    the prompt is shown briefly and then taken away
 *  - `estimate` there is no clean answer, only a best guess
 *  - `sequence` find the rule, then extend it
 *  - `quiz`     straight recall or reasoning
 *
 * `flashMs` on a question drives the flash mechanic in the engine.
 */
export type LabMode = "quiz" | "estimate" | "sequence" | "flash";

export interface LabQuestion extends QuizQuestion {
  track: LabTrack;
  difficulty: Difficulty;
  mode: LabMode;
  /** When set, the prompt is visible for this long and then hidden. */
  flashMs?: number;
  /**
   * What you're actually asked once the prompt has gone. Flash questions need
   * this: the material is shown first and the question only afterwards, or
   * there'd be nothing to remember it *for*.
   */
  ask?: string;
}

export const LAB_TRACKS: {
  id: LabTrack;
  label: string;
  blurb: string;
  /** What you actually do, shown on the setup screen. */
  how: string;
  mode: LabMode;
  accent: string;
}[] = [
  { id: "reaction", label: "Reaction", blurb: "answer before you think", how: "Ten seconds a question. Speed is most of the score.", mode: "quiz", accent: "blush" },
  { id: "observation", label: "Observation", blurb: "look, then it's gone", how: "The question flashes up, then disappears. Answer from memory.", mode: "flash", accent: "butter" },
  { id: "math", label: "Calculation", blurb: "no paper allowed", how: "Straight mental arithmetic, against the clock.", mode: "quiz", accent: "sky" },
  { id: "pattern", label: "Patterns", blurb: "find the rule", how: "Work out the rule, then extend it.", mode: "sequence", accent: "lilac" },
  { id: "physics", label: "Prediction", blurb: "what actually happens", how: "No formulas — just predict what the world does.", mode: "quiz", accent: "mint" },
  { id: "probability", label: "Probability", blurb: "how likely, really", how: "There's no clean answer. Estimate.", mode: "estimate", accent: "peach" },
  { id: "logic", label: "Logic", blurb: "puzzles", how: "Slow, deliberate, one right answer.", mode: "quiz", accent: "blush" },
];

export const LAB_QUESTIONS: LabQuestion[] = [
  // math
  { id: "m01", track: "math", mode: "quiz", difficulty: "easy", question: "17 × 6", options: ["96", "102", "108", "112"], answer: 1, explanation: "17 × 6 is 102 — ten sixes plus seven sixes.", seconds: 20 },
  { id: "m02", track: "math", mode: "quiz", difficulty: "easy", question: "15% of 240", options: ["24", "36", "32", "40"], answer: 1, explanation: "10% is 24, 5% is 12. Together, 36.", seconds: 25 },
  { id: "m03", track: "math", mode: "quiz", difficulty: "easy", question: "√576", options: ["22", "24", "26", "28"], answer: 1, explanation: "24 × 24 = 576.", seconds: 20 },
  { id: "m04", track: "math", mode: "quiz", difficulty: "medium", question: "A jacket is £80 with 25% off. You pay…", options: ["£55", "£60", "£64", "£65"], answer: 1, explanation: "A quarter off £80 is £20 off.", seconds: 25 },
  { id: "m05", track: "math", mode: "quiz", difficulty: "medium", question: "1/3 + 1/4 =", options: ["2/7", "5/12", "7/12", "1/2"], answer: 2, explanation: "Over twelfths: 4/12 + 3/12.", seconds: 25 },
  { id: "m06", track: "math", mode: "quiz", difficulty: "medium", question: "A price rises 20% then falls 20%. Net?", options: ["No change", "Down 4%", "Up 4%", "Down 2%"], answer: 1, explanation: "×1.2 then ×0.8 is ×0.96 — percentages don't cancel out.", seconds: 30 },
  { id: "m07", track: "math", mode: "quiz", difficulty: "hard", question: "What's 7/8 as a percentage?", options: ["78.5%", "82.5%", "87.5%", "92.5%"], answer: 2, explanation: "One eighth is 12.5%, so seven of them is 87.5%.", seconds: 25 },
  { id: "m08", track: "math", mode: "quiz", difficulty: "hard", question: "£1,000 at 10% compound for 2 years?", options: ["£1,200", "£1,210", "£1,100", "£1,220"], answer: 1, explanation: "£1,100 after year one, then 10% of that again.", seconds: 30 },

  // patterns
  { id: "p01", track: "pattern", mode: "sequence", difficulty: "easy", question: "3, 9, 27, 81, …", options: ["162", "216", "243", "324"], answer: 2, explanation: "Each term triples.", seconds: 20 },
  { id: "p02", track: "pattern", mode: "sequence", difficulty: "medium", question: "A, C, F, J, …", options: ["M", "N", "O", "P"], answer: 2, explanation: "Gaps grow: +2, +3, +4, +5.", seconds: 25 },
  { id: "p03", track: "pattern", mode: "sequence", difficulty: "easy", question: "1, 4, 9, 16, 25, …", options: ["30", "36", "42", "49"], answer: 1, explanation: "Square numbers.", seconds: 15 },
  { id: "p04", track: "pattern", mode: "sequence", difficulty: "easy", question: "2, 3, 5, 7, 11, …", options: ["12", "13", "14", "15"], answer: 1, explanation: "Primes.", seconds: 15 },
  { id: "p05", track: "pattern", mode: "sequence", difficulty: "hard", question: "1, 2, 6, 24, 120, …", options: ["240", "600", "720", "840"], answer: 2, explanation: "Factorials.", seconds: 30 },
  { id: "p06", track: "pattern", mode: "sequence", difficulty: "hard", question: "O, T, T, F, F, S, S, …", options: ["E", "N", "T", "O"], answer: 0, explanation: "One, two, three… so Eight.", seconds: 35 },
  { id: "p07", track: "pattern", mode: "sequence", difficulty: "medium", question: "2, 5, 10, 17, 26, …", options: ["35", "37", "39", "41"], answer: 1, explanation: "n² + 1.", seconds: 30 },

  // physics intuition
  { id: "ph01", track: "physics", mode: "quiz", difficulty: "easy", question: "Drop a feather and hammer on the Moon. Which lands first?", options: ["The hammer", "The feather", "Together", "Neither falls"], answer: 2, explanation: "No air resistance.", seconds: 20 },
  { id: "ph02", track: "physics", mode: "quiz", difficulty: "easy", question: "What force keeps a satellite in orbit?", options: ["Magnetism", "Gravity", "Centrifugal force", "Air pressure"], answer: 1, explanation: "It's in constant free fall — orbiting is falling and missing.", seconds: 20 },
  { id: "ph03", track: "physics", mode: "quiz", difficulty: "medium", question: "Roughly how fast is light in a vacuum?", options: ["300 km/s", "3,000 km/s", "300,000 km/s", "3,000,000 km/s"], answer: 2, explanation: "Near enough 3 × 10⁸ metres per second.", seconds: 20 },
  { id: "ph04", track: "physics", mode: "quiz", difficulty: "medium", question: "Doubling speed multiplies kinetic energy by…", options: ["2", "3", "4", "8"], answer: 2, explanation: "Kinetic energy goes with the square of speed.", seconds: 25 },
  { id: "ph05", track: "physics", mode: "quiz", difficulty: "medium", question: "You're in a lift as the cable snaps. Jumping at the last second…", options: ["Saves you completely", "Helps a little", "Makes almost no difference", "Makes it worse"], answer: 2, explanation: "You can't shed enough speed to matter.", seconds: 30 },
  { id: "ph06", track: "physics", mode: "quiz", difficulty: "hard", question: "A bullet fired horizontally and one dropped from the same height…", options: ["Land together", "The dropped one first", "The fired one first", "Depends on the gun"], answer: 0, explanation: "Horizontal and vertical motion are independent.", seconds: 30 },
  { id: "ph07", track: "physics", mode: "quiz", difficulty: "hard", question: "Ice floats because…", options: ["It's colder", "It expands when frozen", "Air is trapped in it", "Water is denser when frozen"], answer: 1, explanation: "Water is one of the few things less dense as a solid.", seconds: 25 },
  { id: "ph08", track: "physics", mode: "quiz", difficulty: "medium", question: "Two identical mugs, one with milk added now and one in ten minutes. Which is hotter at ten minutes?", options: ["Milk now", "Milk later", "The same", "Depends on the mug"], answer: 0, explanation: "The cooler mug loses heat more slowly.", seconds: 35 },

  // probability
  { id: "pr01", track: "probability", mode: "estimate", difficulty: "easy", question: "Rolling a total of 7 with two dice?", options: ["1/6", "1/8", "1/9", "1/12"], answer: 0, explanation: "Six of thirty-six combinations.", seconds: 25 },
  { id: "pr02", track: "probability", mode: "estimate", difficulty: "medium", question: "In a room of 23 people, chance two share a birthday?", options: ["About 6%", "About 25%", "About 50%", "About 90%"], answer: 2, explanation: "The birthday paradox.", seconds: 30 },
  { id: "pr03", track: "probability", mode: "estimate", difficulty: "medium", question: "Flip a fair coin 5 times. Chance of all heads?", options: ["1/8", "1/16", "1/32", "1/64"], answer: 2, explanation: "Half, five times over: 1/2⁵.", seconds: 25 },
  { id: "pr04", track: "probability", mode: "estimate", difficulty: "hard", question: "Monty Hall: you picked door 1, host opens door 3. Switching wins…", options: ["1/3 of the time", "1/2 of the time", "2/3 of the time", "Always"], answer: 2, explanation: "Your first pick was right 1/3 of the time, so the other door holds the rest.", seconds: 35 },
  { id: "pr05", track: "probability", mode: "estimate", difficulty: "medium", question: "Drawing two aces in a row from a full deck, no replacement?", options: ["1/169", "1/221", "1/52", "1/26"], answer: 1, explanation: "4/52 × 3/51.", seconds: 30 },
  { id: "pr06", track: "probability", mode: "estimate", difficulty: "easy", question: "Chance of drawing a red card from a full deck?", options: ["1/4", "1/3", "1/2", "2/3"], answer: 2, explanation: "Twenty-six red cards out of fifty-two.", seconds: 15 },

  // science
  { id: "s01", track: "physics", mode: "quiz", difficulty: "easy", question: "Which organ produces insulin?", options: ["Liver", "Pancreas", "Kidney", "Spleen"], answer: 1, explanation: "In the islets of Langerhans, specifically.", seconds: 20 },
  { id: "s02", track: "physics", mode: "quiz", difficulty: "easy", question: "Most abundant gas in Earth's atmosphere?", options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Argon"], answer: 2, explanation: "About 78% of the air — oxygen is only around 21%.", seconds: 20 },
  { id: "s03", track: "physics", mode: "quiz", difficulty: "easy", question: "Bones in an adult human body?", options: ["186", "196", "206", "216"], answer: 2, explanation: "Babies start with roughly 270; some fuse as you grow.", seconds: 20 },
  { id: "s04", track: "physics", mode: "quiz", difficulty: "medium", question: "Which planet has the shortest day?", options: ["Mercury", "Jupiter", "Mars", "Venus"], answer: 1, explanation: "Under ten hours, despite being the biggest.", seconds: 25 },
  { id: "s05", track: "physics", mode: "quiz", difficulty: "medium", question: "What's the powerhouse of the cell, as everyone insists?", options: ["Nucleus", "Ribosome", "Mitochondria", "Golgi body"], answer: 2, explanation: "They make most of the cell's ATP.", seconds: 15 },
  { id: "s06", track: "physics", mode: "quiz", difficulty: "hard", question: "Which blood type is the universal donor?", options: ["A negative", "O negative", "AB positive", "O positive"], answer: 1, explanation: "No A, B or Rh antigens for a recipient to react to.", seconds: 25 },
  { id: "s07", track: "physics", mode: "quiz", difficulty: "hard", question: "How long does light from the Sun take to reach Earth?", options: ["8 seconds", "8 minutes", "8 hours", "8 days"], answer: 1, explanation: "About 150 million km at 300,000 km/s.", seconds: 20 },


  // reaction — short fuses, speed is most of the score
  { id: "rx01", track: "reaction", mode: "quiz", difficulty: "easy", question: "Which is larger: 7 × 8 or 6 × 9?", options: ["7 × 8", "6 × 9", "Equal", "Can't tell"], answer: 0, explanation: "56 against 54.", seconds: 10 },
  { id: "rx02", track: "reaction", mode: "quiz", difficulty: "easy", question: "How many letters in the word 'reaction'?", options: ["7", "8", "9", "10"], answer: 1, explanation: "r-e-a-c-t-i-o-n.", seconds: 10 },
  { id: "rx03", track: "reaction", mode: "quiz", difficulty: "easy", question: "Odd one out: 3, 7, 9, 11", options: ["3", "7", "9", "11"], answer: 2, explanation: "Nine is the only one that isn't prime.", seconds: 10 },
  { id: "rx04", track: "reaction", mode: "quiz", difficulty: "medium", question: "Half of a third of 90?", options: ["10", "15", "18", "30"], answer: 1, explanation: "A third is 30, half of that is 15.", seconds: 12 },
  { id: "rx05", track: "reaction", mode: "quiz", difficulty: "easy", question: "Which is heavier: 900g or 1kg?", options: ["900g", "1kg", "Equal", "Depends"], answer: 1, explanation: "A kilo is 1,000g.", seconds: 8 },
  { id: "rx06", track: "reaction", mode: "quiz", difficulty: "medium", question: "What comes next: B, D, F, H, …?", options: ["I", "J", "K", "L"], answer: 1, explanation: "Every other letter.", seconds: 10 },
  { id: "rx07", track: "reaction", mode: "quiz", difficulty: "easy", question: "How many sides do a triangle and a square have together?", options: ["6", "7", "8", "9"], answer: 1, explanation: "Three plus four.", seconds: 10 },
  { id: "rx08", track: "reaction", mode: "quiz", difficulty: "medium", question: "Which is bigger: 0.7 or 2/3?", options: ["0.7", "2/3", "Equal", "Can't tell"], answer: 0, explanation: "Two-thirds is about 0.667.", seconds: 12 },

  // observation — the prompt flashes up and is taken away
  { id: "ob01", track: "observation", mode: "flash", flashMs: 3200, difficulty: "easy", question: "SPOON \u00b7 LADDER \u00b7 WINDOW \u00b7 SPOON \u00b7 CANDLE", ask: "Which word appeared twice?", options: ["Spoon", "Ladder", "Window", "Candle"], answer: 0, explanation: "Spoon opened the list and came back fourth.", seconds: 20 },
  { id: "ob02", track: "observation", mode: "flash", flashMs: 3000, difficulty: "medium", question: "4 \u2014 9 \u2014 2 \u2014 7 \u2014 5", ask: "What was the third number?", options: ["4", "9", "2", "7"], answer: 2, explanation: "Four, nine, then two.", seconds: 20 },
  { id: "ob03", track: "observation", mode: "flash", flashMs: 3200, difficulty: "medium", question: "RED \u00b7 BLUE \u00b7 GREEN \u00b7 BLUE \u00b7 YELLOW", ask: "Which colour appeared twice?", options: ["Red", "Blue", "Green", "Yellow"], answer: 1, explanation: "Blue was second and fourth.", seconds: 20 },
  { id: "ob04", track: "observation", mode: "flash", flashMs: 3600, difficulty: "hard", question: "5 apples \u00b7 3 pears \u00b7 8 plums \u00b7 2 figs", ask: "How many pieces of fruit altogether?", options: ["16", "17", "18", "19"], answer: 2, explanation: "5 + 3 + 8 + 2 = 18.", seconds: 22 },
  { id: "ob05", track: "observation", mode: "flash", flashMs: 3000, difficulty: "easy", question: "Monday \u00b7 Thursday \u00b7 Saturday", ask: "Which day was in the middle?", options: ["Monday", "Thursday", "Saturday", "Sunday"], answer: 1, explanation: "Thursday sat between the other two.", seconds: 18 },
  { id: "ob06", track: "observation", mode: "flash", flashMs: 3400, difficulty: "hard", question: "dog \u00b7 chair \u00b7 dog \u00b7 lamp \u00b7 chair \u00b7 dog", ask: "Which word came up most often?", options: ["Dog", "Chair", "Lamp", "Sofa"], answer: 0, explanation: "Dog three times, chair twice, lamp once.", seconds: 20 },
  { id: "ob07", track: "observation", mode: "flash", flashMs: 3000, difficulty: "medium", question: "north \u00b7 east \u00b7 east \u00b7 south \u00b7 west", ask: "Which direction appeared twice?", options: ["North", "East", "South", "West"], answer: 1, explanation: "East was second and third.", seconds: 18 },
  { id: "ob08", track: "observation", mode: "flash", flashMs: 3400, difficulty: "hard", question: "2 \u00b7 7 \u00b7 1 \u00b7 8 \u00b7 2 \u00b7 8", ask: "What was the last number?", options: ["1", "2", "7", "8"], answer: 3, explanation: "The run ended on eight.", seconds: 20 },

  // logic
  { id: "lo01", track: "logic", mode: "quiz", difficulty: "hard", question: "Eight balls, one heavier. Fewest weighings?", options: ["1", "2", "3", "4"], answer: 1, explanation: "Weigh 3 v 3, then 1 v 1.", seconds: 35 },
  { id: "lo03", track: "logic", mode: "quiz", difficulty: "hard", question: "Three switches, one bulb upstairs, one trip. How?", options: ["Impossible", "Use the bulb's heat", "Guess", "Use the light twice"], answer: 1, explanation: "Leave one on a while, switch it off, turn another on, then feel the bulb.", seconds: 30 },
  { id: "lo04", track: "logic", mode: "quiz", difficulty: "medium", question: "If some Bloops are Razzies and all Razzies are Lazzies, then…", options: ["All Bloops are Lazzies", "Some Bloops are Lazzies", "No Bloops are Lazzies", "Nothing follows"], answer: 1, explanation: "The Bloops that are Razzies must be Lazzies. The rest, who knows.", seconds: 30 },
  { id: "lo05", track: "logic", mode: "quiz", difficulty: "easy", question: "You overtake second place. What position are you in?", options: ["First", "Second", "Third", "Depends"], answer: 1, explanation: "You take their place — you haven't passed the leader.", seconds: 20 },
  { id: "lo06", track: "logic", mode: "quiz", difficulty: "medium", question: "A snail climbs 3m daily, slides 2m nightly, up a 10m wall. Days?", options: ["7", "8", "9", "10"], answer: 1, explanation: "Net 1m a day, but on day 8 the 3m climb clears the top before it can slide.", seconds: 35 },
];

export const iqQuestionsFor = (categories: IqCategory[], difficulties: Difficulty[]) =>
  IQ_QUESTIONS.filter(
    (q) =>
      (categories.length === 0 || categories.includes(q.category)) &&
      (difficulties.length === 0 || difficulties.includes(q.difficulty)),
  );

export const labQuestionsFor = (tracks: LabTrack[], difficulties: Difficulty[]) =>
  LAB_QUESTIONS.filter(
    (q) =>
      (tracks.length === 0 || tracks.includes(q.track)) &&
      (difficulties.length === 0 || difficulties.includes(q.difficulty)),
  );

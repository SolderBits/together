export type RiddleKind = "classic" | "logic" | "wordplay" | "lateral" | "picture" | "couple";

export interface Riddle {
  id: string;
  kind: RiddleKind;
  riddle: string;
  answer: string;
  /** Lower-cased fragments that count as correct free text. */
  accepts: string[];
  hint: string;
}

export const RIDDLE_KINDS: { id: RiddleKind; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "logic", label: "Logic" },
  { id: "wordplay", label: "Wordplay" },
  { id: "lateral", label: "Lateral" },
  { id: "picture", label: "Picture it" },
  { id: "couple", label: "For two" },
];

export const RIDDLES: Riddle[] = [
  // --------------------------------------------------------------- classic
  { id: "c01", kind: "classic", riddle: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", answer: "An echo", accepts: ["echo"], hint: "You make one by shouting in a valley." },
  { id: "c02", kind: "classic", riddle: "The more of me you take, the more you leave behind. What am I?", answer: "Footsteps", accepts: ["footstep", "steps", "footprint"], hint: "Look at the ground behind you." },
  { id: "c03", kind: "classic", riddle: "What has keys but opens no locks, space but no room, and lets you enter but not go in?", answer: "A keyboard", accepts: ["keyboard"], hint: "You're probably touching one." },
  { id: "c04", kind: "classic", riddle: "I'm not alive, but I grow. I have no lungs, but I need air. I have no mouth, but water kills me.", answer: "Fire", accepts: ["fire", "flame"], hint: "It's the reason you keep a bucket nearby." },
  { id: "c05", kind: "classic", riddle: "What can travel around the world while staying in a corner?", answer: "A stamp", accepts: ["stamp", "postage"], hint: "Envelope real estate." },
  { id: "c06", kind: "classic", riddle: "What gets wetter the more it dries?", answer: "A towel", accepts: ["towel"], hint: "It hangs in the bathroom." },
  { id: "c07", kind: "classic", riddle: "I have cities but no houses, forests but no trees, and water but no fish.", answer: "A map", accepts: ["map", "atlas"], hint: "You unfold it badly and never refold it right." },
  { id: "c08", kind: "classic", riddle: "What has a head, a tail, is brown, and has no legs?", answer: "A penny", accepts: ["penny", "coin", "cent"], hint: "Check the bottom of your bag." },
  { id: "c09", kind: "classic", riddle: "The person who makes it sells it. The person who buys it never uses it. The person who uses it never knows they have.", answer: "A coffin", accepts: ["coffin", "casket"], hint: "The last thing you'd shop for yourself." },
  { id: "c10", kind: "classic", riddle: "What breaks the moment you say its name?", answer: "Silence", accepts: ["silence", "quiet"], hint: "Libraries want more of it." },
  { id: "c11", kind: "classic", riddle: "Two bodies joined in one, standing still yet running. What am I?", answer: "An hourglass", accepts: ["hourglass", "hour glass", "egg timer"], hint: "It measures without ticking." },
  { id: "c13", kind: "classic", riddle: "What has one eye but cannot see?", answer: "A needle", accepts: ["needle"], hint: "You thread it, badly, in poor light." },
  { id: "c14", kind: "classic", riddle: "What comes down but never goes up?", answer: "Rain", accepts: ["rain"], hint: "Check the window." },
  { id: "c15", kind: "classic", riddle: "What has hands but cannot clap?", answer: "A clock", accepts: ["clock", "watch"], hint: "It's probably on your wall." },
  { id: "c16", kind: "classic", riddle: "What has a neck but no head, and wears a cap?", answer: "A bottle", accepts: ["bottle"], hint: "In the fridge." },
  { id: "c17", kind: "classic", riddle: "What runs all around a garden but never moves?", answer: "A fence", accepts: ["fence", "wall"], hint: "It keeps the dog in." },
  { id: "c18", kind: "classic", riddle: "What can you catch but not throw?", answer: "A cold", accepts: ["cold", "flu", "a cold"], hint: "Nobody wants it in January." },
  { id: "c19", kind: "classic", riddle: "I have teeth but never bite, and I live in a drawer next to the sink. What am I?", answer: "A comb", accepts: ["comb"], hint: "You use it on your head." },
  { id: "c20", kind: "classic", riddle: "I go up and down between floors, but I never move an inch. What am I?", answer: "A staircase", accepts: ["stair", "staircase", "steps"], hint: "The lift is the other option." },
  { id: "c21", kind: "classic", riddle: "I'm tall when I'm young and short when I'm old. What am I?", answer: "A candle", accepts: ["candle"], hint: "It's romantic until it isn't." },
  { id: "c22", kind: "classic", riddle: "What belongs to you but is used more by other people?", answer: "Your name", accepts: ["name", "your name"], hint: "You rarely say it out loud yourself." },
  { id: "c23", kind: "classic", riddle: "I fill a room the instant you flick a switch, and take up no space at all. What am I?", answer: "Light", accepts: ["light"], hint: "It travels rather fast." },
  { id: "c24", kind: "classic", riddle: "What has many keys but can't open a single door?", answer: "A piano", accepts: ["piano", "keyboard"], hint: "It's also an instrument." },

  // ----------------------------------------------------------------- logic
  { id: "l01", kind: "logic", riddle: "A bat and ball cost £1.10 together. The bat costs £1 more than the ball. What does the ball cost?", answer: "5p", accepts: ["5p", "five p", "0.05", "5 pence", "five pence"], hint: "It isn't 10p — check the difference." },
  { id: "l02", kind: "logic", riddle: "Five machines take five minutes to make five widgets. How long do 100 machines take to make 100 widgets?", answer: "Five minutes", accepts: ["5", "five"], hint: "How long does one machine take for one widget?" },
  { id: "l03", kind: "logic", riddle: "A lily pad doubles every day and covers the lake on day 48. On which day was it half covered?", answer: "Day 47", accepts: ["47"], hint: "Work backwards one doubling." },
  { id: "l04", kind: "logic", riddle: "You have eight balls; one is heavier. What's the fewest weighings on a balance scale to find it?", answer: "Two", accepts: ["2", "two"], hint: "Start by weighing three against three." },
  { id: "l05", kind: "logic", riddle: "A man looks at a portrait and says: 'That man's father is my father's son.' He has no siblings. Who is in the portrait?", answer: "His son", accepts: ["his son", "son"], hint: "With no siblings, 'my father's son' is himself." },
  { id: "l06", kind: "logic", riddle: "Three switches downstairs, one bulb upstairs. You may go up once. How do you know which switch?", answer: "Use the heat of the bulb", accepts: ["heat", "warm", "temperature", "touch"], hint: "A bulb that's been on isn't just bright." },
  { id: "l07", kind: "logic", riddle: "If it takes six people six hours to dig six holes, how long does it take one person to dig half a hole?", answer: "There's no such thing as half a hole", accepts: ["no such thing", "half a hole", "trick", "can't", "cannot"], hint: "Question the premise." },
  { id: "l08", kind: "logic", riddle: "A farmer has 17 sheep. All but nine run away. How many are left?", answer: "Nine", accepts: ["9", "nine"], hint: "Read 'all but nine' very literally." },
  { id: "l09", kind: "logic", riddle: "You're in a race and overtake the person in second place. What position are you in?", answer: "Second", accepts: ["second", "2nd", "2"], hint: "You took their place, not the leader's." },
  { id: "l10", kind: "logic", riddle: "Two people are born the same minute to the same mother, but they're not twins. How?", answer: "They're part of triplets", accepts: ["triplet", "triplets", "three"], hint: "Who says there were only two?" },
  { id: "l11", kind: "logic", riddle: "A doctor gives you three pills, one every half hour. How long until they're all taken?", answer: "One hour", accepts: ["1 hour", "one hour", "60", "hour"], hint: "The first one is taken immediately." },
  { id: "l12", kind: "logic", riddle: "How many times can you subtract 10 from 100?", answer: "Once — after that it's 90", accepts: ["once", "one", "1"], hint: "Read it exactly as written." },
  { id: "l13", kind: "logic", riddle: "A rope ladder hangs over a ship's side, rungs 30cm apart, three rungs above water. The tide rises 60cm an hour. After two hours, how many rungs are underwater?", answer: "None — the ship rises too", accepts: ["none", "zero", "0", "no rungs"], hint: "What's the ladder attached to?" },
  { id: "l14", kind: "logic", riddle: "Some Bloops are Razzies. All Razzies are Lazzies. What definitely follows?", answer: "Some Bloops are Lazzies", accepts: ["some bloops are lazzies", "some are lazzies"], hint: "Only what the premises force." },
  { id: "l15", kind: "logic", riddle: "You have two jugs, 3 litres and 5 litres. How do you measure exactly 4 litres?", answer: "Fill 5, pour into 3, empty 3, pour the 2 across, fill 5 and top up the 3", accepts: ["fill", "pour", "2 litres", "two litres"], hint: "Get 2 litres sitting in the big jug first." },
  { id: "l16", kind: "logic", riddle: "A shop sells a coat for £27 after a one-third discount. What was the original price?", answer: "£40.50", accepts: ["40.50", "40,50", "£40.50", "40.5"], hint: "£27 is two-thirds of the original." },

  // -------------------------------------------------------------- wordplay
  { id: "w01", kind: "wordplay", riddle: "What word becomes shorter when you add two letters to it?", answer: "Short", accepts: ["short"], hint: "The answer is in the question." },
  { id: "w02", kind: "wordplay", riddle: "What five-letter word becomes shorter when you remove two letters?", answer: "Fewer", accepts: ["fewer"], hint: "It means 'less', and losing letters proves it." },
  { id: "w03", kind: "wordplay", riddle: "I'm a word of letters three. Add two and fewer there will be. What am I?", answer: "Few", accepts: ["few"], hint: "Add 'er'." },
  { id: "w04", kind: "wordplay", riddle: "What English word has three consecutive double letters?", answer: "Bookkeeper", accepts: ["bookkeeper", "book keeper"], hint: "Someone who does the accounts." },
  { id: "w05", kind: "wordplay", riddle: "Rearrange LISTEN to make another everyday word.", answer: "Silent (also tinsel, enlist)", accepts: ["silent", "tinsel", "enlist", "inlets"], hint: "It's what you should be doing while listening." },
  { id: "w06", kind: "wordplay", riddle: "What starts with an E, ends with an E, and usually contains one letter?", answer: "An envelope", accepts: ["envelope"], hint: "It goes in the post." },
  { id: "w07", kind: "wordplay", riddle: "What word is spelled incorrectly in every dictionary?", answer: "Incorrectly", accepts: ["incorrectly"], hint: "Read the question extremely literally." },
  { id: "w08", kind: "wordplay", riddle: "Forward I'm heavy; backward I'm not. What am I?", answer: "Ton", accepts: ["ton", "tonne"], hint: "Reverse it and you get 'not'." },
  { id: "w09", kind: "wordplay", riddle: "What begins with T, ends with T, and has T in it?", answer: "A teapot", accepts: ["teapot", "tea pot"], hint: "It's full of tea." },
  { id: "w10", kind: "wordplay", riddle: "What four-letter word can be written forward, backward or upside down and still read the same?", answer: "NOON", accepts: ["noon"], hint: "It's a time of day." },
  { id: "w11", kind: "wordplay", riddle: "Which month has 28 days?", answer: "All of them", accepts: ["all", "every", "all of them"], hint: "They all have at least that many." },
  { id: "w13", kind: "wordplay", riddle: "I'm found in socks, scarves and mittens, and often in the paws of playful kittens. What am I?", answer: "Yarn", accepts: ["yarn", "wool", "thread"], hint: "It comes in a ball." },
  { id: "w14", kind: "wordplay", riddle: "What nine-letter word is still a word after removing one letter at a time, right down to one?", answer: "Startling", accepts: ["startling"], hint: "Startling, starting, staring, string, sting, sing, sin, in, I." },

  // --------------------------------------------------------------- lateral
  { id: "x01", kind: "lateral", riddle: "A man pushes his car to a hotel and immediately loses all his money. What happened?", answer: "He's playing Monopoly", accepts: ["monopoly", "board game", "game"], hint: "It isn't a real hotel." },
  { id: "x02", kind: "lateral", riddle: "A woman shoots her husband, holds him under water for five minutes, then they enjoy dinner together. How?", answer: "She's a photographer developing a photo", accepts: ["photo", "photograph", "camera", "developing", "film"], hint: "'Shoots' has more than one meaning." },
  { id: "x03", kind: "lateral", riddle: "A man lives on the tenth floor. He takes the lift down every morning but on the way home only rides to the seventh, unless it's raining. Why?", answer: "He's short and can only reach button seven — unless he has an umbrella", accepts: ["short", "umbrella", "reach", "height", "can't reach"], hint: "Think about what he's holding when it rains." },
  { id: "x04", kind: "lateral", riddle: "Two people are found dead on the floor surrounded by water and broken glass. What happened?", answer: "They were fish — the tank broke", accepts: ["fish", "goldfish", "tank", "aquarium"], hint: "Nobody said they were people." },
  { id: "x05", kind: "lateral", riddle: "A man is found dead in a field with an unopened package beside him. What happened?", answer: "His parachute failed", accepts: ["parachute", "skydiving", "jumped", "plane"], hint: "The package was supposed to open on the way down." },
  { id: "x06", kind: "lateral", riddle: "Every day a man buys two identical items but only ever uses one. Why?", answer: "He's buying for two — the second is for someone else", accepts: ["someone else", "for two", "partner", "gift", "another person"], hint: "There's a second person in this story." },
  { id: "x07", kind: "lateral", riddle: "A woman calls a stranger, says nothing, hangs up, and goes to sleep happy. Why?", answer: "The neighbour's snoring stopped when the phone rang", accepts: ["snoring", "noise", "neighbour", "neighbor", "wake"], hint: "She wanted a noise to stop." },
  { id: "x08", kind: "lateral", riddle: "A man orders soup in a restaurant, tastes it, and immediately leaves in tears. Why?", answer: "It tasted of a memory he'd been avoiding", accepts: ["memory", "reminded", "remember", "past", "someone"], hint: "It's not about the soup." },
  { id: "x09", kind: "lateral", riddle: "The music stopped and she died. Why?", answer: "She was a tightrope walker — the music was her cue", accepts: ["tightrope", "circus", "blind", "cue", "wire"], hint: "The music was doing a job." },
  { id: "x10", kind: "lateral", riddle: "A man walks into a bar and asks for a glass of water. The bartender points a gun at him. The man says thank you and leaves. Why?", answer: "He had hiccups — the shock cured them", accepts: ["hiccup", "hiccups", "scared", "shock", "fright"], hint: "The water was for a symptom." },
  { id: "x11", kind: "lateral", riddle: "A room has no windows or doors and a man inside is dead. There's a puddle of water and rope hanging from the ceiling. What happened?", answer: "He stood on a block of ice", accepts: ["ice", "block of ice"], hint: "Where did the water come from?" },
  { id: "x12", kind: "lateral", riddle: "You're in a dark room with a candle, an oil lamp and a fireplace. You have one match. What do you light first?", answer: "The match", accepts: ["match", "the match"], hint: "Order of operations." },

  // ------------------------------------------------------------ picture it
  { id: "p01", kind: "picture", riddle: "Picture a shape with three sides, all equal, all angles the same. Now picture it stacked four high. How many small triangles do you see in total?", answer: "Sixteen", accepts: ["16", "sixteen"], hint: "Count upward-pointing and downward-pointing separately." },
  { id: "p02", kind: "picture", riddle: "Imagine a cube painted red on every face, then cut into 27 smaller cubes. How many small cubes have no paint at all?", answer: "One", accepts: ["1", "one"], hint: "Only the very centre is hidden." },
  { id: "p03", kind: "picture", riddle: "Picture a clock at 3:15. What's the angle between the hands?", answer: "7.5 degrees", accepts: ["7.5", "7,5", "seven and a half"], hint: "The hour hand has moved a quarter of the way to four." },
  { id: "p04", kind: "picture", riddle: "You fold a square of paper in half three times. How many rectangles do you have when you unfold it?", answer: "Eight", accepts: ["8", "eight"], hint: "Each fold doubles the sections." },
  { id: "p05", kind: "picture", riddle: "Imagine walking one mile south, one mile east, one mile north, and arriving where you started. Where are you?", answer: "The North Pole", accepts: ["north pole", "pole"], hint: "There's only one obvious place on Earth." },
  { id: "p06", kind: "picture", riddle: "Picture a standard six-sided die. What's the sum of the numbers you cannot see when it's resting on a table?", answer: "It depends on the top face — but top and bottom always total 7", accepts: ["7", "seven", "depends"], hint: "Opposite faces always add to the same thing." },
  { id: "p07", kind: "picture", riddle: "You have a chessboard with two opposite corners removed. Can 31 dominoes cover it?", answer: "No — the removed squares are the same colour", accepts: ["no", "cannot", "can't", "impossible"], hint: "Each domino covers one of each colour." },
  { id: "p08", kind: "picture", riddle: "Picture four points arranged so every point is exactly the same distance from every other. What shape have you made?", answer: "A tetrahedron", accepts: ["tetrahedron", "pyramid", "triangular pyramid", "3d"], hint: "It can't be done flat." },

  // -------------------------------------------------------------- for two
  // These are written to be argued about out loud: each one has a hook that
  // sounds like it means one thing and turns out to mean another.
  { id: "u01", kind: "couple", riddle: "We're always together but never touch, we're always moving but never arrive, and twice a day we agree completely. What are we?", answer: "The hands of a clock", accepts: ["clock hands", "hands", "clock"], hint: "The agreement happens at noon and midnight." },
  { id: "u02", kind: "couple", riddle: "Apart, we're two useless bits of metal. Joined at the hip and pulling in opposite directions, we're suddenly good at our job. What are we?", answer: "Scissors", accepts: ["scissors", "shears"], hint: "The disagreement is the whole point." },
  { id: "u03", kind: "couple", riddle: "One of us always goes missing, the survivor is never quite the same, and neither of us was ever the favourite. What are we?", answer: "A pair of socks", accepts: ["socks", "sock", "a pair of socks"], hint: "Blame the washing machine." },
  { id: "u04", kind: "couple", riddle: "I follow you everywhere, copy everything you do, grow enormous in the evening and abandon you entirely in the dark. What am I?", answer: "Your shadow", accepts: ["shadow"], hint: "It depends entirely on where the light is." },
  { id: "u05", kind: "couple", riddle: "Between us we have one job, four hands and no agreement about the temperature. One of us is always cold. What are we?", answer: "The two of you", accepts: ["couple", "us", "partners", "you and me", "two of us", "the two of you"], hint: "Look up from the screen." },
  { id: "u06", kind: "couple", riddle: "The more of me you give away, the more of me you have. Hoard me and I vanish entirely. What am I?", answer: "Love — or a secret, badly kept", accepts: ["love", "kindness", "happiness", "joy", "secret", "knowledge"], hint: "Nothing physical behaves like this." },
  { id: "u07", kind: "couple", riddle: "Two people make me every night, one person unmakes me every morning, and both of you have strong opinions about how many pillows I need. What am I?", answer: "The bed", accepts: ["bed", "the bed"], hint: "It's in the other room." },
  { id: "u08", kind: "couple", riddle: "We face each other every morning, we've never once spoken, and one of us is doing all the work. What are we?", answer: "You and your reflection", accepts: ["mirror", "reflection"], hint: "One of you isn't strictly real." },
  { id: "u09", kind: "couple", riddle: "Both of you want me, neither of you admits to hiding me, and I always end up down the side of the sofa. What am I?", answer: "The remote", accepts: ["remote", "control", "remote control"], hint: "It has too many buttons and you use four." },
  { id: "u10", kind: "couple", riddle: "We overlap in the middle. The bit in the middle is the only part anyone ever talks about. What are we?", answer: "Two circles in a Venn diagram", accepts: ["venn", "circles", "venn diagram", "two circles"], hint: "Think of a diagram, not jewellery." },
  { id: "u11", kind: "couple", riddle: "We arrive together, sit in the dark for two hours without speaking, and afterwards disagree about what happened. What are we?", answer: "Two people at the cinema", accepts: ["cinema", "audience", "film", "movie", "at the cinema"], hint: "One of you fell asleep." },
  { id: "u12", kind: "couple", riddle: "One of you always finishes them, neither of you will admit to starting them, and you've been having the same one since 2019. What are they?", answer: "Sentences — or arguments", accepts: ["sentences", "sentence", "arguments", "argument"], hint: "You're probably doing it right now." },
  { id: "u13", kind: "couple", riddle: "It takes two of us to make one, only one of us to break it, and it weighs nothing at all until it's broken. What is it?", answer: "A promise", accepts: ["promise", "vow", "agreement", "deal"], hint: "You can't hold it, but you can feel it go." },
  { id: "u14", kind: "couple", riddle: "You'll both name a different one. You'll both be right. And you'll spend twenty minutes not deciding. What is it?", answer: "Where to eat", accepts: ["where to eat", "dinner", "restaurant", "food", "takeaway", "what to eat"], hint: "It happens roughly every Friday." },

];

export const riddlesOfKind = (kinds: RiddleKind[]) =>
  kinds.length ? RIDDLES.filter((r) => kinds.includes(r.kind)) : RIDDLES;

export type HuntKind = "find" | "photo" | "show" | "race" | "recreate";
export type HuntDifficulty = "easy" | "medium" | "hard";

export interface HuntPrompt {
  id: string;
  kind: HuntKind;
  difficulty: HuntDifficulty;
  prompt: string;
  seconds: number;
}

export const HUNT_KINDS: { id: HuntKind; label: string; blurb: string }[] = [
  { id: "find", label: "Find something…", blurb: "go and look" },
  { id: "photo", label: "Take a photo of…", blurb: "framing counts" },
  { id: "show", label: "Show me…", blurb: "no searching required" },
  { id: "race", label: "Race to…", blurb: "speed is the point" },
  { id: "recreate", label: "Recreate…", blurb: "creative credit" },
];

export const HUNT_DIFFICULTIES: { id: HuntDifficulty; label: string; blurb: string }[] = [
  { id: "easy", label: "Easy", blurb: "within arm's reach" },
  { id: "medium", label: "Medium", blurb: "you'll have to get up" },
  { id: "hard", label: "Hard", blurb: "genuinely a hunt" },
];

export const HUNT_PROMPTS: HuntPrompt[] = [
  // --- find: the object matters more than its colour ----------------------
  { id: "f01", kind: "find", difficulty: "easy", prompt: "Find something in this room that secretly matches your personality", seconds: 60 },
  { id: "f02", kind: "find", difficulty: "easy", prompt: "Find the object you'd be most embarrassed for a guest to notice", seconds: 60 },
  { id: "f03", kind: "find", difficulty: "easy", prompt: "Find something you use every day and have never once thought about", seconds: 50 },
  { id: "f04", kind: "find", difficulty: "medium", prompt: "Find the object you think I would save first in a fire", seconds: 75 },
  { id: "f05", kind: "find", difficulty: "medium", prompt: "Find something that has outlived at least three of your phones", seconds: 90 },
  { id: "f06", kind: "find", difficulty: "medium", prompt: "Find something you kept for a reason you can no longer remember", seconds: 90 },
  { id: "f07", kind: "find", difficulty: "medium", prompt: "Find the ugliest thing you own that you refuse to get rid of", seconds: 75 },
  { id: "f08", kind: "find", difficulty: "medium", prompt: "Find something that would confuse an archaeologist in 500 years", seconds: 80 },
  { id: "f09", kind: "find", difficulty: "hard", prompt: "Find something that proves you were once a completely different person", seconds: 120 },
  { id: "f10", kind: "find", difficulty: "hard", prompt: "Find the object in your home with the best story attached to it", seconds: 120 },
  { id: "f11", kind: "find", difficulty: "hard", prompt: "Find something you've never shown me and probably never would have", seconds: 120 },
  { id: "f12", kind: "find", difficulty: "hard", prompt: "Find something you own that you'd genuinely struggle to replace", seconds: 110 },
  { id: "f13", kind: "find", difficulty: "medium", prompt: "Find something here that isn't yours and that you have no intention of returning", seconds: 75 },
  { id: "f14", kind: "find", difficulty: "easy", prompt: "Find something that's been in exactly the same spot for over a year", seconds: 60 },

  // --- photo: framing is the challenge ------------------------------------
  { id: "p01", kind: "photo", difficulty: "easy", prompt: "Take a photo that makes this room look far more expensive than it is", seconds: 75 },
  { id: "p02", kind: "photo", difficulty: "easy", prompt: "Take a photo of the best light you can find right now", seconds: 60 },
  { id: "p03", kind: "photo", difficulty: "medium", prompt: "Take a photo that would work as an album cover with no editing", seconds: 100 },
  { id: "p04", kind: "photo", difficulty: "medium", prompt: "Take a photo that tells a whole story with no people in it", seconds: 100 },
  { id: "p05", kind: "photo", difficulty: "medium", prompt: "Take a photo of the least photogenic corner you have, flatteringly", seconds: 80 },
  { id: "p06", kind: "photo", difficulty: "hard", prompt: "Take a photo that would genuinely confuse a stranger about what they're seeing", seconds: 110 },
  { id: "p07", kind: "photo", difficulty: "hard", prompt: "Take a photo that sums up your entire week", seconds: 110 },
  { id: "p08", kind: "photo", difficulty: "easy", prompt: "Take a photo of whatever is directly above you, right now", seconds: 35 },
  { id: "p09", kind: "photo", difficulty: "medium", prompt: "Take a photo of a shadow rather than the thing casting it", seconds: 80 },
  { id: "p10", kind: "photo", difficulty: "hard", prompt: "Take a photo that looks like it was taken in a different decade", seconds: 120 },

  // --- show: no searching, just honesty -----------------------------------
  { id: "s01", kind: "show", difficulty: "easy", prompt: "Show me the inside of your bag, no tidying", seconds: 45 },
  { id: "s02", kind: "show", difficulty: "easy", prompt: "Show me what's on your bedside table exactly as it is", seconds: 45 },
  { id: "s03", kind: "show", difficulty: "medium", prompt: "Show me your least organised drawer, fully open", seconds: 60 },
  { id: "s04", kind: "show", difficulty: "medium", prompt: "Show me the last thing you bought that you didn't need", seconds: 70 },
  { id: "s05", kind: "show", difficulty: "hard", prompt: "Show me something you've kept purely for sentimental reasons and explain it", seconds: 100 },
  { id: "s06", kind: "show", difficulty: "easy", prompt: "Show me the view from your nearest window", seconds: 45 },
  { id: "s07", kind: "show", difficulty: "medium", prompt: "Show me the thing in your home you're most quietly proud of", seconds: 75 },
  { id: "s08", kind: "show", difficulty: "hard", prompt: "Show me something that would surprise me about how you live", seconds: 100 },

  // --- race: speed is the whole point -------------------------------------
  { id: "r01", kind: "race", difficulty: "easy", prompt: "Race to hold up three things you'd take to a desert island", seconds: 45 },
  { id: "r02", kind: "race", difficulty: "easy", prompt: "Race to find something older than both of us", seconds: 50 },
  { id: "r03", kind: "race", difficulty: "medium", prompt: "Race to build the tallest tower you can from things within reach", seconds: 60 },
  { id: "r04", kind: "race", difficulty: "medium", prompt: "Race to gather everything edible you can reach without standing up", seconds: 45 },
  { id: "r05", kind: "race", difficulty: "hard", prompt: "Race to assemble the most convincing disguise from what's in the room", seconds: 90 },
  { id: "r06", kind: "race", difficulty: "medium", prompt: "Race to find five things that share one thing in common. You choose what.", seconds: 75 },
  { id: "r07", kind: "race", difficulty: "hard", prompt: "Race to put on every item of clothing you can in ninety seconds", seconds: 90 },

  // --- recreate: creative credit ------------------------------------------
  { id: "e01", kind: "recreate", difficulty: "medium", prompt: "Recreate a famous album cover using only what's within reach", seconds: 120 },
  { id: "e02", kind: "recreate", difficulty: "medium", prompt: "Recreate your worst school photo, expression included", seconds: 90 },
  { id: "e03", kind: "recreate", difficulty: "hard", prompt: "Recreate a photo of us from memory, as closely as you can", seconds: 120 },
  { id: "e04", kind: "recreate", difficulty: "easy", prompt: "Recreate the face you make when I say we should leave in five minutes", seconds: 35 },
  { id: "e05", kind: "recreate", difficulty: "medium", prompt: "Recreate a classic film poster with whatever props you have", seconds: 120 },
  { id: "e06", kind: "recreate", difficulty: "hard", prompt: "Recreate a stock photo called 'Successful Business Meeting'", seconds: 110 },
  { id: "e07", kind: "recreate", difficulty: "easy", prompt: "Recreate exactly how you looked when you woke up this morning", seconds: 35 },
  { id: "e08", kind: "recreate", difficulty: "hard", prompt: "Recreate a Renaissance painting. Commit to the lighting.", seconds: 120 },

];

export const huntsFor = (kinds: HuntKind[], difficulties: HuntDifficulty[]) =>
  HUNT_PROMPTS.filter(
    (p) =>
      (kinds.length === 0 || kinds.includes(p.kind)) &&
      (difficulties.length === 0 || difficulties.includes(p.difficulty)),
  );

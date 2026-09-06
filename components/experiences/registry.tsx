"use client";

import type { ComponentType } from "react";
import { CouplesCourt } from "./couples-court";
import { Debate } from "./debate";
import { DrawTogether } from "./draw-together";
import { IqDuel } from "./iq-duel";
import { KnowMeQuiz } from "./know-me";
import { LoveMatch } from "./love-match";
import { OurFuture } from "./our-future";
import { Photobooth } from "./photobooth";
import { RiddleNight } from "./riddle-night";
import { SnapHunt } from "./snap-hunt";
import { TheLab } from "./the-lab";
import { TruthOrDare } from "./truth-or-dare";
import { WatchTogether } from "./watch-together";

/**
 * Maps an experience id to the component a room renders once it starts.
 * Adding a multiplayer experience means adding one line here.
 */
export const EXPERIENCE_COMPONENTS: Record<string, ComponentType> = {
  "know-me": KnowMeQuiz,
  "truth-or-dare": TruthOrDare,
  "iq-duel": IqDuel,
  "riddle-night": RiddleNight,
  "the-lab": TheLab,
  debate: Debate,
  "draw-together": DrawTogether,
  "couples-court": CouplesCourt,
  "snap-hunt": SnapHunt,
  "love-match": LoveMatch,
  "our-future": OurFuture,
  photobooth: Photobooth,
  "watch-together": WatchTogether,
};

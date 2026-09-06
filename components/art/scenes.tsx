import { INK, Scene, Sparks, Twinkle, type SceneProps } from "./scene";

/* ===========================================================================
   Original illustrations, one per experience.
   Each tells the experience's story rather than labelling it with an icon.
   =========================================================================== */

/** Two speech bubbles: one asking, one already answered. */
export function ArtKnowMe({ tint = "#ffe4ec", mid = "#ffb3cd", deep = "#a53c67", ...p }: SceneProps) {
  return (
    <Scene {...p}>
      <path d="M18 32h74a10 10 0 0 1 10 10v30a10 10 0 0 1-10 10H44l-16 14V82h-10a10 10 0 0 1-10-10V42a10 10 0 0 1 10-10Z" fill={tint} />
      <path d="M48 52c0-7 5.6-12 12.5-12S73 45 73 51.5c0 6-4 8.6-7.4 10.6-2.6 1.6-3.6 3-3.6 5.4v1.4" />
      <circle cx="62" cy="75" r="3.4" fill={deep} stroke="none" />
      <path d="M108 62h68a10 10 0 0 1 10 10v28a10 10 0 0 1-10 10h-42l-14 12v-12h-12a10 10 0 0 1-10-10V72a10 10 0 0 1 10-10Z" fill={mid} />
      <path d="M124 88h44M124 100h28" />
      <Sparks points={[[168, 42, 3], [180, 30, 2], [30, 108, 2.4]]} color={INK} />
    </Scene>
  );
}

/** A coin caught mid-flip, split between two fates. */
export function ArtTruthOrDare({ tint = "#e9e3fc", mid = "#c4b5f3", deep = "#5a45a6", ...p }: SceneProps) {
  return (
    <Scene {...p}>
      <ellipse cx="100" cy="86" rx="46" ry="46" fill={tint} />
      <path d="M100 40a46 46 0 0 1 0 92Z" fill={mid} />
      <path d="M100 40a46 46 0 1 0 0 92 46 46 0 0 0 0-92Z" />
      <path d="M100 40v92" strokeDasharray="5 7" />
      <path d="M72 78c0-6 4.6-10.4 10.4-10.4S93 72 93 77.4c0 5-3.4 7-6.2 8.6-2 1.2-2.8 2.4-2.8 4.4" />
      <circle cx="84" cy="98" r="2.9" fill={deep} stroke="none" />
      <path d="m118 68-9 20h13l-9 22" stroke={INK} />
      <path d="M52 34c8 6 12 12 12 12M156 40c-8 5-11 11-11 11" />
      <Sparks points={[[36, 60, 2.6], [166, 100, 2.6]]} />
    </Scene>
  );
}

/** A fanned stack — the one on top face-up. */
export function ArtHonestCards({ tint = "#dfecfd", mid = "#a7cbf4", deep = "#2d5d90", ...p }: SceneProps) {
  return (
    <Scene {...p}>
      <rect x="34" y="40" width="58" height="80" rx="12" fill={mid} transform="rotate(-13 63 80)" />
      <rect x="62" y="34" width="58" height="80" rx="12" fill={tint} transform="rotate(-4 91 74)" />
      <rect x="96" y="30" width="62" height="86" rx="13" fill="#fff" transform="rotate(7 127 73)" />
      <g transform="rotate(7 127 73)">
        <path d="M112 56h30M112 68h34M112 80h20" />
        <circle cx="145" cy="96" r="4" fill={deep} stroke="none" />
      </g>
      <Twinkle x={172} y={40} s={7} color={INK} />
      <Sparks points={[[26, 108, 2.4]]} />
    </Scene>
  );
}

/** Two score columns with a struck VS between them. */
export function ArtIqDuel({ tint = "#fbf0cf", mid = "#f4d98a", deep = "#8a6a15", ...p }: SceneProps) {
  return (
    <Scene {...p}>
      <rect x="24" y="62" width="42" height="66" rx="10" fill={tint} />
      <rect x="134" y="42" width="42" height="86" rx="10" fill={mid} />
      <path d="M24 128h152" />
      <path d="M45 62V44M155 42V26" />
      <circle cx="45" cy="38" r="7" fill="#fff" />
      <circle cx="155" cy="20" r="7" fill="#fff" />
      <path d="M84 60l10 26M104 60 94 86M94 86v10" stroke={deep} />
      <path d="M112 62h14l-14 22h14" stroke={deep} />
      <Sparks points={[[100, 118, 2.6], [100, 108, 2.6]]} />
    </Scene>
  );
}

/** A moon and a keyhole — the puzzle you talk through at night. */
export function ArtRiddleNight({ tint = "#e9e3fc", mid = "#c4b5f3", deep = "#5a45a6", ...p }: SceneProps) {
  return (
    <Scene {...p}>
      <path d="M158 26a34 34 0 1 0 16 44 27 27 0 0 1-16-44Z" fill={mid} />
      <rect x="26" y="46" width="86" height="84" rx="16" fill={tint} />
      <circle cx="69" cy="80" r="13" fill="#fff" />
      <path d="M64 90h10l4 22H60l4-22Z" fill="#fff" />
      <path d="M69 74v6" stroke={deep} />
      <path d="M126 104c0-5 3.8-8.6 8.6-8.6s8.4 3.4 8.4 7.8c0 4-2.8 5.6-5 6.9-1.6 1-2.3 2-2.3 3.5" />
      <circle cx="135.6" cy="122" r="2.6" fill={deep} stroke="none" />
      <Twinkle x={30} y={24} s={6} />
      <Sparks points={[[52, 22, 2.2], [180, 108, 2.4]]} />
    </Scene>
  );
}

/** A flask, a rising curve, a couple of bubbles. */
export function ArtTheLab({ tint = "#daf0e4", mid = "#a2ddbe", deep = "#2a6a4d", ...p }: SceneProps) {
  return (
    <Scene {...p}>
      <path d="M74 24h26M82 24v34L54 112a12 12 0 0 0 10.4 18h63.2A12 12 0 0 0 138 112L110 58V24" />
      <path d="M66 96h60l12.4 20A12 12 0 0 1 128 130H64.4A12 12 0 0 1 54 116L66 96Z" fill={mid} />
      <circle cx="84" cy="112" r="5" fill="#fff" />
      <circle cx="106" cy="120" r="3.4" fill="#fff" />
      <circle cx="118" cy="108" r="4" fill={tint} />
      <path d="M150 78l12-16 10 12 14-26" stroke={deep} />
      <circle cx="150" cy="78" r="3" fill={deep} stroke="none" />
      <circle cx="186" cy="48" r="3" fill={deep} stroke="none" />
      <Sparks points={[[92, 20, 2.2], [126, 32, 2.4]]} />
    </Scene>
  );
}

/** A cluster of tiny game pieces, deliberately messy. */
export function ArtArcade({ tint = "#ffe4ec", mid = "#ffb3cd", deep = "#a53c67", ...p }: SceneProps) {
  return (
    <Scene {...p}>
      <rect x="20" y="52" width="72" height="56" rx="16" fill={tint} transform="rotate(-6 56 80)" />
      <g transform="rotate(-6 56 80)">
        <path d="M40 78v12M34 84h12" />
        <circle cx="74" cy="78" r="4.6" fill={deep} stroke="none" />
        <circle cx="66" cy="90" r="4.6" fill="#fff" />
      </g>
      <rect x="104" y="30" width="46" height="46" rx="12" fill={mid} transform="rotate(9 127 53)" />
      <g transform="rotate(9 127 53)">
        <circle cx="117" cy="44" r="3.2" fill={INK} stroke="none" />
        <circle cx="137" cy="62" r="3.2" fill={INK} stroke="none" />
        <circle cx="127" cy="53" r="3.2" fill={INK} stroke="none" />
      </g>
      <path d="M120 92h40a10 10 0 0 1 10 10v18a10 10 0 0 1-10 10h-40a10 10 0 0 1-10-10v-18a10 10 0 0 1 10-10Z" fill="#fff" />
      <path d="M126 112h14M133 105v14" />
      <circle cx="157" cy="110" r="4" fill={deep} stroke="none" />
      <Sparks points={[[172, 26, 2.6], [30, 122, 2.4]]} />
    </Scene>
  );
}

/** Two bubbles talking past each other, with a small scale between. */
export function ArtDebate({ tint = "#e9e3fc", mid = "#c4b5f3", deep = "#5a45a6", ...p }: SceneProps) {
  return (
    <Scene {...p}>
      <path d="M16 30h64a10 10 0 0 1 10 10v26a10 10 0 0 1-10 10H40L26 88V76h-10a10 10 0 0 1-10-10V40a10 10 0 0 1 10-10Z" fill={tint} transform="translate(8 0)" />
      <path d="M36 48h34M36 60h22" />
      <path d="M120 62h58a10 10 0 0 1 10 10v26a10 10 0 0 1-10 10h-34l-14 12v-12h-10a10 10 0 0 1-10-10V72a10 10 0 0 1 10-10Z" fill={mid} />
      <path d="M136 80h34M136 92h20" />
      <path d="M96 104v22M84 126h24" stroke={deep} />
      <path d="M82 104h28M88 104l-6 12h12l-6-12ZM104 104l6 12h-12l6-12Z" stroke={deep} />
      <Sparks points={[[176, 34, 2.6], [24, 118, 2.4]]} />
    </Scene>
  );
}

/** Two little canvases, two different marks, one pencil. */
export function ArtDrawTogether({ tint = "#dfecfd", mid = "#a7cbf4", deep = "#2d5d90", ...p }: SceneProps) {
  return (
    <Scene {...p}>
      <rect x="16" y="34" width="76" height="72" rx="14" fill={tint} transform="rotate(-5 54 70)" />
      <g transform="rotate(-5 54 70)">
        <path d="M32 84c8-22 14-6 20-18s10 8 18-6" stroke={deep} />
      </g>
      <rect x="104" y="46" width="80" height="76" rx="14" fill="#fff" transform="rotate(5 144 84)" />
      <g transform="rotate(5 144 84)">
        <circle cx="132" cy="76" r="12" fill={mid} />
        <path d="M118 106h52" />
        <path d="M152 88l12-14 10 12" stroke={INK} />
      </g>
      <path d="M62 118l6-14 30-32 8 8-30 32-14 6Z" fill={mid} />
      <path d="m98 72 8 8" />
      <Sparks points={[[178, 28, 2.6], [24, 126, 2.4]]} />
    </Scene>
  );
}

/** A bench, a small gavel block, and two filed papers. */
export function ArtCouplesCourt({ tint = "#fbf0cf", mid = "#f4d98a", deep = "#8a6a15", ...p }: SceneProps) {
  return (
    <Scene {...p}>
      <rect x="26" y="40" width="48" height="62" rx="8" fill={tint} transform="rotate(-8 50 71)" />
      <g transform="rotate(-8 50 71)">
        <path d="M38 58h24M38 70h24M38 82h14" />
      </g>
      <rect x="74" y="48" width="48" height="62" rx="8" fill="#fff" transform="rotate(4 98 79)" />
      <g transform="rotate(4 98 79)">
        <path d="M86 66h24M86 78h24M86 90h14" />
      </g>
      <rect x="128" y="104" width="56" height="14" rx="7" fill={mid} />
      <rect x="140" y="52" width="20" height="34" rx="9" fill={mid} transform="rotate(38 150 69)" />
      <path d="m156 82 12 14" />
      <Sparks points={[[178, 34, 2.6], [22, 120, 2.4]]} />
    </Scene>
  );
}

/** A viewfinder closing in on something found. */
export function ArtSnapHunt({ tint = "#daf0e4", mid = "#a2ddbe", deep = "#2a6a4d", ...p }: SceneProps) {
  return (
    <Scene {...p}>
      <rect x="22" y="34" width="112" height="86" rx="16" fill={tint} />
      <path d="M22 96l30-26 22 18 24-26 36 32" fill={mid} />
      <circle cx="52" cy="58" r="8" fill="#fff" />
      <path d="M22 50V44a10 10 0 0 1 10-10h8M134 50V44a10 10 0 0 0-10-10h-8M22 104v6a10 10 0 0 0 10 10h8M134 104v6a10 10 0 0 1-10 10h-8" stroke={INK} />
      <circle cx="146" cy="66" r="24" fill="#fff" fillOpacity="0.9" />
      <path d="m164 84 16 18" />
      <circle cx="146" cy="66" r="8" fill={mid} />
      <Sparks points={[[178, 30, 2.6], [24, 132, 2.4]]} />
    </Scene>
  );
}

/** Two arcs meeting into a single heart, with a percentage dial. */
export function ArtLoveMatch({ tint = "#ffe4ec", mid = "#ffb3cd", deep = "#a53c67", ...p }: SceneProps) {
  return (
    <Scene {...p}>
      <circle cx="100" cy="78" r="50" fill={tint} />
      <path d="M100 128a50 50 0 0 1 0-100" stroke={mid} strokeWidth={9} />
      <path d="M100 28a50 50 0 0 1 40 80" stroke={deep} strokeWidth={9} />
      <path d="M100 106s-26-15.6-26-33a13.6 13.6 0 0 1 26-5.4 13.6 13.6 0 0 1 26 5.4c0 17.4-26 33-26 33Z" fill="#fff" />
      <path d="M100 68v22M89 79h22" stroke={deep} />
      <Twinkle x={166} y={36} s={7} />
      <Sparks points={[[34, 34, 2.6], [30, 122, 2.4], [172, 118, 2.2]]} />
    </Scene>
  );
}

/** A horizon with pinned plans above it. */
export function ArtOurFuture({ tint = "#daf0e4", mid = "#a2ddbe", deep = "#2a6a4d", ...p }: SceneProps) {
  return (
    <Scene {...p}>
      <path d="M12 116h176" />
      <path d="M12 116c22-30 40-14 56-34s34 6 52-14 40 12 68-6v54H12Z" fill={tint} />
      <rect x="30" y="28" width="52" height="40" rx="9" fill="#fff" transform="rotate(-7 56 48)" />
      <g transform="rotate(-7 56 48)"><path d="M42 44h28M42 54h18" /></g>
      <rect x="96" y="20" width="50" height="38" rx="9" fill={mid} transform="rotate(6 121 39)" />
      <g transform="rotate(6 121 39)"><path d="M108 36h26M108 46h14" /></g>
      <circle cx="56" cy="26" r="3.4" fill={deep} stroke="none" />
      <circle cx="121" cy="18" r="3.4" fill={deep} stroke="none" />
      <Twinkle x={176} y={40} s={6} />
    </Scene>
  );
}

/** A wrapped box with a heart seal, still shut. */
export function ArtBirthdayGift({ tint = "#ffe4ec", mid = "#ffb3cd", deep = "#a53c67", ...p }: SceneProps) {
  return (
    <Scene {...p}>
      <rect x="44" y="62" width="112" height="18" rx="7" fill={mid} />
      <path d="M52 80h96v42a10 10 0 0 1-10 10H62a10 10 0 0 1-10-10V80Z" fill={tint} />
      <path d="M100 62v70" />
      <path d="M100 62S92 30 78 30a12 12 0 0 0 0 24M100 62s8-32 22-32a12 12 0 0 1 0 24" />
      <path d="M100 104s-13-7.8-13-16.5a6.8 6.8 0 0 1 13-2.7 6.8 6.8 0 0 1 13 2.7c0 8.7-13 16.5-13 16.5Z" fill="#fff" />
      <Twinkle x={34} y={44} s={7} />
      <Sparks points={[[170, 40, 2.6], [178, 106, 2.4], [26, 108, 2.2]]} />
    </Scene>
  );
}

/** A sealed envelope with the year stamped on it. */
export function ArtLetters({ tint = "#e9e3fc", mid = "#c4b5f3", deep = "#5a45a6", ...p }: SceneProps) {
  return (
    <Scene {...p}>
      <rect x="22" y="36" width="132" height="90" rx="14" fill={tint} transform="rotate(-4 88 81)" />
      <g transform="rotate(-4 88 81)">
        <path d="M26 46l54 42a12 12 0 0 0 14 0l56-42" />
        <rect x="116" y="46" width="30" height="24" rx="5" fill="#fff" />
        <path d="M122 58h18" stroke={deep} />
      </g>
      <circle cx="150" cy="106" r="18" fill={mid} />
      <path d="M150 96v11l7 5" stroke={deep} />
      <Sparks points={[[176, 34, 2.6], [24, 128, 2.4]]} />
    </Scene>
  );
}

/** Two shirts on one rail. */
export function ArtPrintStudio({ tint = "#dfecfd", mid = "#a7cbf4", deep = "#2d5d90", ...p }: SceneProps) {
  return (
    <Scene {...p}>
      <path d="M14 30h172" />
      <path d="M58 46 34 56l8 20 10-4v52h48V72l10 4 8-20-24-10a18 18 0 0 1-36 0Z" fill={tint} />
      <path d="M58 46a18 18 0 0 0 36 0" />
      <path d="M156 40l-18 8 6 16 8-3v43h38V61l8 3 6-16-18-8a14 14 0 0 1-30 0Z" fill={mid} transform="translate(-16 6)" />
      <circle cx="76" cy="92" r="11" fill="#fff" />
      <path d="M139 96h26" stroke={deep} />
      <path d="M84 30v-6M136 30v-6" />
      <Sparks points={[[26, 118, 2.4], [180, 122, 2.4]]} />
    </Scene>
  );
}

/** A strip taped onto a page, corner lifting. */
export function ArtScrapbook({ tint = "#fbf0cf", mid = "#f4d98a", deep = "#8a6a15", ...p }: SceneProps) {
  return (
    <Scene {...p}>
      <rect x="24" y="20" width="152" height="112" rx="12" fill={tint} />
      <rect x="66" y="30" width="52" height="94" rx="8" fill="#fff" transform="rotate(-5 92 77)" />
      <g transform="rotate(-5 92 77)">
        <rect x="72" y="38" width="40" height="24" rx="4" fill={mid} />
        <rect x="72" y="66" width="40" height="24" rx="4" fill={mid} />
        <path d="M72 100h32" stroke={deep} />
      </g>
      <rect x="82" y="18" width="26" height="12" rx="2" fill="#fff" fillOpacity="0.9" transform="rotate(-8 95 24)" />
      <path d="M134 52h30M134 68h22M134 84h30" stroke={deep} />
      <Sparks points={[[40, 116, 2.4]]} />
    </Scene>
  );
}

/** A small tree with two roots winding together. */
export function ArtCouplesHub({ tint = "#daf0e4", mid = "#a2ddbe", deep = "#2a6a4d", ...p }: SceneProps) {
  return (
    <Scene {...p}>
      <circle cx="100" cy="58" r="38" fill={tint} />
      <circle cx="72" cy="76" r="24" fill={mid} />
      <circle cx="130" cy="74" r="22" fill={mid} />
      <path d="M100 132V72" />
      <path d="M100 88 78 70M100 76l20-16" />
      <path d="M100 132c-14 0-22-4-28-10M100 132c14 0 22-4 28-10" />
      <circle cx="78" cy="70" r="4" fill={deep} stroke="none" />
      <circle cx="120" cy="60" r="4" fill={deep} stroke="none" />
      <Twinkle x={168} y={32} s={6} />
      <Sparks points={[[30, 40, 2.4], [26, 116, 2.2]]} />
    </Scene>
  );
}

/** The flagship: a strip coming out of the booth, curtain half-drawn. */
export function ArtPhotobooth({ tint = "#ffe4ec", mid = "#ffb3cd", deep = "#a53c67", ...p }: SceneProps) {
  return (
    <Scene {...p}>
      <rect x="20" y="16" width="106" height="118" rx="16" fill={tint} />
      <path d="M20 40h106" />
      <path d="M34 40c0 10 6 12 6 22s-6 12-6 22 6 12 6 22-6 12-6 22" stroke={mid} strokeWidth={7} />
      <circle cx="88" cy="76" r="24" fill="#fff" />
      <circle cx="88" cy="76" r="11" fill={mid} />
      <circle cx="112" cy="52" r="4.4" fill={deep} stroke="none" />
      <rect x="130" y="30" width="50" height="104" rx="10" fill="#fff" transform="rotate(6 155 82)" />
      <g transform="rotate(6 155 82)">
        <rect x="137" y="38" width="36" height="26" rx="4" fill={mid} />
        <rect x="137" y="70" width="36" height="26" rx="4" fill={tint} />
        <rect x="137" y="102" width="36" height="24" rx="4" fill={mid} />
      </g>
      <Twinkle x={186} y={22} s={7} />
      <Sparks points={[[14, 128, 2.4]]} />
    </Scene>
  );
}

/** A screen, two seats, and a reaction leaving one of them. */
export function ArtWatchTogether({ tint = "#e9e3fc", mid = "#c4b5f3", deep = "#5a45a6", ...p }: SceneProps) {
  return (
    <Scene {...p}>
      <rect x="18" y="16" width="164" height="94" rx="12" fill={tint} />
      <path d="M18 100h164" />
      <path d="M74 66l30 -17v34Z" fill={mid} />
      <path d="M86 122h28M100 110v12" />
      <rect x="26" y="118" width="30" height="20" rx="7" fill={mid} />
      <rect x="144" y="118" width="30" height="20" rx="7" fill="#fff" />
      <circle cx="41" cy="112" r="7" fill="#fff" />
      <circle cx="159" cy="112" r="7" fill={mid} />
      <path d="M164 40s-8-5-8-10a4.2 4.2 0 0 1 8-1.6 4.2 4.2 0 0 1 8 1.6c0 5-8 10-8 10Z" fill={deep} stroke="none" />
      <Sparks points={[[150, 54, 2.4], [176, 58, 2]]} />
    </Scene>
  );
}

export const SCENES = {
  "know-me": ArtKnowMe,
  "truth-or-dare": ArtTruthOrDare,
  "honest-cards": ArtHonestCards,
  "iq-duel": ArtIqDuel,
  "riddle-night": ArtRiddleNight,
  "the-lab": ArtTheLab,
  arcade: ArtArcade,
  debate: ArtDebate,
  "draw-together": ArtDrawTogether,
  "couples-court": ArtCouplesCourt,
  "snap-hunt": ArtSnapHunt,
  "love-match": ArtLoveMatch,
  "our-future": ArtOurFuture,
  "birthday-gift": ArtBirthdayGift,
  letters: ArtLetters,
  "print-studio": ArtPrintStudio,
  scrapbook: ArtScrapbook,
  "couples-hub": ArtCouplesHub,
  photobooth: ArtPhotobooth,
  "watch-together": ArtWatchTogether,
} as const;

export type SceneId = keyof typeof SCENES;

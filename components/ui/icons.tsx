import type { SVGProps } from "react";

/**
 * Original line-art icon set. Every glyph is drawn on a 24px grid with a 1.6
 * stroke and a single pastel accent so the grid reads as one family.
 */
type IconProps = SVGProps<SVGSVGElement> & { accent?: string };

function Base({ children, accent, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconBrain = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 4.5A2.5 2.5 0 0 0 6.5 7 2.5 2.5 0 0 0 5 9.4a2.6 2.6 0 0 0 1 2 2.6 2.6 0 0 0-.6 3.3A2.5 2.5 0 0 0 8 18.4c.3 1 1.1 1.6 2.2 1.6H11V4.5Z" />
    <path stroke={p.accent ?? "#f95f9b"} d="M15 4.5A2.5 2.5 0 0 1 17.5 7 2.5 2.5 0 0 1 19 9.4a2.6 2.6 0 0 1-1 2 2.6 2.6 0 0 1 .6 3.3A2.5 2.5 0 0 1 16 18.4c-.3 1-1.1 1.6-2.2 1.6H13V4.5Z" />
  </Base>
);

export const IconDice = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <circle cx="8.5" cy="8.5" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="15.5" r="1.15" fill={p.accent ?? "#8f7ae6"} stroke="none" />
    <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
  </Base>
);

export const IconCards = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="6.5" width="11" height="14" rx="3" />
    <path stroke={p.accent ?? "#4a91e4"} d="M8.4 4.2 17 2.6a2.4 2.4 0 0 1 2.8 1.9l2 10.6a2.4 2.4 0 0 1-1.4 2.6" />
    <path d="M6.6 11.5h4.8M6.6 15h3.2" />
  </Base>
);

export const IconDuel = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 4h3l9.5 9.5" />
    <path d="m14 17 3 3 3-3-3-3" />
    <path stroke={p.accent ?? "#f95f9b"} d="M20 4h-3L7.5 13.5" />
    <path stroke={p.accent ?? "#f95f9b"} d="m10 17-3 3-3-3 3-3" />
  </Base>
);

export const IconRiddle = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 9a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 1.9v.6" />
    <circle cx="12" cy="17.6" r="1.1" fill={p.accent ?? "#f2b23c"} stroke="none" />
    <path stroke={p.accent ?? "#f2b23c"} d="M12 2.8 3.4 7.4v9.2L12 21.2l8.6-4.6V7.4Z" />
  </Base>
);

export const IconFlask = (p: IconProps) => (
  <Base {...p}>
    <path d="M9.5 3h5M10.4 3v6.2L5.6 17a2.6 2.6 0 0 0 2.2 4h8.4a2.6 2.6 0 0 0 2.2-4l-4.8-7.8V3" />
    <path stroke={p.accent ?? "#4fbd8f"} d="M7.6 14.6h8.8" />
    <circle cx="10.6" cy="17.4" r="1" fill={p.accent ?? "#4fbd8f"} stroke="none" />
  </Base>
);

export const IconArcade = (p: IconProps) => (
  <Base {...p}>
    <rect x="2.5" y="7" width="19" height="11" rx="4" />
    <path d="M7 10.6v3.4M5.3 12.3h3.4" />
    <circle cx="16" cy="11.6" r="1.1" fill={p.accent ?? "#f95f9b"} stroke="none" />
    <circle cx="18.4" cy="14" r="1.1" fill={p.accent ?? "#4a91e4"} stroke="none" />
  </Base>
);

export const IconDebate = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h6A2.5 2.5 0 0 1 14 6.5v3A2.5 2.5 0 0 1 11.5 12H7l-4 3Z" />
    <path stroke={p.accent ?? "#8f7ae6"} d="M10 15.2c.3 1.1 1.3 1.8 2.5 1.8H17l4 3V13a2.5 2.5 0 0 0-2.5-2.5H17" />
  </Base>
);

export const IconDraw = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.2 20.8 4 17l10.4-10.4 3 3L7 20l-3.8.8Z" />
    <path stroke={p.accent ?? "#f95f9b"} d="m16.6 4.4 1.6-1.6a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8l-1.6 1.6Z" />
    <path d="M3.4 12.5A4.5 4.5 0 0 1 8 8" />
  </Base>
);

export const IconGavel = (p: IconProps) => (
  <Base {...p}>
    <path d="m12.6 6.4 5 5" />
    <rect x="9.6" y="3.5" width="9" height="4.2" rx="2.1" transform="rotate(45 14.1 5.6)" />
    <path stroke={p.accent ?? "#f2b23c"} d="m10.6 10.4-7 7 2.9 2.9 7-7" />
    <path d="M13.5 20.5h8" />
  </Base>
);

export const IconSnap = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 8.6A2.6 2.6 0 0 1 5.6 6h1.7l1.3-2h6l1.3 2h1.5A2.6 2.6 0 0 1 20 8.6v8A2.6 2.6 0 0 1 17.4 19H5.6A2.6 2.6 0 0 1 3 16.6Z" />
    <circle cx="11.5" cy="12.4" r="3.4" stroke={p.accent ?? "#4a91e4"} />
  </Base>
);

export const IconHeartLink = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 20.4S3.6 15.6 3.6 9.9A4.4 4.4 0 0 1 12 8.1a4.4 4.4 0 0 1 8.4 1.8c0 5.7-8.4 10.5-8.4 10.5Z" />
    <path stroke={p.accent ?? "#f95f9b"} d="M8.8 11.6h6.4M12 8.6v6" />
  </Base>
);

export const IconCompass = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path stroke={p.accent ?? "#4fbd8f"} d="m15.4 8.6-1.8 5-5 1.8 1.8-5Z" />
  </Base>
);

export const IconGift = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 9.5h17V12H3.5zM5 12v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12" />
    <path d="M12 9.5V21" />
    <path stroke={p.accent ?? "#f95f9b"} d="M12 9.5S10.8 4 8.4 4a2.2 2.2 0 0 0 0 4.4M12 9.5s1.2-5.5 3.6-5.5a2.2 2.2 0 0 1 0 4.4" />
  </Base>
);

export const IconLetter = (p: IconProps) => (
  <Base {...p}>
    <rect x="2.8" y="5" width="18.4" height="14" rx="3" />
    <path stroke={p.accent ?? "#8f7ae6"} d="m3.6 7 7.1 5.4a2.1 2.1 0 0 0 2.6 0L20.4 7" />
  </Base>
);

export const IconShirt = (p: IconProps) => (
  <Base {...p}>
    <path d="M8.6 3 4 5.4l1.6 4.2 2-.7V21h8.8V8.9l2 .7L20 5.4 15.4 3" />
    <path stroke={p.accent ?? "#4a91e4"} d="M8.6 3a3.4 3.4 0 0 0 6.8 0" />
  </Base>
);

export const IconScrapbook = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="3" width="16" height="18" rx="3" />
    <path d="M4 7.5h16" />
    <path stroke={p.accent ?? "#f2b23c"} d="M8 11.5h8M8 15h5" />
    <path d="M8 3v18" />
  </Base>
);

export const IconTree = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 21v-6.5" />
    <path stroke={p.accent ?? "#4fbd8f"} d="M12 14.5 8 11M12 12l3.6-3.2" />
    <path d="M12 3.4c3.4 0 6.1 2.6 6.1 5.8 0 3.2-2.7 5.8-6.1 5.8S5.9 12.4 5.9 9.2 8.6 3.4 12 3.4Z" />
  </Base>
);

export const IconBooth = (p: IconProps) => (
  <Base {...p}>
    <rect x="6" y="2.8" width="12" height="18.4" rx="2" />
    <path stroke={p.accent ?? "#f95f9b"} d="M8.6 6.4h6.8M8.6 10.6h6.8M8.6 14.8h6.8" />
    <path d="M3.4 5.6v12.8M20.6 5.6v12.8" />
  </Base>
);

export const IconSparkle = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.2 13.8 9 19.6 10.8 13.8 12.6 12 18.4 10.2 12.6 4.4 10.8 10.2 9Z" />
    <path stroke={p.accent ?? "#f95f9b"} d="M18.4 16.2 19.2 18.6 21.6 19.4 19.2 20.2 18.4 22.6 17.6 20.2 15.2 19.4 17.6 18.6Z" />
  </Base>
);

export const IconArrowRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);

export const IconClose = (p: IconProps) => (
  <Base {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Base>
);

export const IconCheck = (p: IconProps) => (
  <Base {...p}>
    <path d="m5 12.5 4.6 4.5L19 7" />
  </Base>
);

export const IconCopy = (p: IconProps) => (
  <Base {...p}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="3" />
    <path d="M15.5 5.5A2 2 0 0 0 13.5 3.5h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2" />
  </Base>
);

export const IconDownload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5" />
    <path d="M4 17v1.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V17" />
  </Base>
);

export const IconUndo = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 9h9.5a5.5 5.5 0 0 1 0 11H8" />
    <path d="M7.5 5.5 4 9l3.5 3.5" />
  </Base>
);

export const IconTrash = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 6.5h15M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7" />
    <path d="M6.5 6.5 7.4 19a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9l.9-12.5" />
  </Base>
);

export const IconPlus = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconUsers = (p: IconProps) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path stroke={p.accent ?? "#4a91e4"} d="M16 5.4a3.4 3.4 0 0 1 0 6.6M17.5 14.4A6 6 0 0 1 21 20" />
  </Base>
);

export const IconCamera = IconSnap;

export const IconRefresh = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 11.5A8 8 0 0 0 6.3 6.3L4 8.5" />
    <path d="M4 4v4.5h4.5" />
    <path d="M4 12.5A8 8 0 0 0 17.7 17.7L20 15.5" />
    <path d="M20 20v-4.5h-4.5" />
  </Base>
);

export const IconEraser = (p: IconProps) => (
  <Base {...p}>
    <path d="m8.6 20.5-5-5a2 2 0 0 1 0-2.9l8.5-8.5a2 2 0 0 1 2.9 0l5 5a2 2 0 0 1 0 2.9l-8.5 8.5Z" />
    <path d="M20.5 20.5h-12" />
    <path stroke={p.accent ?? "#4a91e4"} d="m7.6 9.6 6.8 6.8" />
  </Base>
);

export const IconPen = IconDraw;

export const IconLock = (p: IconProps) => (
  <Base {...p}>
    <rect x="4.5" y="10" width="15" height="10.5" rx="3" />
    <path stroke={p.accent ?? "#8f7ae6"} d="M8 10V7.5a4 4 0 0 1 8 0V10" />
  </Base>
);

export const IconClock = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path stroke={p.accent ?? "#f95f9b"} d="M12 7v5.2l3.4 2" />
  </Base>
);

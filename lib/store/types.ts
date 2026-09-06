export interface StoredPhotoStrip {
  id: string;
  /** Composed strip as a PNG data URL. */
  dataUrl: string;
  createdAt: string;
  frame: string;
  filter: string;
  caption?: string;
  roomCode?: string;
}

export interface ScrapbookItem {
  id: string;
  kind: "strip" | "drawing" | "photo" | "note";
  dataUrl?: string;
  title: string;
  caption: string;
  date: string;
  createdAt: string;
  /** Small random rotation so the page feels like paper, stored so it is stable. */
  tilt: number;
}

export interface Letter {
  id: string;
  to: string;
  from: string;
  subject: string;
  body: string;
  deliverOn: string;
  createdAt: string;
  openedAt: string | null;
}

export interface GiftPage {
  id: string;
  title: string;
  recipient: string;
  sender: string;
  message: string;
  revealOn: string;
  photos: string[];
  memories: { id: string; title: string; detail: string }[];
  createdAt: string;
}

export interface Memory {
  id: string;
  experienceId: string;
  title: string;
  detail: string;
  createdAt: string;
  dataUrl?: string;
}

export interface CoupleProfile {
  coupleName: string;
  partnerOneName: string;
  partnerTwoName: string;
  since: string;
  emoji: string;
  note: string;
}

export interface Goal {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
}

export interface StudioDesign {
  id: string;
  name: string;
  dataUrl: string;
  shirtColor: string;
  createdAt: string;
}

export interface CompletionRecord {
  experienceId: string;
  count: number;
  lastAt: string;
}

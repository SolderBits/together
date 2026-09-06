/**
 * Photo strip composition. Everything here runs in the browser on a canvas —
 * no server is involved in making a strip, and the export is print-resolution.
 */

export interface StripFrame {
  id: string;
  label: string;
  /** CSS colour or a gradient descriptor resolved at paint time. */
  background: string | { from: string; to: string };
  textColor: string;
  cellBorder?: string;
  cellRadius: number;
}

export const STRIP_FRAMES: StripFrame[] = [
  { id: "classic", label: "Classic", background: "#ffffff", textColor: "#111114", cellRadius: 0.02 },
  { id: "ink", label: "Ink", background: "#111114", textColor: "#ffffff", cellRadius: 0.02 },
  { id: "cream", label: "Cream", background: "#f6efe3", textColor: "#4a3f2f", cellRadius: 0.06 },
  {
    id: "blush",
    label: "Blush",
    background: { from: "#ffd6e6", to: "#dbeafe" },
    textColor: "#5b2c43",
    cellRadius: 0.06,
  },
  {
    id: "mint",
    label: "Mint",
    background: { from: "#e3f7ee", to: "#f0ecff" },
    textColor: "#265a46",
    cellRadius: 0.06,
  },
  {
    id: "film",
    label: "Film",
    background: "#1c1c1f",
    textColor: "#f2e9d8",
    cellBorder: "#3a3a40",
    cellRadius: 0.01,
  },
];

export interface StripFilter {
  id: string;
  label: string;
  /** Valid for both CSS `filter` and canvas `ctx.filter`. */
  css: string;
}

export const STRIP_FILTERS: StripFilter[] = [
  { id: "none", label: "None", css: "none" },
  { id: "mono", label: "Mono", css: "grayscale(1) contrast(1.08)" },
  { id: "sepia", label: "Sepia", css: "sepia(0.62) saturate(1.15) contrast(1.02)" },
  { id: "warm", label: "Warm", css: "saturate(1.25) sepia(0.18) brightness(1.05)" },
  { id: "cool", label: "Cool", css: "saturate(1.1) hue-rotate(-12deg) brightness(1.04)" },
  { id: "faded", label: "Faded", css: "contrast(0.86) saturate(0.78) brightness(1.1)" },
  { id: "punch", label: "Punch", css: "contrast(1.28) saturate(1.4)" },
];

export interface StripSticker {
  id: string;
  emoji: string;
  /** Normalised across the whole strip. */
  x: number;
  y: number;
  size: number;
  rotation: number;
}

export const STICKER_CHOICES = [
  "❤️", "✨", "🌸", "⭐️", "🫶", "🔥", "🌙", "🍓", "🦋", "☕️", "🎈", "🐚",
];

export interface StripSpec {
  /** One entry per capture round; each holds 1–2 player photos. */
  rounds: string[][];
  frameId: string;
  filterId: string;
  caption: string;
  showDate: boolean;
  date: string;
  stickers: StripSticker[];
}

export const STRIP_ASPECT_CELL = 4 / 3;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load a photo for the strip."));
    img.src = src;
  });
}

function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Draws `img` cropped to fill the box, centred (object-fit: cover). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export function stripDimensions(roundCount: number, width: number) {
  const pad = width * 0.055;
  const gap = width * 0.028;
  const cellW = width - pad * 2;
  const cellH = cellW / STRIP_ASPECT_CELL;
  const footer = width * 0.2;
  const height = pad + roundCount * cellH + Math.max(0, roundCount - 1) * gap + footer;
  return { pad, gap, cellW, cellH, footer, height };
}

/**
 * Composes the finished strip. `width` is the output pixel width — 1200 for a
 * screen preview, 2400 for the downloadable copy.
 */
export async function composeStrip(spec: StripSpec, width = 1200): Promise<string> {
  const frame = STRIP_FRAMES.find((f) => f.id === spec.frameId) ?? STRIP_FRAMES[0];
  const filter = STRIP_FILTERS.find((f) => f.id === spec.filterId) ?? STRIP_FILTERS[0];
  const rounds = spec.rounds.filter((r) => r.length > 0);
  const { pad, gap, cellW, cellH, height } = stripDimensions(Math.max(1, rounds.length), width);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");

  // Background
  if (typeof frame.background === "string") {
    ctx.fillStyle = frame.background;
  } else {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, frame.background.from);
    gradient.addColorStop(1, frame.background.to);
    ctx.fillStyle = gradient;
  }
  ctx.fillRect(0, 0, width, height);

  // Cells
  for (let i = 0; i < rounds.length; i++) {
    const y = pad + i * (cellH + gap);
    const photos = await Promise.all(rounds[i].map(loadImage));

    ctx.save();
    roundedPath(ctx, pad, y, cellW, cellH, cellW * frame.cellRadius);
    ctx.clip();
    ctx.fillStyle = "#000000";
    ctx.fillRect(pad, y, cellW, cellH);

    ctx.filter = filter.css === "none" ? "none" : filter.css;
    if (photos.length === 1) {
      drawCover(ctx, photos[0], pad, y, cellW, cellH);
    } else {
      const half = cellW / 2;
      drawCover(ctx, photos[0], pad, y, half, cellH);
      drawCover(ctx, photos[1], pad + half, y, half, cellH);
    }
    ctx.filter = "none";
    ctx.restore();

    if (photos.length > 1) {
      // Hairline between the two halves so the split reads as intentional.
      ctx.fillStyle = typeof frame.background === "string" ? frame.background : "#ffffff";
      ctx.fillRect(pad + cellW / 2 - width * 0.0022, y, width * 0.0044, cellH);
    }

    if (frame.cellBorder) {
      ctx.strokeStyle = frame.cellBorder;
      ctx.lineWidth = Math.max(1, width * 0.004);
      roundedPath(ctx, pad, y, cellW, cellH, cellW * frame.cellRadius);
      ctx.stroke();
    }
  }

  // Footer text
  const footerTop = pad + rounds.length * cellH + Math.max(0, rounds.length - 1) * gap;
  ctx.textAlign = "center";
  ctx.fillStyle = frame.textColor;

  const caption = spec.caption.trim();
  if (caption) {
    ctx.font = `800 ${Math.round(width * 0.062)}px -apple-system, "Segoe UI", Inter, sans-serif`;
    ctx.fillText(caption, width / 2, footerTop + width * 0.085, cellW);
  }
  if (spec.showDate && spec.date) {
    ctx.globalAlpha = 0.62;
    ctx.font = `600 ${Math.round(width * 0.032)}px -apple-system, "Segoe UI", Inter, sans-serif`;
    ctx.fillText(spec.date, width / 2, footerTop + width * (caption ? 0.14 : 0.09));
    ctx.globalAlpha = 1;
  }

  // Stickers sit above everything
  for (const sticker of spec.stickers) {
    ctx.save();
    ctx.translate(sticker.x * width, sticker.y * height);
    ctx.rotate((sticker.rotation * Math.PI) / 180);
    ctx.font = `${Math.round(sticker.size * width)}px -apple-system, "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(sticker.emoji, 0, 0);
    ctx.restore();
  }

  return canvas.toDataURL("image/png");
}

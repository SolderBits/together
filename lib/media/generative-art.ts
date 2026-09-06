import { hashString, mulberry32 } from "@/lib/utils";

/**
 * Procedural "couple art" generated locally from a seed phrase.
 *
 * This is a real, deterministic generator rather than a dead button — and it is
 * also the seam where a hosted image model would plug in: swap this call for a
 * server route that returns a data URL and the rest of the editor is unchanged.
 */
export function generateCoupleArt(seed: string, size = 900): string {
  const rand = mulberry32(hashString(seed || "together"));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");

  const palettes = [
    ["#f95f9b", "#8f7ae6", "#4a91e4"],
    ["#4fbd8f", "#4a91e4", "#8f7ae6"],
    ["#f2b23c", "#f95f9b", "#8f7ae6"],
    ["#111114", "#74747f", "#f95f9b"],
    ["#4a91e4", "#4fbd8f", "#f2b23c"],
  ];
  const palette = palettes[Math.floor(rand() * palettes.length)];

  ctx.clearRect(0, 0, size, size);

  // Two interlocking rings — the shared motif, rendered differently every seed.
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * (0.22 + rand() * 0.06);
  const offset = radius * (0.55 + rand() * 0.35);
  const rings = 3 + Math.floor(rand() * 4);

  for (let i = rings; i > 0; i--) {
    const t = i / rings;
    ctx.beginPath();
    ctx.lineWidth = size * (0.006 + rand() * 0.012);
    ctx.strokeStyle = palette[i % palette.length];
    ctx.globalAlpha = 0.35 + 0.65 * (1 - t);
    ctx.arc(cx - offset, cy, radius * (0.6 + t * 0.6), 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = palette[(i + 1) % palette.length];
    ctx.arc(cx + offset, cy, radius * (0.6 + t * 0.6), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Orbiting dots for texture.
  const dots = 40 + Math.floor(rand() * 70);
  for (let i = 0; i < dots; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = radius * (0.4 + rand() * 2.2);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist * (0.55 + rand() * 0.5);
    ctx.beginPath();
    ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
    ctx.globalAlpha = 0.18 + rand() * 0.5;
    ctx.arc(x, y, size * (0.002 + rand() * 0.009), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // A connecting arc through both centres.
  ctx.beginPath();
  ctx.strokeStyle = palette[0];
  ctx.lineWidth = size * 0.008;
  ctx.lineCap = "round";
  ctx.moveTo(cx - offset, cy);
  ctx.quadraticCurveTo(cx, cy - radius * (0.8 + rand()), cx + offset, cy);
  ctx.stroke();

  return canvas.toDataURL("image/png");
}

export const SHIRT_COLORS = [
  { id: "white", label: "White", hex: "#f5f5f2", ink: "#111114" },
  { id: "black", label: "Black", hex: "#1b1b1e", ink: "#ffffff" },
  { id: "sand", label: "Sand", hex: "#e6ddcc", ink: "#3d362b" },
  { id: "blush", label: "Blush", hex: "#f7d6e2", ink: "#5b2c43" },
  { id: "sky", label: "Sky", hex: "#cfe2f7", ink: "#1f3f5e" },
  { id: "sage", label: "Sage", hex: "#d3e3d5", ink: "#2b4432" },
];

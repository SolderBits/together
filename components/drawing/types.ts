export type StrokeMode = "pen" | "eraser";

export interface Stroke {
  id: string;
  color: string;
  /** Brush width as a fraction of the canvas width, so it scales with export. */
  size: number;
  mode: StrokeMode;
  /** Flat [x0,y0,x1,y1,…] in normalised 0–1 space. */
  points: number[];
}

/** Warm ink first, then the product's pastels at full strength, then white. */
export const BRUSH_COLORS = [
  "#16140f",
  "#e2568c",
  "#eba43a",
  "#3f9d72",
  "#3f83cd",
  "#7f68d8",
  "#d1663a",
  "#ffffff",
];

export const BRUSH_SIZES = [
  { label: "Fine", value: 0.006 },
  { label: "Medium", value: 0.014 },
  { label: "Thick", value: 0.03 },
  { label: "Marker", value: 0.06 },
];

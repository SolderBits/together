import type { Stroke } from "@/components/drawing/types";

/** Paints normalised strokes into any 2D context at the given pixel size. */
export function paintStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  width: number,
  height: number,
  background = "#ffffff",
) {
  ctx.save();
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;
    ctx.beginPath();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, stroke.size * width);
    ctx.globalCompositeOperation = stroke.mode === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = stroke.mode === "eraser" ? "rgba(0,0,0,1)" : stroke.color;
    ctx.moveTo(stroke.points[0] * width, stroke.points[1] * height);
    if (stroke.points.length === 2) {
      ctx.lineTo(stroke.points[0] * width + 0.01, stroke.points[1] * height);
    } else {
      for (let i = 2; i < stroke.points.length; i += 2) {
        ctx.lineTo(stroke.points[i] * width, stroke.points[i + 1] * height);
      }
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

export function strokesToDataUrl(strokes: Stroke[], size = 1200, background = "#ffffff") {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) paintStrokes(ctx, strokes, size, size, background);
  return canvas.toDataURL("image/png");
}

/** Side-by-side comparison sheet with the prompt printed underneath. */
export function composeComparison(options: {
  prompt: string;
  panels: { label: string; strokes: Stroke[] }[];
  size?: number;
}) {
  const { prompt, panels, size = 1000 } = options;
  const pad = Math.round(size * 0.06);
  const gap = Math.round(size * 0.05);
  const panelSize = size;
  const headerH = Math.round(size * 0.2);
  const labelH = Math.round(size * 0.12);

  const width = pad * 2 + panelSize * panels.length + gap * (panels.length - 1);
  const height = headerH + panelSize + labelH + pad;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");

  ctx.fillStyle = "#fbfbf9";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#111114";
  ctx.textAlign = "center";
  ctx.font = `800 ${Math.round(size * 0.075)}px -apple-system, "Segoe UI", Inter, sans-serif`;
  ctx.fillText(prompt, width / 2, headerH * 0.62);

  panels.forEach((panel, i) => {
    const x = pad + i * (panelSize + gap);
    const y = headerH;

    ctx.save();
    ctx.beginPath();
    const r = Math.round(size * 0.04);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + panelSize, y, x + panelSize, y + panelSize, r);
    ctx.arcTo(x + panelSize, y + panelSize, x, y + panelSize, r);
    ctx.arcTo(x, y + panelSize, x, y, r);
    ctx.arcTo(x, y, x + panelSize, y, r);
    ctx.closePath();
    ctx.clip();
    ctx.translate(x, y);
    paintStrokes(ctx, panel.strokes, panelSize, panelSize);
    ctx.restore();

    ctx.strokeStyle = "rgba(17,17,20,0.10)";
    ctx.lineWidth = Math.max(1, size * 0.003);
    ctx.stroke();

    ctx.fillStyle = "#74747f";
    ctx.font = `700 ${Math.round(size * 0.045)}px -apple-system, "Segoe UI", Inter, sans-serif`;
    ctx.fillText(panel.label, x + panelSize / 2, y + panelSize + labelH * 0.62);
  });

  return canvas.toDataURL("image/png");
}

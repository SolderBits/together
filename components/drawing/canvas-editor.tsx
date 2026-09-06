"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { Stroke, StrokeMode } from "./types";
import { capturePointer, uid } from "@/lib/utils";

export interface CanvasEditorHandle {
  /** Renders at `scale`× the on-screen size and returns a PNG data URL. */
  toDataURL(scale?: number): string;
  /** Draws the current content into an arbitrary context (used by composers). */
  drawInto(ctx: CanvasRenderingContext2D, width: number, height: number): void;
  undo(): void;
  clear(): void;
  getStrokes(): Stroke[];
  setStrokes(strokes: Stroke[]): void;
  addStroke(stroke: Stroke): void;
  isEmpty(): boolean;
}

/**
 * Resolution-independent freehand canvas. Strokes are stored in normalised
 * coordinates, so the same data renders correctly on a phone, a desktop and a
 * 4× export — and can be streamed to another device of any size.
 */
export const CanvasEditor = forwardRef<
  CanvasEditorHandle,
  {
    color: string;
    size: number;
    mode: StrokeMode;
    background?: string;
    disabled?: boolean;
    aspect?: number;
    className?: string;
    onStrokeEnd?: (stroke: Stroke) => void;
    onChange?: (strokeCount: number) => void;
  }
>(function CanvasEditor(
  {
    color,
    size,
    mode,
    background = "#ffffff",
    disabled,
    aspect = 1,
    className,
    onStrokeEnd,
    onChange,
  },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const activeRef = useRef<Stroke | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  // --- rendering -----------------------------------------------------------

  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      ctx.save();
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);

      const all = activeRef.current
        ? [...strokesRef.current, activeRef.current]
        : strokesRef.current;

      for (const stroke of all) {
        if (stroke.points.length < 2) continue;
        ctx.beginPath();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = Math.max(1, stroke.size * width);
        if (stroke.mode === "eraser") {
          ctx.globalCompositeOperation = "destination-out";
          ctx.strokeStyle = "rgba(0,0,0,1)";
        } else {
          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = stroke.color;
        }

        ctx.moveTo(stroke.points[0] * width, stroke.points[1] * height);
        if (stroke.points.length === 2) {
          // A single tap still leaves a dot.
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
    },
    [background],
  );

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    paint(ctx, w, h);
  }, [paint]);

  // --- sizing --------------------------------------------------------------

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const resize = () => {
      const width = wrap.clientWidth;
      const height = Math.round(width / aspect);
      setDims({ w: width, h: height });
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        render();
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [aspect, render]);

  // --- pointer handling ----------------------------------------------------

  function pointFrom(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    ];
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    capturePointer(e.currentTarget, e.pointerId);
    const [x, y] = pointFrom(e);
    activeRef.current = { id: uid("st_"), color, size, mode, points: [x, y] };
    render();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled || !activeRef.current) return;
    const [x, y] = pointFrom(e);
    const pts = activeRef.current.points;
    const lastX = pts[pts.length - 2];
    const lastY = pts[pts.length - 1];
    // Drop sub-pixel jitter so streamed strokes stay small.
    if (Math.hypot(x - lastX, y - lastY) < 0.002) return;
    pts.push(x, y);
    render();
  }

  function endStroke() {
    const stroke = activeRef.current;
    activeRef.current = null;
    if (!stroke) return;
    strokesRef.current = [...strokesRef.current, stroke];
    render();
    onStrokeEnd?.(stroke);
    onChange?.(strokesRef.current.length);
  }

  // --- imperative API ------------------------------------------------------

  useImperativeHandle(
    ref,
    (): CanvasEditorHandle => ({
      toDataURL(scale = 2) {
        const out = document.createElement("canvas");
        const w = Math.max(1, Math.round(dims.w * scale));
        const h = Math.max(1, Math.round(dims.h * scale));
        out.width = w;
        out.height = h;
        const ctx = out.getContext("2d");
        if (ctx) paint(ctx, w, h);
        return out.toDataURL("image/png");
      },
      drawInto(ctx, width, height) {
        paint(ctx, width, height);
      },
      undo() {
        strokesRef.current = strokesRef.current.slice(0, -1);
        render();
        onChange?.(strokesRef.current.length);
      },
      clear() {
        strokesRef.current = [];
        activeRef.current = null;
        render();
        onChange?.(0);
      },
      getStrokes: () => strokesRef.current,
      setStrokes(strokes) {
        strokesRef.current = strokes;
        render();
        onChange?.(strokes.length);
      },
      addStroke(stroke) {
        strokesRef.current = [...strokesRef.current, stroke];
        render();
      },
      isEmpty: () => strokesRef.current.length === 0,
    }),
    [dims.w, dims.h, paint, render, onChange],
  );

  return (
    <div ref={wrapRef} className={className}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerLeave={endStroke}
        onPointerCancel={endStroke}
        className="touch-none block w-full rounded-3xl"
        style={{ cursor: disabled ? "not-allowed" : "crosshair", background }}
        aria-label="Drawing canvas"
      />
    </div>
  );
});

/** Read-only renderer for someone else's strokes (live partner preview). */
export function StrokePreview({
  strokes,
  aspect = 1,
  background = "#ffffff",
  className,
}: {
  strokes: Stroke[];
  aspect?: number;
  background?: string;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const draw = () => {
      const width = wrap.clientWidth;
      const height = Math.round(width / aspect);
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
        for (let i = 2; i < stroke.points.length; i += 2) {
          ctx.lineTo(stroke.points[i] * width, stroke.points[i + 1] * height);
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [strokes, aspect, background]);

  return (
    <div ref={wrapRef} className={className}>
      <canvas ref={canvasRef} className="block w-full rounded-2xl" />
    </div>
  );
}

"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { PageHeading, PageShell } from "@/components/layout/page-shell";
import { Button, IconButton } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { Label, TextField } from "@/components/ui/field";
import { IconClose, IconDownload, IconTrash } from "@/components/ui/icons";
import { CanvasEditor, type CanvasEditorHandle } from "@/components/drawing/canvas-editor";
import { CanvasToolbar } from "@/components/drawing/canvas-toolbar";
import type { Stroke, StrokeMode } from "@/components/drawing/types";
import { paintStrokes } from "@/lib/media/render-strokes";
import { describeOutcome, exportImage } from "@/lib/media/export-image";
import { SHIRT_COLORS, generateCoupleArt } from "@/lib/media/generative-art";
import { fileToDataUrl } from "@/lib/media/use-camera";
import { deleteDesign, listDesigns, recordCompletion, saveDesign } from "@/lib/store";
import type { StudioDesign } from "@/lib/store/types";
import { useStoreList } from "@/lib/store/use-store";
import { capturePointer, clamp, uid } from "@/lib/utils";
import { cn } from "@/lib/utils";

type LayerKind = "text" | "image" | "shape";
type ShapeKind = "circle" | "square" | "heart" | "ring";

interface Layer {
  id: string;
  kind: LayerKind;
  /** Normalised centre within the print area. */
  x: number;
  y: number;
  scale: number;
  rotation: number;
  color: string;
  text?: string;
  dataUrl?: string;
  shape?: ShapeKind;
}

const FONT_STACK = `800 {size}px -apple-system, "Segoe UI", Inter, Helvetica, sans-serif`;
const PALETTE = ["#111114", "#ffffff", "#f95f9b", "#f2b23c", "#4fbd8f", "#4a91e4", "#8f7ae6"];
const SHAPES: { id: ShapeKind; label: string }[] = [
  { id: "circle", label: "Circle" },
  { id: "square", label: "Square" },
  { id: "ring", label: "Ring" },
  { id: "heart", label: "Heart" },
];

export function PrintStudio() {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#111114");
  const [brush, setBrush] = useState(0.014);
  const [mode, setMode] = useState<StrokeMode>("pen");
  const [shirtColor, setShirtColor] = useState(SHIRT_COLORS[0]);
  const [partnerColor, setPartnerColor] = useState(SHIRT_COLORS[1]);
  const [textDraft, setTextDraft] = useState("");
  const [artSeed, setArtSeed] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [designs, refreshDesigns] = useStoreList<StudioDesign>(listDesigns);
  const [savedName, setSavedName] = useState("");

  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<CanvasEditorHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = layers.find((l) => l.id === selectedId) ?? null;

  const addLayer = useCallback((layer: Omit<Layer, "id" | "x" | "y" | "scale" | "rotation">) => {
    const id = uid("layer_");
    setLayers((current) => [
      ...current,
      { id, x: 0.5, y: 0.42 + current.length * 0.04, scale: 1, rotation: 0, ...layer },
    ]);
    setSelectedId(id);
  }, []);

  function updateSelected(patch: Partial<Layer>) {
    if (!selectedId) return;
    setLayers((current) => current.map((l) => (l.id === selectedId ? { ...l, ...patch } : l)));
  }

  function onDragMove(e: React.PointerEvent, layer: Layer) {
    if (dragId !== layer.id || drawing) return;
    const area = areaRef.current;
    if (!area) return;
    const rect = area.getBoundingClientRect();
    setLayers((current) =>
      current.map((l) =>
        l.id === layer.id
          ? {
              ...l,
              x: clamp((e.clientX - rect.left) / rect.width, 0.02, 0.98),
              y: clamp((e.clientY - rect.top) / rect.height, 0.02, 0.98),
            }
          : l,
      ),
    );
  }

  /** Renders the print artwork (transparent background) at any resolution. */
  const composeArt = useCallback(
    async (size = 2048): Promise<string> => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return canvas.toDataURL("image/png");

      if (strokes.length) {
        const layer = document.createElement("canvas");
        layer.width = size;
        layer.height = size;
        const lctx = layer.getContext("2d");
        if (lctx) {
          paintStrokes(lctx, strokes, size, size, "rgba(0,0,0,0)");
          ctx.drawImage(layer, 0, 0);
        }
      }

      for (const item of layers) {
        ctx.save();
        ctx.translate(item.x * size, item.y * size);
        ctx.rotate((item.rotation * Math.PI) / 180);

        if (item.kind === "text" && item.text) {
          const fontSize = size * 0.09 * item.scale;
          ctx.font = FONT_STACK.replace("{size}", String(Math.round(fontSize)));
          ctx.fillStyle = item.color;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(item.text, 0, 0);
        } else if (item.kind === "image" && item.dataUrl) {
          const img = await loadImage(item.dataUrl);
          const w = size * 0.45 * item.scale;
          const h = (img.height / img.width) * w;
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        } else if (item.kind === "shape") {
          const r = size * 0.13 * item.scale;
          ctx.fillStyle = item.color;
          ctx.strokeStyle = item.color;
          ctx.lineWidth = size * 0.018 * item.scale;
          if (item.shape === "square") {
            ctx.fillRect(-r, -r, r * 2, r * 2);
          } else if (item.shape === "ring") {
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.stroke();
          } else if (item.shape === "heart") {
            drawHeart(ctx, r);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      return canvas.toDataURL("image/png");
    },
    [layers, strokes],
  );

  async function download() {
    const url = await composeArt(2400);
    setExportNote(describeOutcome(await exportImage(url, "together-print.png", { title: "Our print" }), "print"));
  }

  async function save() {
    const url = await composeArt(1200);
    saveDesign({
      name: savedName.trim() || "Untitled design",
      dataUrl: url,
      shirtColor: shirtColor.id,
    });
    recordCompletion("print-studio");
    setSavedName("");
    refreshDesigns();
  }

  const hasContent = layers.length > 0 || strokes.length > 0;

  const previewLayers = useMemo(() => layers, [layers]);

  return (
    <PageShell width="wide" className="pb-24 pt-10 sm:pt-14">
      <PageHeading
        eyebrow="Print Studio"
        title="Design the pair, then wear them"
        subtitle="Type, draw, drop in a photo, generate some art. Export print-ready and take it to any printer."
        actions={
          <>
            <Button variant="secondary" onClick={download} disabled={!hasContent}>
              <IconDownload width={16} height={16} /> Export
            </Button>
          </>
        }
      />

      <div className="mt-9 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* --- tools --- */}
        <aside className="space-y-4">
          <Panel title="Text">
            <div className="flex gap-2">
              <TextField
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                placeholder="Add some words"
                aria-label="Text to add"
              />
              <Button
                disabled={!textDraft.trim()}
                onClick={() => {
                  addLayer({ kind: "text", text: textDraft.trim(), color });
                  setTextDraft("");
                }}
              >
                Add
              </Button>
            </div>
          </Panel>

          <Panel title="Shapes">
            <div className="flex flex-wrap gap-2">
              {SHAPES.map((shape) => (
                <button
                  key={shape.id}
                  type="button"
                  onClick={() => addLayer({ kind: "shape", shape: shape.id, color })}
                  className="rounded-[20px] ring-1 ring-inset ring-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-muted transition-colors hover:ring-line-strong hover:text-ink"
                >
                  {shape.label}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Image">
            <Button block variant="secondary" onClick={() => fileRef.current?.click()}>
              Upload a photo
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                addLayer({ kind: "image", dataUrl: await fileToDataUrl(file, 1200), color });
              }}
            />
          </Panel>

          <Panel title="Generated art">
            <div className="flex gap-2">
              <TextField
                value={artSeed}
                onChange={(e) => setArtSeed(e.target.value)}
                placeholder="A word or a date"
                aria-label="Art seed"
              />
              <Button
                onClick={() =>
                  addLayer({ kind: "image", dataUrl: generateCoupleArt(artSeed || uid()), color })
                }
              >
                Make
              </Button>
            </div>
            <p className="mt-2.5 text-[12px] leading-relaxed text-ink-faint">
              Drawn locally from your seed — the same words always make the same art. A hosted image
              model can be dropped in behind this button later.
            </p>
          </Panel>

          <Panel title="Draw">
            <Button
              block
              variant={drawing ? "primary" : "secondary"}
              onClick={() => {
                setDrawing((d) => !d);
                setSelectedId(null);
              }}
            >
              {drawing ? "Done drawing" : "Draw on it"}
            </Button>
            {drawing && (
              <CanvasToolbar
                className="mt-3 border-0 p-0 shadow-none"
                color={color}
                onColor={setColor}
                size={brush}
                onSize={setBrush}
                mode={mode}
                onMode={setMode}
                colors={PALETTE}
                onUndo={() => {
                  canvasRef.current?.undo();
                  setStrokes(canvasRef.current?.getStrokes() ?? []);
                }}
                onClear={() => {
                  canvasRef.current?.clear();
                  setStrokes([]);
                }}
              />
            )}
          </Panel>

          {selected && (
            <Panel title="Selected layer">
              <div className="space-y-3.5">
                {selected.kind === "text" && (
                  <TextField
                    value={selected.text ?? ""}
                    onChange={(e) => updateSelected({ text: e.target.value })}
                    aria-label="Layer text"
                  />
                )}

                <div>
                  <Label className="mb-1.5">Size</Label>
                  <input
                    type="range"
                    min={0.3}
                    max={2.6}
                    step={0.05}
                    value={selected.scale}
                    onChange={(e) => updateSelected({ scale: Number(e.target.value) })}
                    className="w-full accent-[#111114]"
                  />
                </div>
                <div>
                  <Label className="mb-1.5">Rotation</Label>
                  <input
                    type="range"
                    min={-45}
                    max={45}
                    step={1}
                    value={selected.rotation}
                    onChange={(e) => updateSelected({ rotation: Number(e.target.value) })}
                    className="w-full accent-[#111114]"
                  />
                </div>

                {selected.kind !== "image" && (
                  <div>
                    <Label className="mb-1.5">Colour</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {PALETTE.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Colour ${c}`}
                          onClick={() => updateSelected({ color: c })}
                          className={cn(
                            "h-7 w-7 rounded-full border-2 transition-transform",
                            selected.color === c ? "scale-110 border-ink" : "border-line",
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    block
                    variant="soft"
                    onClick={() =>
                      setLayers((current) => [
                        ...current.filter((l) => l.id !== selected.id),
                        selected,
                      ])
                    }
                  >
                    Bring to front
                  </Button>
                  <IconButton
                    label="Delete layer"
                    onClick={() => {
                      setLayers((current) => current.filter((l) => l.id !== selected.id));
                      setSelectedId(null);
                    }}
                  >
                    <IconTrash width={16} height={16} />
                  </IconButton>
                </div>
              </div>
            </Panel>
          )}
        </aside>

        {/* --- canvas + preview --- */}
        <div className="space-y-6">
          <div
            ref={areaRef}
            className="relative aspect-square w-full overflow-hidden rounded-[32px] bg-surface shadow-sm ring-1 ring-inset ring-line"
            style={{ containerType: "inline-size" }}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) setSelectedId(null);
            }}
          >
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              {!hasContent && (
                <p className="max-w-xs px-8 text-center text-[14px] text-ink-faint">
                  Nothing on the print yet. Add words, a shape, a photo — or just draw.
                </p>
              )}
            </div>

            <CanvasEditor
              ref={canvasRef}
              color={color}
              size={brush}
              mode={mode}
              background="rgba(0,0,0,0)"
              disabled={!drawing}
              onStrokeEnd={() => setStrokes(canvasRef.current?.getStrokes() ?? [])}
              className={cn("absolute inset-0", drawing ? "z-20" : "z-0 pointer-events-none")}
            />

            {previewLayers.map((layer) => (
              <div
                key={layer.id}
                onPointerDown={(e) => {
                  if (drawing) return;
                  e.stopPropagation();
                  capturePointer(e.currentTarget, e.pointerId);
                  setDragId(layer.id);
                  setSelectedId(layer.id);
                }}
                onPointerMove={(e) => onDragMove(e, layer)}
                onPointerUp={() => setDragId(null)}
                className={cn(
                  "absolute z-10 touch-none select-none",
                  drawing ? "pointer-events-none" : "cursor-grab",
                  selectedId === layer.id && !drawing && "outline outline-2 outline-offset-4 outline-ink",
                )}
                style={{
                  left: `${layer.x * 100}%`,
                  top: `${layer.y * 100}%`,
                  transform: `translate(-50%,-50%) rotate(${layer.rotation}deg)`,
                }}
              >
                {layer.kind === "text" && (
                  <span
                    className="whitespace-nowrap"
                    style={{ color: layer.color, fontSize: `${9 * layer.scale}cqw` }}
                  >
                    {layer.text}
                  </span>
                )}
                {layer.kind === "image" && layer.dataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={layer.dataUrl}
                    alt="Design element"
                    draggable={false}
                    style={{ width: `${45 * layer.scale}cqw` }}
                  />
                )}
                {layer.kind === "shape" && (
                  <ShapeGlyph shape={layer.shape ?? "circle"} color={layer.color} scale={layer.scale} />
                )}
              </div>
            ))}
          </div>

          <div className="rounded-4xl ring-1 ring-inset ring-line bg-surface p-6 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="t-eyebrow">
                On the shirts
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <ColorRow label="Yours" value={shirtColor.id} onChange={setShirtColor} />
                <ColorRow label="Theirs" value={partnerColor.id} onChange={setPartnerColor} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <ShirtPreview color={shirtColor.hex} layers={previewLayers} strokes={strokes} />
              <ShirtPreview color={partnerColor.hex} layers={previewLayers} strokes={strokes} />
            </div>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <TextField
                value={savedName}
                onChange={(e) => setSavedName(e.target.value)}
                placeholder="Name this design"
                aria-label="Design name"
              />
              <Button size="lg" onClick={save} disabled={!hasContent}>
                Save design
              </Button>
              <Button size="lg" variant="secondary" onClick={download} disabled={!hasContent}>
                Export PNG
              </Button>
            </div>
            {exportNote && (
              <p role="status" className="t-body-sm mt-4">
                {exportNote}
              </p>
            )}
          </div>

          {designs.length > 0 && (
            <div>
              <p className="mb-3 t-eyebrow">
                Saved designs
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {designs.map((design) => (
                  <div
                    key={design.id}
                    className="group relative rounded-[20px] ring-1 ring-inset ring-line bg-surface p-3 shadow-card"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={design.dataUrl}
                      alt={design.name}
                      className="aspect-square w-full rounded-xl bg-surface-muted object-contain"
                    />
                    <p className="mt-2 truncate text-[12.5px] font-semibold text-ink">
                      {design.name}
                    </p>
                    <button
                      type="button"
                      aria-label="Delete design"
                      onClick={() => {
                        deleteDesign(design.id);
                        refreshDesigns();
                      }}
                      className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full ring-1 ring-inset ring-line bg-surface opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <IconClose width={11} height={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Pill tone="info">{layers.length} layers</Pill>
            <Pill>{strokes.length} strokes</Pill>
            <Pill tone="good">Exports at 2400px</Pill>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl ring-1 ring-inset ring-line bg-surface p-5 shadow-sm">
      <p className="mb-3 t-eyebrow">
        {title}
      </p>
      {children}
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (c: (typeof SHIRT_COLORS)[number]) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[12px] font-semibold text-ink-muted">{label}</span>
      {SHIRT_COLORS.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-label={`${label} shirt ${c.label}`}
          onClick={() => onChange(c)}
          className={cn(
            "h-6 w-6 rounded-full border-2 transition-transform",
            value === c.id ? "scale-110 border-ink" : "border-line",
          )}
          style={{ backgroundColor: c.hex }}
        />
      ))}
    </div>
  );
}

function ShapeGlyph({
  shape,
  color,
  scale,
}: {
  shape: ShapeKind;
  color: string;
  scale: number;
}) {
  const size = `${26 * scale}cqw`;
  if (shape === "square") {
    return <span style={{ display: "block", width: size, height: size, background: color }} />;
  }
  if (shape === "ring") {
    return (
      <span
        style={{
          display: "block",
          width: size,
          height: size,
          borderRadius: "999px",
          border: `${3.6 * scale}cqw solid ${color}`,
        }}
      />
    );
  }
  if (shape === "heart") {
    return (
      <svg viewBox="0 0 24 24" style={{ width: size, height: size }} aria-hidden="true">
        <path
          d="M12 21S3.2 15.6 3.2 9.6A4.6 4.6 0 0 1 12 7.6a4.6 4.6 0 0 1 8.8 2c0 6-8.8 11.4-8.8 11.4Z"
          fill={color}
        />
      </svg>
    );
  }
  return (
    <span
      style={{ display: "block", width: size, height: size, borderRadius: "999px", background: color }}
    />
  );
}

function ShirtPreview({
  color,
  layers,
  strokes,
}: {
  color: string;
  layers: Layer[];
  strokes: Stroke[];
}) {
  return (
    <div className="relative">
      <svg viewBox="0 0 200 220" className="w-full" aria-label="Shirt preview">
        <path
          d="M70 18 L40 30 L26 62 L48 74 L52 66 L52 200 A4 4 0 0 0 56 204 L144 204 A4 4 0 0 0 148 200 L148 66 L152 74 L174 62 L160 30 L130 18 A30 30 0 0 1 70 18 Z"
          fill={color}
          stroke="rgba(17,17,20,0.12)"
          strokeWidth="1.5"
        />
        <path d="M70 18 A30 30 0 0 0 130 18" fill="none" stroke="rgba(17,17,20,0.14)" strokeWidth="1.5" />
      </svg>

      <div
        className="absolute overflow-hidden"
        style={{ left: "31%", top: "34%", width: "38%", aspectRatio: "1 / 1", containerType: "inline-size" }}
      >
        <div className="relative h-full w-full">
          <StrokeMini strokes={strokes} />
          {layers.map((layer) => (
            <div
              key={layer.id}
              className="absolute"
              style={{
                left: `${layer.x * 100}%`,
                top: `${layer.y * 100}%`,
                transform: `translate(-50%,-50%) rotate(${layer.rotation}deg)`,
              }}
            >
              {layer.kind === "text" && (
                <span
                  className="whitespace-nowrap"
                  style={{ color: layer.color, fontSize: `${9 * layer.scale}cqw` }}
                >
                  {layer.text}
                </span>
              )}
              {layer.kind === "image" && layer.dataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={layer.dataUrl} alt="" style={{ width: `${45 * layer.scale}cqw` }} />
              )}
              {layer.kind === "shape" && (
                <ShapeGlyph shape={layer.shape ?? "circle"} color={layer.color} scale={layer.scale} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StrokeMini({ strokes }: { strokes: Stroke[] }) {
  if (!strokes.length) return null;
  return (
    <svg viewBox="0 0 1 1" className="absolute inset-0 h-full w-full" aria-hidden="true">
      {strokes.map((stroke) => {
        if (stroke.points.length < 4) return null;
        const d = stroke.points.reduce(
          (acc, value, i) =>
            i % 2 === 0 ? `${acc}${i === 0 ? "M" : "L"}${value} ` : `${acc}${value} `,
          "",
        );
        return (
          <path
            key={stroke.id}
            d={d}
            fill="none"
            stroke={stroke.mode === "eraser" ? "transparent" : stroke.color}
            strokeWidth={stroke.size}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}

function drawHeart(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(0, r * 0.75);
  ctx.bezierCurveTo(-r * 1.4, -r * 0.2, -r * 0.55, -r * 1.15, 0, -r * 0.42);
  ctx.bezierCurveTo(r * 0.55, -r * 1.15, r * 1.4, -r * 0.2, 0, r * 0.75);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load that image."));
    img.src = src;
  });
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameShell } from "@/components/games/game-shell";
import { Button, IconButton } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { TextField } from "@/components/ui/field";
import { IconClose, IconDownload, IconPlus } from "@/components/ui/icons";
import { useRoom, useRoomEvent, useSharedState } from "@/components/room/room-provider";
import {
  BOARD_TEMPLATES,
  VISION_KINDS,
  VISION_STARTERS,
  type VisionKind,
} from "@/lib/games/content/vision-board";
import { fileToDataUrl } from "@/lib/media/use-camera";
import { describeOutcome, exportImage } from "@/lib/media/export-image";
import { saveMemory } from "@/lib/store";
import { useRecordCompletion } from "@/lib/store/use-completion";
import { capturePointer, clamp, plural, uid } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface VisionItem {
  id: string;
  kind: VisionKind;
  text: string;
  dataUrl?: string;
  /** Normalised board position (0–1) so it lands the same on any screen. */
  x: number;
  y: number;
  by: string;
  createdAt: number;
}

interface VisionData {
  items: Record<string, VisionItem>;
}

const DEFAULTS: VisionData = { items: {} };

export function OurFuture() {
  const { state, identity, players, broadcast } = useRoom();
  const [data, setData] = useSharedState<VisionData>("vision", DEFAULTS);
  const [kind, setKind] = useState<VisionKind>("goal");
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [ghosts, setGhosts] = useState<Record<string, { x: number; y: number }>>({});
  const boardRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastBroadcast = useRef(0);

  // Live drag positions from the other side, before they commit.
  useRoomEvent<{ id: string; x: number; y: number; by: string }>("vision:move", (payload) => {
    if (payload.by === identity.id) return;
    setGhosts((g) => ({ ...g, [payload.id]: { x: payload.x, y: payload.y } }));
  });

  const items = Object.values(data.items).sort((a, b) => a.createdAt - b.createdAt);

  const addItem = useCallback(
    (value: string, itemKind: VisionKind, dataUrl?: string) => {
      const trimmed = value.trim();
      if (!trimmed && !dataUrl) return;
      const id = uid("vi_");
      const count = Object.keys(data.items).length;
      void setData((c) => ({
        items: {
          ...c.items,
          [id]: {
            id,
            kind: itemKind,
            text: trimmed,
            dataUrl,
            // Lay new cards out on a loose grid rather than stacking them.
            x: 0.12 + ((count * 0.23) % 0.62),
            y: 0.14 + ((Math.floor(count / 3) * 0.2) % 0.62),
            by: identity.id,
            createdAt: Date.now(),
          },
        },
      }));
      setText("");
    },
    [data.items, identity.id, setData],
  );

  /** Drops a whole template onto the board in a loose grid. */
  function applyTemplate(templateId: string) {
    const template = BOARD_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    const base = Object.keys(data.items).length;
    const additions: Record<string, VisionItem> = {};
    template.cards.forEach((card, i) => {
      const id = uid("vi_");
      const n = base + i;
      additions[id] = {
        id,
        kind: card.kind,
        text: card.text,
        x: 0.16 + ((n % 3) * 0.28),
        y: 0.16 + (Math.floor(n / 3) % 3) * 0.28,
        by: identity.id,
        createdAt: Date.now() + i,
      };
    });
    void setData((c) => ({ items: { ...c.items, ...additions } }));
  }

  function removeItem(id: string) {
    void setData((c) => {
      const next = { ...c.items };
      delete next[id];
      return { items: next };
    });
  }

  const broadcastMove = useCallback(
    (id: string, x: number, y: number) => broadcast("vision:move", { id, x, y, by: identity.id }),
    [broadcast, identity.id],
  );

  function startDrag(e: React.PointerEvent, item: VisionItem) {
    capturePointer(e.currentTarget, e.pointerId);
    setDragging(item.id);
  }

  function onDrag(e: React.PointerEvent, item: VisionItem) {
    if (dragging !== item.id) return;
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0.03, 0.97);
    const y = clamp((e.clientY - rect.top) / rect.height, 0.03, 0.97);
    setGhosts((g) => ({ ...g, [item.id]: { x, y } }));

    const now = Date.now();
    if (now - lastBroadcast.current > 60) {
      lastBroadcast.current = now;
      void broadcastMove(item.id, x, y);
    }
  }

  function endDrag(item: VisionItem) {
    if (dragging !== item.id) return;
    const ghost = ghosts[item.id];
    setDragging(null);
    if (!ghost) return;
    void setData((c) => ({
      items: { ...c.items, [item.id]: { ...c.items[item.id], x: ghost.x, y: ghost.y } },
    }));
  }

  // Counts once the board actually has something on it.
  useRecordCompletion("our-future", items.length >= 3, state?.seed ?? "session");

  async function exportBoard() {
    const board = boardRef.current;
    if (!board) return;
    const width = 1400;
    const height = Math.round(width * 0.66);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#fbfbf9";
    ctx.fillRect(0, 0, width, height);

    items.forEach((item) => {
      const meta = VISION_KINDS.find((k) => k.id === item.kind)!;
      const cardW = width * 0.24;
      const cardH = height * 0.16;
      const x = item.x * width - cardW / 2;
      const y = item.y * height - cardH / 2;

      ctx.fillStyle = meta.tint;
      ctx.beginPath();
      const r = 18;
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + cardW, y, x + cardW, y + cardH, r);
      ctx.arcTo(x + cardW, y + cardH, x, y + cardH, r);
      ctx.arcTo(x, y + cardH, x, y, r);
      ctx.arcTo(x, y, x + cardW, y, r);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#74747f";
      ctx.font = `700 13px -apple-system, "Segoe UI", Inter, sans-serif`;
      ctx.fillText(meta.label.toUpperCase(), x + 16, y + 26);

      ctx.fillStyle = "#111114";
      ctx.font = `700 17px -apple-system, "Segoe UI", Inter, sans-serif`;
      wrapText(ctx, item.text || meta.label, x + 16, y + 50, cardW - 32, 21);
    });

    const url = canvas.toDataURL("image/png");
    saveMemory({
      experienceId: "our-future",
      title: "Our Future",
      detail: `${plural(items.length, "thing")} on the board.`,
      dataUrl: url,
    });
    setSaved(true);

    setExportNote(
      describeOutcome(await exportImage(url, "together-our-future.png", { title: "Our future" }), "board"),
    );
  }

  return (
    <GameShell
      title="Our Future"
      width="wide"
      hint="Everything here is shared live. Drag things anywhere."
      actions={
        <IconButton label="Export the board" onClick={exportBoard}>
          <IconDownload width={17} height={17} />
        </IconButton>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-36 lg:self-start">
          <div className="rounded-3xl ring-1 ring-inset ring-line bg-surface p-5 shadow-sm">
            <p className="mb-3 t-eyebrow">
              Add to the board
            </p>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {VISION_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  className={cn(
                    "rounded-pill px-3.5 py-2 text-[12.5px] font-bold transition-all duration-200 ease-out",
                    kind === k.id
                      ? "bg-ink text-ink-inverse shadow-sm"
                      : "bg-surface-muted text-ink-muted hover:text-ink",
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>

            {kind === "image" ? (
              <>
                <Button
                  block
                  variant="secondary"
                  onClick={() => fileRef.current?.click()}
                >
                  Choose an image
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
                    addItem(file.name.replace(/\.[^.]+$/, ""), "image", await fileToDataUrl(file, 900));
                  }}
                />
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addItem(text, kind);
                }}
                className="space-y-2.5"
              >
                <TextField
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={VISION_KINDS.find((k) => k.id === kind)?.placeholder}
                  aria-label="New board item"
                />
                <Button block type="submit" disabled={!text.trim()}>
                  <IconPlus width={15} height={15} /> Add it
                </Button>
              </form>
            )}
          </div>

          <div className="rounded-3xl ring-1 ring-inset ring-line bg-surface p-5 shadow-sm">
            <p className="mb-3 t-eyebrow">
              Stuck? Try one
            </p>
            <div className="flex flex-wrap gap-1.5">
              {VISION_STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => addItem(starter, kind === "image" ? "goal" : kind)}
                  className="rounded-pill bg-surface-muted px-3.5 py-2 text-[12.5px] font-semibold text-ink-muted transition-all duration-200 ease-out hover:-translate-y-[1px] hover:bg-surface hover:text-ink hover:shadow-xs hover:ring-1 hover:ring-inset hover:ring-line"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Pill tone="info">{items.length} on the board</Pill>
            {players.map((p) => (
              <Pill key={p.id}>
                {p.emoji} {p.id === identity.id ? "You" : p.name}
              </Pill>
            ))}
          </div>

          <Button block variant="secondary" onClick={exportBoard}>
            {saved ? "Saved to your story" : "Save & export"}
          </Button>
          {exportNote && (
            <p role="status" className="t-body-sm mt-3">
              {exportNote}
            </p>
          )}
        </aside>

        <div
          ref={boardRef}
          className="paper relative min-h-[520px] overflow-hidden rounded-[32px] shadow-sm ring-1 ring-inset ring-line sm:min-h-[720px]"
        >
          {items.length === 0 && (
            <div className="absolute inset-0 grid place-items-center p-8 text-center">
              <div>
                <p className="t-h2 text-ink">A completely blank future</p>
                <p className="t-body mx-auto mt-4 max-w-[34ch]">
                  Add a goal, a place, a date — anything you keep half-saying. They&rsquo;ll see it
                  appear.
                </p>
              </div>
            </div>
          )}

          {items.map((item) => {
            const meta = VISION_KINDS.find((k) => k.id === item.kind)!;
            const pos = ghosts[item.id] ?? { x: item.x, y: item.y };
            const mine = item.by === identity.id;
            return (
              <div
                key={item.id}
                onPointerDown={(e) => startDrag(e, item)}
                onPointerMove={(e) => onDrag(e, item)}
                onPointerUp={() => endDrag(item)}
                onPointerCancel={() => endDrag(item)}
                className={cn(
                  "group absolute w-[168px] touch-none select-none rounded-[20px] ring-1 ring-inset ring-line bg-surface p-3.5 shadow-card transition-shadow sm:w-[196px]",
                  dragging === item.id ? "z-20 cursor-grabbing shadow-pop" : "cursor-grab",
                )}
                style={{
                  left: `${pos.x * 100}%`,
                  top: `${pos.y * 100}%`,
                  transform: "translate(-50%,-50%)",
                  backgroundColor: meta.tint,
                }}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="t-eyebrow" style={{ color: meta.accent }}>
                    {meta.label}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => removeItem(item.id)}
                    className="grid h-5 w-5 place-items-center rounded-md text-ink-faint opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
                  >
                    <IconClose width={11} height={11} />
                  </button>
                </div>
                {item.dataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.dataUrl}
                    alt={item.text}
                    draggable={false}
                    className="mb-2 aspect-[4/3] w-full rounded-lg object-cover"
                  />
                )}
                {item.text && (
                  <p className="text-[14.5px] font-bold leading-[1.32] tracking-[-0.018em] text-ink">
                    {item.text}
                  </p>
                )}
                <p className="mt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                  {mine ? "you" : state?.players[item.by]?.name ?? "them"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </GameShell>
  );
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeading, PageShell } from "@/components/layout/page-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { Label, TextArea, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { IconClose } from "@/components/ui/icons";
import {
  addScrapbookItem,
  deleteScrapbookItem,
  deleteStrip,
  listScrapbook,
  listStrips,
  updateScrapbookItem,
} from "@/lib/store";
import type { ScrapbookItem, StoredPhotoStrip } from "@/lib/store/types";
import { describeOutcome, exportImage } from "@/lib/media/export-image";
import { useStoreList } from "@/lib/store/use-store";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Scrapbook() {
  const [items, refreshItems] = useStoreList<ScrapbookItem>(listScrapbook);
  const [strips, refreshStrips] = useStoreList<StoredPhotoStrip>(listStrips);
  const [editing, setEditing] = useState<ScrapbookItem | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  const unpasted = strips.filter(
    (strip) => !items.some((item) => item.dataUrl === strip.dataUrl),
  );

  function addNote() {
    if (!noteTitle.trim()) return;
    addScrapbookItem({
      kind: "note",
      title: noteTitle.trim(),
      caption: noteBody.trim(),
      date: new Date().toISOString().slice(0, 10),
    });
    setNoteTitle("");
    setNoteBody("");
    setNoteOpen(false);
    refreshItems();
  }

  return (
    <PageShell className="pb-24 pt-10 sm:pt-14">
      <PageHeading
        eyebrow="Digital Scrapbook"
        title={
          <>
            Your strips, on <span className="t-serif">paper</span>
          </>
        }
        subtitle="Taped down, written on, dated. Everything you keep from the photobooth or a game lands here."
        actions={
          <>
            <Button variant="secondary" onClick={() => setNoteOpen(true)}>
              Write a note
            </Button>
            <ButtonLink href="/photobooth">New strip</ButtonLink>
          </>
        }
      />

      {unpasted.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-baseline justify-between">
            <p className="t-eyebrow">
              Strips not in the book yet
            </p>
            <Pill tone="warn">{unpasted.length}</Pill>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-3 scroll-slim">
            {unpasted.map((strip) => (
              <div key={strip.id} className="w-[150px] shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={strip.dataUrl}
                  alt="Photo strip"
                  className="w-full rounded-[20px] ring-1 ring-inset ring-line shadow-card"
                />
                <div className="mt-2.5 flex gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => {
                      addScrapbookItem({
                        kind: "strip",
                        dataUrl: strip.dataUrl,
                        title: strip.caption || "Photobooth",
                        caption: "",
                        date: strip.createdAt.slice(0, 10),
                      });
                      refreshItems();
                    }}
                  >
                    Tape it in
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      deleteStrip(strip.id);
                      refreshStrips();
                    }}
                  >
                    Bin
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {items.length === 0 ? (
        <div className="mt-12 rounded-[32px] border-[1.5px] border-dashed border-line-strong p-14 text-center">
          <p className="t-h2 text-ink">Nothing in the book yet</p>
          <p className="t-body mx-auto mt-4 max-w-[42ch]">
            Make a strip in the photobooth, or finish a drawing together — anything you keep gets
            taped in here with room for a caption.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/photobooth">Open the photobooth</ButtonLink>
            <ButtonLink href="/play/draw-together" variant="secondary">
              Draw something
            </ButtonLink>
          </div>
        </div>
      ) : (
        <div className="paper mt-10 rounded-4xl ring-1 ring-inset ring-line bg-surface p-6 shadow-sm sm:p-10">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <figure
                key={item.id}
                className="group relative"
                style={{ transform: `rotate(${item.tilt}deg)` }}
              >
                <span
                  className="tape absolute -top-3.5 left-1/2 h-7 w-24 -translate-x-1/2 rotate-[-2.4deg] rounded-[2px]"
                  aria-hidden="true"
                />
                <div className="rounded-[20px] ring-1 ring-inset ring-line bg-white p-3 shadow-card transition-transform duration-300 group-hover:-translate-y-1">
                  {item.dataUrl ? (
                    <button
                      type="button"
                      onClick={() => setLightbox(item.dataUrl!)}
                      className="block w-full"
                    >
                      {/* A strip is tall and narrow; letting it fill the column
                          would swallow the page, so it sits centred at its own
                          natural width like something actually stuck down. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.dataUrl}
                        alt={item.title}
                        className={cn(
                          "rounded-[10px] object-cover",
                          item.kind === "strip"
                            ? "mx-auto w-full max-w-[172px]"
                            : item.kind === "drawing"
                              ? "aspect-[4/3] w-full bg-surface-muted object-contain"
                              : "aspect-[4/3] w-full",
                        )}
                      />
                    </button>
                  ) : (
                    <div className="rounded-[14px] bg-butter-tint p-6">
                      <p className="text-[16px] font-extrabold tracking-[-0.025em] text-ink">
                        {item.title}
                      </p>
                      {item.caption && (
                        <p className="mt-2.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-soft">
                          {item.caption}
                        </p>
                      )}
                    </div>
                  )}

                  <figcaption className="mt-3 px-1">
                    {item.dataUrl && (
                      <p className="text-[14.5px] font-bold tracking-[-0.02em] text-ink">{item.title}</p>
                    )}
                    {item.dataUrl && item.caption && (
                      <p className="t-caption mt-1">{item.caption}</p>
                    )}
                    <p className="t-eyebrow mt-2.5">{formatDate(item.date)}</p>
                  </figcaption>
                </div>

                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setEditing(item)}
                    className="rounded-lg ring-1 ring-inset ring-line bg-surface px-2 py-1 text-[11px] font-bold text-ink shadow-sm"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => {
                      deleteScrapbookItem(item.id);
                      refreshItems();
                    }}
                    className="grid h-[26px] w-[26px] place-items-center rounded-lg ring-1 ring-inset ring-line bg-surface text-ink shadow-sm"
                  >
                    <IconClose width={11} height={11} />
                  </button>
                </div>
              </figure>
            ))}
          </div>
        </div>
      )}

      <p className="t-caption mt-12 text-center">
        Kept on this device.{" "}
        <Link href="/about" className="font-semibold underline underline-offset-4 hover:text-ink">
          How storage works
        </Link>
      </p>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Write on it"
        footer={
          <>
            {editing?.dataUrl && (
              <Button
                variant="ghost"
                onClick={() =>
                  void exportImage(editing.dataUrl!, `${editing.title || "memory"}.png`, {
                    title: editing.title || "A memory",
                  }).then((outcome) => setExportNote(describeOutcome(outcome)))
                }
              >
                Download
              </Button>
            )}
            {exportNote && (
              <span role="status" className="t-caption mr-auto max-w-[26ch] text-left">
                {exportNote}
              </span>
            )}
            <Button
              onClick={() => {
                if (editing) {
                  updateScrapbookItem(editing.id, {
                    title: editing.title,
                    caption: editing.caption,
                    date: editing.date,
                  });
                  refreshItems();
                }
                setEditing(null);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="stitle">Title</Label>
              <TextField
                id="stitle"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="scaption">Caption</Label>
              <TextArea
                id="scaption"
                rows={4}
                value={editing.caption}
                onChange={(e) => setEditing({ ...editing, caption: e.target.value })}
                placeholder="What was actually happening here"
              />
            </div>
            <div>
              <Label htmlFor="sdate">Date</Label>
              <TextField
                id="sdate"
                type="date"
                value={editing.date}
                onChange={(e) => setEditing({ ...editing, date: e.target.value })}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Write a note"
        description="No photo, just something you want to keep."
        footer={
          <>
            <Button variant="ghost" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addNote} disabled={!noteTitle.trim()}>
              Stick it in
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="ntitle">Title</Label>
            <TextField
              id="ntitle"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Tuesday, the good one"
            />
          </div>
          <div>
            <Label htmlFor="nbody">Note</Label>
            <TextArea
              id="nbody"
              rows={5}
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgba(17,17,20,0.8)] p-6"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Scrapbook item"
            className="max-h-[88vh] max-w-full rounded-3xl object-contain"
          />
        </div>
      )}
    </PageShell>
  );
}

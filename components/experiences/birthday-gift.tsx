"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PageHeading, PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { Label, TextArea, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { IconClose, IconPlus } from "@/components/ui/icons";
import { QrCode } from "@/components/shared/qr-code";
import { ArtBirthdayGift } from "@/components/art/scenes";
import { GIFT_TEMPLATES } from "@/lib/games/content/gift-templates";
import { describeOutcome, exportImage } from "@/lib/media/export-image";
import { encodeGift } from "@/lib/gift-link";
import { fileToDataUrl } from "@/lib/media/use-camera";
import { deleteGift, listGifts, recordCompletion, saveGift } from "@/lib/store";
import type { GiftPage } from "@/lib/store/types";
import { useStoreList } from "@/lib/store/use-store";
import { copyText, formatDate, plural, relativeFromNow, siteOrigin, uid } from "@/lib/utils";

function defaultReveal() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function BirthdayGift() {
  const [gifts, refresh] = useStoreList<GiftPage>(listGifts);
  const [building, setBuilding] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [shared, setShared] = useState<GiftPage | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [recipient, setRecipient] = useState("");
  const [sender, setSender] = useState("");
  const [message, setMessage] = useState("");
  const [revealOn, setRevealOn] = useState(defaultReveal());
  const [photos, setPhotos] = useState<string[]>([]);
  const [memories, setMemories] = useState<GiftPage["memories"]>([]);
  const [memTitle, setMemTitle] = useState("");
  const [memDetail, setMemDetail] = useState("");

  const link = shared
    ? `${siteOrigin()}/gift/${shared.id}#${encodeGift(shared).hash}`
    : "";
  const photosInLink = shared ? encodeGift(shared).photosIncluded : true;

  function reset() {
    setTitle("");
    setRecipient("");
    setSender("");
    setMessage("");
    setRevealOn(defaultReveal());
    setPhotos([]);
    setMemories([]);
  }

  function create() {
    if (!title.trim() || !message.trim()) return;
    const gift = saveGift({
      title: title.trim(),
      recipient: recipient.trim() || "You",
      sender: sender.trim() || "Me",
      message: message.trim(),
      revealOn,
      photos,
      memories,
    });
    recordCompletion("birthday-gift");
    reset();
    setBuilding(false);
    setShared(gift);
    refresh();
  }

  return (
    <PageShell width="reading" className="pb-24 pt-10 sm:pt-14">
      <PageHeading
        align="center"
        eyebrow="Birthday Gift"
        title={
          <>
            A page that&rsquo;s only <span className="t-serif">theirs</span>
          </>
        }
        subtitle="Photos, memories and a message, sealed until the date you pick — then opened by scanning a heart."
        actions={
          <Button size="lg" onClick={() => setBuilding(true)}>
            Build a gift
          </Button>
        }
      />

      {gifts.length === 0 && (
        <div className="mt-14 rounded-[36px] border-[1.5px] border-dashed border-line-strong p-12 text-center sm:p-16">
          <div className="mx-auto mb-7 w-[168px]">
            <ArtBirthdayGift className="a-drift h-auto w-full" />
          </div>
          <p className="t-h2 text-ink">Nothing wrapped yet</p>
          <p className="t-body mx-auto mt-4 max-w-[36ch]">
            Build one, then print or send the QR. It opens on their phone, not yours.
          </p>
          <Button size="lg" className="mt-8" onClick={() => setBuilding(true)}>
            Start one
          </Button>
        </div>
      )}

      {gifts.length > 0 && (
        <div className="mt-9 space-y-3">
          {gifts.map((gift) => (
            <div
              key={gift.id}
              className="group flex items-start gap-4 rounded-3xl ring-1 ring-inset ring-line bg-surface p-5 shadow-sm transition-all hover:shadow-card-hover"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blush-tint text-[18px]">
                🎁
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-ink">{gift.title}</p>
                <p className="mt-1 text-[13px] text-ink-muted">
                  For {gift.recipient} · {plural(gift.photos.length, "photo")} ·{" "}
                  {plural(gift.memories.length, "memory", "memories")}
                </p>
                <p className="mt-1.5 text-[12.5px] font-semibold text-ink-faint">
                  Opens {formatDate(gift.revealOn)} — {relativeFromNow(gift.revealOn)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Button size="sm" onClick={() => setShared(gift)}>
                  Share
                </Button>
                <Link
                  href={`/gift/${gift.id}`}
                  className="text-[12px] font-semibold text-ink-muted hover:text-ink"
                >
                  Preview
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    deleteGift(gift.id);
                    refresh();
                  }}
                  className="text-[12px] font-semibold text-ink-faint opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- builder --- */}
      <Modal
        open={building}
        onClose={() => setBuilding(false)}
        title="Build the gift"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setBuilding(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={!title.trim() || !message.trim()}>
              Wrap it up
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <Label>Start from a template</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {GIFT_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    setTitle(template.giftTitle);
                    setMessage(template.message);
                    setMemories(
                      template.memories.map((m) => ({ id: uid("mm_"), title: m.title, detail: m.detail })),
                    );
                  }}
                  className="rounded-[16px] bg-surface-muted px-4 py-3 text-left transition-all duration-200 ease-out hover:-translate-y-[1px] hover:bg-surface hover:shadow-xs hover:ring-1 hover:ring-inset hover:ring-line"
                >
                  <span className="block text-[13.5px] font-bold tracking-[-0.018em] text-ink">
                    {template.title}
                  </span>
                  <span className="t-caption block">{template.blurb}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="gtitle">Title</Label>
            <TextField
              id="gtitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Happy birthday"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="grecipient">For</Label>
              <TextField
                id="grecipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Their name"
              />
            </div>
            <div>
              <Label htmlFor="gsender">From</Label>
              <TextField
                id="gsender"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="Your name"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="gmessage">The message</Label>
            <TextArea
              id="gmessage"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="The thing you'd say out loud if it weren't so awkward to say out loud."
            />
          </div>

          <div>
            <Label>Photos</Label>
            <div className="flex flex-wrap gap-2.5">
              {photos.map((photo, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt={`Gift photo ${i + 1}`}
                    className="h-20 w-20 rounded-sm ring-1 ring-inset ring-line object-cover"
                  />
                  <button
                    type="button"
                    aria-label="Remove photo"
                    onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full ring-1 ring-inset ring-line bg-surface text-ink shadow-sm"
                  >
                    <IconClose width={11} height={11} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="grid h-20 w-20 place-items-center rounded-xl border-[1.5px] border-dashed border-line-strong text-ink-faint transition-colors hover:border-ink hover:text-ink"
              >
                <IconPlus width={18} height={18} />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  const urls = await Promise.all(files.map((f) => fileToDataUrl(f, 1000)));
                  setPhotos((p) => [...p, ...urls].slice(0, 8));
                }}
              />
            </div>
          </div>

          <div>
            <Label>Memories</Label>
            <div className="space-y-2">
              {memories.map((memory) => (
                <div
                  key={memory.id}
                  className="flex items-start gap-3 rounded-2xl bg-surface-muted p-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold text-ink">{memory.title}</p>
                    <p className="text-[12.5px] text-ink-muted">{memory.detail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMemories((m) => m.filter((x) => x.id !== memory.id))}
                    className="text-[12px] font-semibold text-ink-faint hover:text-ink"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
              <TextField
                value={memTitle}
                onChange={(e) => setMemTitle(e.target.value)}
                placeholder="That night in the rain"
                aria-label="Memory title"
              />
              <TextField
                value={memDetail}
                onChange={(e) => setMemDetail(e.target.value)}
                placeholder="Why it mattered"
                aria-label="Memory detail"
              />
              <Button
                variant="secondary"
                disabled={!memTitle.trim()}
                onClick={() => {
                  setMemories((m) => [
                    ...m,
                    { id: uid("mm_"), title: memTitle.trim(), detail: memDetail.trim() },
                  ]);
                  setMemTitle("");
                  setMemDetail("");
                }}
              >
                Add
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="greveal">Opens on</Label>
            <TextField
              id="greveal"
              type="date"
              value={revealOn}
              onChange={(e) => setRevealOn(e.target.value)}
            />
            <p className="mt-2 text-[12.5px] text-ink-faint">
              Sealed until then — {relativeFromNow(revealOn)}.
            </p>
          </div>
        </div>
      </Modal>

      {/* --- share --- */}
      <Modal
        open={Boolean(shared)}
        onClose={() => {
          setShared(null);
          setCopied(false);
        }}
        title="Sealed in a heart"
        description="Scan it, print it, text it. The whole gift travels inside the link."
        size="sm"
      >
        {shared && (
          <div className="flex flex-col items-center gap-5">
            <QrCode value={link} size={220} heart onReady={setQrDataUrl} />
            <Pill tone={photosInLink ? "good" : "warn"}>
              {photosInLink
                ? "Photos travel with the link"
                : "Too many photos for the link — they stay on this device"}
            </Pill>
            <div className="w-full space-y-2.5">
              <Button
                block
                size="lg"
                onClick={async () => {
                  if (await copyText(link)) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  }
                }}
              >
                {copied ? "Link copied" : "Copy the link"}
              </Button>
              <div className="flex gap-2.5">
                <Button
                  block
                  variant="secondary"
                  disabled={!qrDataUrl}
                  onClick={() =>
                    qrDataUrl &&
                    void exportImage(qrDataUrl, "gift-qr.png", { title: "Gift QR code" }).then(
                      (outcome) => setExportNote(describeOutcome(outcome, "code")),
                    )
                  }
                >
                  Download QR
                </Button>
                <Button block variant="soft" onClick={() => window.open(`/gift/${shared.id}`, "_blank")}>
                  Preview
                </Button>
              </div>
              {exportNote && (
                <p role="status" className="t-body-sm mt-3">
                  {exportNote}
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </PageShell>
  );
}

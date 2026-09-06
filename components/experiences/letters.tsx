"use client";

import { useMemo, useState } from "react";
import { PageHeading, PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { Label, TextArea, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { IconLock } from "@/components/ui/icons";
import { ArtLetters } from "@/components/art/scenes";
import { LETTER_PROMPTS } from "@/lib/games/content/letters";
import {
  deleteLetter,
  isDeliverable,
  listLetters,
  openLetter,
  recordCompletion,
  saveLetter,
} from "@/lib/store";
import type { Letter } from "@/lib/store/types";
import { useStoreList } from "@/lib/store/use-store";
import { formatDate, relativeFromNow } from "@/lib/utils";
import { cn } from "@/lib/utils";

const EMAIL_CONFIGURED = false; // Flips on when EMAIL_PROVIDER_API_KEY is wired up.

function defaultDate(yearsAhead = 1) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + yearsAhead);
  return d.toISOString().slice(0, 10);
}

export function Letters() {
  const [letters, refresh] = useStoreList<Letter>(listLetters);
  const [composing, setComposing] = useState(false);
  const [reading, setReading] = useState<Letter | null>(null);

  const [to, setTo] = useState("");
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [deliverOn, setDeliverOn] = useState(defaultDate());

  const { sealed, ready } = useMemo(
    () => ({
      sealed: letters.filter((l) => !isDeliverable(l)),
      ready: letters.filter(isDeliverable),
    }),
    [letters],
  );

  function send() {
    if (!body.trim() || !to.trim()) return;
    saveLetter({
      to: to.trim(),
      from: from.trim() || "Me",
      subject: subject.trim() || "A letter",
      body: body.trim(),
      deliverOn,
    });
    recordCompletion("letters");
    setTo("");
    setFrom("");
    setSubject("");
    setBody("");
    setDeliverOn(defaultDate());
    setComposing(false);
    refresh();
  }

  return (
    <PageShell width="reading" className="pb-24 pt-10 sm:pt-14">
      <PageHeading
        eyebrow="Letters"
        title={
          <>
            Write now, opened <span className="t-serif">later</span>
          </>
        }
        align="center"
        subtitle="Seal something and pick the day it opens. Until then it stays shut — even to you."
        actions={
          <Button size="lg" onClick={() => setComposing(true)}>
            Write a letter
          </Button>
        }
      />

      {letters.length === 0 && (
        <div className="mt-12 rounded-[36px] border-[1.5px] border-dashed border-line-strong p-12 text-center sm:p-16">
          <div className="mx-auto mb-7 w-[172px]">
            <ArtLetters className="a-drift h-auto w-full" />
          </div>
          <p className="t-h2 text-ink">No letters yet</p>
          <p className="t-body mx-auto mt-4 max-w-[36ch]">
            The first one is usually the hardest. Try writing to them a year from today.
          </p>
          <Button size="lg" className="mt-8" onClick={() => setComposing(true)}>
            Write the first one
          </Button>
        </div>
      )}

      {ready.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-baseline justify-between">
            <p className="t-eyebrow">
              Ready to open
            </p>
            <Pill tone="good">{ready.length}</Pill>
          </div>
          <div className="space-y-3">
            {ready.map((letter) => (
              <LetterCard
                key={letter.id}
                letter={letter}
                onOpen={() => {
                  openLetter(letter.id);
                  setReading(letter);
                  refresh();
                }}
                onDelete={() => {
                  deleteLetter(letter.id);
                  refresh();
                }}
              />
            ))}
          </div>
        </section>
      )}

      {sealed.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-baseline justify-between">
            <p className="t-eyebrow">
              Sealed
            </p>
            <Pill>{sealed.length}</Pill>
          </div>
          <div className="space-y-3">
            {sealed.map((letter) => (
              <LetterCard
                key={letter.id}
                letter={letter}
                onDelete={() => {
                  deleteLetter(letter.id);
                  refresh();
                }}
              />
            ))}
          </div>
        </section>
      )}

      <p className="t-caption mx-auto mt-16 max-w-[52ch] text-center leading-relaxed">
        {EMAIL_CONFIGURED
          ? "Letters are emailed on their delivery date."
          : "No email provider is configured, so nothing is sent anywhere — letters are kept on this device and unseal themselves here on the date you choose."}
      </p>

      <Modal
        open={composing}
        onClose={() => setComposing(false)}
        title="Write a letter"
        description="It gets sealed the moment you send it."
        footer={
          <>
            <Button variant="ghost" onClick={() => setComposing(false)}>
              Cancel
            </Button>
            <Button onClick={send} disabled={!to.trim() || !body.trim()}>
              Seal it
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* the blank page is why letters don't get written */}
          <div>
            <Label>Start from a prompt</Label>
            <div className="flex flex-wrap gap-1.5">
              {LETTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  onClick={() => {
                    setSubject(prompt.label);
                    setBody(prompt.opener);
                    const d = new Date();
                    d.setFullYear(d.getFullYear() + prompt.years);
                    setDeliverOn(d.toISOString().slice(0, 10));
                  }}
                  className="rounded-pill bg-surface-muted px-3.5 py-2 text-[12.5px] font-semibold text-ink-muted transition-all duration-200 ease-out hover:-translate-y-[1px] hover:bg-surface hover:text-ink hover:shadow-xs hover:ring-1 hover:ring-inset hover:ring-line"
                >
                  {prompt.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setSubject("");
                  setBody("");
                }}
                className="rounded-pill px-3.5 py-2 text-[12.5px] font-bold text-ink-faint transition-colors hover:text-ink"
              >
                Blank page
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="to">To</Label>
              <TextField
                id="to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="Their name"
              />
            </div>
            <div>
              <Label htmlFor="from">From</Label>
              <TextField
                id="from"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="Your name"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="subject">Subject</Label>
            <TextField
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Read this when you're 30"
            />
          </div>
          <div>
            <Label htmlFor="body">The letter</Label>
            <TextArea
              id="body"
              rows={9}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write it like they'll read it years from now — because they will."
            />
          </div>
          <div>
            <Label htmlFor="deliver">Deliver on</Label>
            <TextField
              id="deliver"
              type="date"
              value={deliverOn}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDeliverOn(e.target.value)}
            />
            <p className="mt-2 text-[12.5px] text-ink-faint">
              Opens {relativeFromNow(deliverOn)}.
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(reading)}
        onClose={() => setReading(null)}
        title={reading?.subject}
        description={reading ? `To ${reading.to}, from ${reading.from}` : undefined}
      >
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">
          {reading?.body}
        </p>
        <p className="mt-6 text-[12.5px] text-ink-faint">
          Written {reading ? formatDate(reading.createdAt) : ""}.
        </p>
      </Modal>
    </PageShell>
  );
}

function LetterCard({
  letter,
  onOpen,
  onDelete,
}: {
  letter: Letter;
  onOpen?: () => void;
  onDelete: () => void;
}) {
  const sealed = !isDeliverable(letter);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-3xl ring-1 ring-inset ring-line p-5 shadow-sm transition-all",
        sealed ? "bg-surface-muted" : "bg-surface hover:shadow-card-hover",
      )}
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-2xl",
            sealed ? "bg-lilac-tint" : "bg-mint-tint",
          )}
        >
          {sealed ? (
            <IconLock width={19} height={19} className="text-ink" />
          ) : (
            <span className="text-[18px]">✉️</span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-extrabold tracking-[-0.025em] text-ink">{letter.subject}</p>
          <p className="t-body-sm mt-1.5">
            To {letter.to} · from {letter.from}
          </p>
          <p className="t-caption mt-2 font-semibold">
            {sealed
              ? `Opens ${formatDate(letter.deliverOn)} — ${relativeFromNow(letter.deliverOn)}`
              : letter.openedAt
                ? `Opened ${formatDate(letter.openedAt)}`
                : `Ready since ${formatDate(letter.deliverOn)}`}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {!sealed && onOpen && (
            <Button size="sm" onClick={onOpen}>
              {letter.openedAt ? "Read again" : "Open"}
            </Button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="text-[12px] font-semibold text-ink-faint opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
          >
            Delete
          </button>
        </div>
      </div>

      {sealed && (
        <p className="mt-4 rounded-2xl bg-surface px-4 py-3 text-[13px] italic text-ink-faint">
          Sealed. The words stay hidden until the date arrives.
        </p>
      )}
    </div>
  );
}

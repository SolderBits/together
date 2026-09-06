"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeading, PageShell } from "@/components/layout/page-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { Label, TextArea, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { IconClose, IconPlus } from "@/components/ui/icons";
import { ConnectionTree } from "@/components/hub/connection-tree";
import { TREE_STAGES, computeTreeProgress } from "@/lib/games/connection-tree";
import { listStrips } from "@/lib/store";
import { EXPERIENCES, getExperience } from "@/lib/experiences";
import {
  addGoal,
  deleteGoal,
  deleteMemory,
  getCouple,
  isDeliverable,
  listCompletions,
  listGoals,
  listLetters,
  listMemories,
  listScrapbook,
  saveCouple,
  toggleGoal,
} from "@/lib/store";
import type {
  CoupleProfile,
  Goal,
  Letter,
  Memory,
  ScrapbookItem,
  StoredPhotoStrip,
} from "@/lib/store/types";
import type { CompletionRecord } from "@/lib/store/types";
import { useStore, useStoreList } from "@/lib/store/use-store";
import { formatDate, plural, relativeFromNow } from "@/lib/utils";
import { cn } from "@/lib/utils";

const EMOJIS = ["🌿", "🌸", "🫧", "⭐️", "🔥", "🍯", "🌙", "🦋"];

export function CouplesHub() {
  const [couple, refreshCouple] = useStore<CoupleProfile>(getCouple);
  const [completions] = useStoreList<CompletionRecord>(listCompletions);
  const [memories, refreshMemories] = useStoreList<Memory>(listMemories);
  const [goals, refreshGoals] = useStoreList<Goal>(listGoals);
  const [letters] = useStoreList<Letter>(listLetters);
  const [scrapbook] = useStoreList<ScrapbookItem>(listScrapbook);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CoupleProfile | null>(null);
  const [goalText, setGoalText] = useState("");

  const [strips] = useStoreList<StoredPhotoStrip>(listStrips);

  /** Things you kept hang off the tree; things you finished grow it. */
  const progress = useMemo(
    () =>
      computeTreeProgress(completions, {
        leaves: memories.length,
        blossoms: strips.length,
        branches: completions.find((c) => c.experienceId === "our-future")?.count ?? 0,
        flowers: letters.length,
      }),
    [completions, memories.length, strips.length, letters.length],
  );
  const sealedLetters = letters.filter((l) => !isDeliverable(l));
  const openLetters = letters.filter(isDeliverable);

  const displayName =
    couple?.coupleName ||
    [couple?.partnerOneName, couple?.partnerTwoName].filter(Boolean).join(" & ") ||
    "Your hub";

  return (
    <PageShell className="pb-24 pt-10 sm:pt-14">
      <PageHeading
        eyebrow="Couples Hub"
        title={displayName}
        subtitle={
          couple?.since
            ? `Together since ${formatDate(couple.since)}. Everything you keep lives here.`
            : "One shared home for your profile, memories, goals, letters and the tree."
        }
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(couple ?? getCouple());
              setEditing(true);
            }}
          >
            Edit profile
          </Button>
        }
      />

      <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* --- left column --- */}
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Growth" value={progress.growth} />
            <Stat label="Different games" value={`${progress.unique}/${EXPERIENCES.length}`} />
            <Stat label="In the book" value={scrapbook.length} />
            <Stat label="Letters sealed" value={sealedLetters.length} />
          </div>

          <Card title="Saved experiences">
            {completions.length === 0 ? (
              <Empty
                text="Every experience you finish adds a branch. Right now it's a seed."
                href="/"
                cta="Pick something"
              />
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {completions
                  .slice()
                  .sort((a, b) => b.count - a.count)
                  .map((record) => {
                    const experience = getExperience(record.experienceId);
                    return (
                      <Link
                        key={record.experienceId}
                        href={experience ? (experience.href ?? `/play/${experience.id}`) : "/"}
                        className="group/row flex items-center gap-3.5 rounded-[20px] bg-surface-muted p-4 transition-all duration-300 ease-out hover:-translate-y-[2px] hover:bg-surface hover:shadow-sm hover:ring-1 hover:ring-inset hover:ring-line"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            background: experience
                              ? `var(--${experience.palette}-mid)`
                              : "var(--border-strong)",
                          }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-bold tracking-[-0.018em] text-ink">
                            {experience?.title ?? record.experienceId}
                          </span>
                          <span className="t-caption block">
                            {record.count}× · {relativeFromNow(record.lastAt)}
                          </span>
                        </span>
                        <span className="t-num text-[13px] font-bold text-ink-faint transition-colors group-hover/row:text-ink">
                          →
                        </span>
                      </Link>
                    );
                  })}
              </div>
            )}
          </Card>

          <Card title="Shared memories">
            {memories.length === 0 ? (
              <Empty
                text="Results you choose to save from any experience show up here."
                href="/play/know-me"
                cta="Play something"
              />
            ) : (
              <div className="space-y-2.5">
                {memories.map((memory) => {
                  const experience = getExperience(memory.experienceId);
                  return (
                    <div
                      key={memory.id}
                      className="group flex items-start gap-3 rounded-2xl bg-surface-muted p-4"
                    >
                      {memory.dataUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={memory.dataUrl}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-sm ring-1 ring-inset ring-line object-cover"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-bold text-ink">{memory.title}</p>
                        <p className="mt-0.5 text-[12.5px] text-ink-muted">{memory.detail}</p>
                        <p className="mt-1 text-[11.5px] text-ink-faint">
                          {experience?.title ?? memory.experienceId} ·{" "}
                          {formatDate(memory.createdAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Remove memory"
                        onClick={() => {
                          deleteMemory(memory.id);
                          refreshMemories();
                        }}
                        className="grid h-6 w-6 place-items-center rounded-lg text-ink-faint opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
                      >
                        <IconClose width={11} height={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title="Goals">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!goalText.trim()) return;
                addGoal(goalText.trim());
                setGoalText("");
                refreshGoals();
              }}
              className="mb-4 flex gap-2"
            >
              <TextField
                value={goalText}
                onChange={(e) => setGoalText(e.target.value)}
                placeholder="Something you both actually want to do"
                aria-label="New goal"
              />
              <Button type="submit" disabled={!goalText.trim()}>
                <IconPlus width={15} height={15} />
              </Button>
            </form>

            {goals.length === 0 ? (
              <p className="text-[13.5px] text-ink-muted">
                Add the thing you keep saying you&rsquo;ll do.
              </p>
            ) : (
              <div className="space-y-2">
                {goals.map((goal) => (
                  <div
                    key={goal.id}
                    className="group flex items-center gap-3 rounded-2xl bg-surface-muted px-4 py-3"
                  >
                    <button
                      type="button"
                      aria-label={goal.done ? "Mark as not done" : "Mark as done"}
                      onClick={() => {
                        toggleGoal(goal.id);
                        refreshGoals();
                      }}
                      className={cn(
                        "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors",
                        goal.done ? "border-mint-500 bg-mint-deep text-white" : "border-line-strong",
                      )}
                    >
                      {goal.done && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m5 12.5 4.6 4.5L19 7" />
                        </svg>
                      )}
                    </button>
                    <span
                      className={cn(
                        "flex-1 text-[14px] font-semibold",
                        goal.done ? "text-ink-faint line-through" : "text-ink",
                      )}
                    >
                      {goal.text}
                    </span>
                    <button
                      type="button"
                      aria-label="Delete goal"
                      onClick={() => {
                        deleteGoal(goal.id);
                        refreshGoals();
                      }}
                      className="text-ink-faint opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
                    >
                      <IconClose width={12} height={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* --- right column --- */}
        <aside className="space-y-5">
          <div className="rounded-4xl ring-1 ring-inset ring-line bg-surface p-6 shadow-sm">
            <div className="mb-1 flex items-baseline justify-between">
              <p className="t-eyebrow">
                Connection Tree
              </p>
              <Pill tone="good">Stage {progress.stage.level}</Pill>
            </div>

            <ConnectionTree progress={progress} />

            <p className="t-h3 mt-1 text-center text-ink">{progress.stage.name}</p>
            <p className="t-body-sm mx-auto mt-2 max-w-[30ch] text-center">
              {progress.stage.blurb}
            </p>

            {progress.biggestContributor && (
              <p className="t-caption mt-4 text-center">
                Most of it came from{" "}
                <span className="font-bold text-ink-muted">
                  {getExperience(progress.biggestContributor.experienceId)?.title ??
                    progress.biggestContributor.experienceId}
                </span>
                .
              </p>
            )}

            {/* things you kept, hanging off the branches */}
            <div className="mt-5 flex flex-wrap justify-center gap-1.5">
              {progress.ornaments.leaves > 0 && (
                <Pill tone="neutral">
                  {plural(progress.ornaments.leaves, "memory", "memories")}
                </Pill>
              )}
              {progress.ornaments.blossoms > 0 && (
                <Pill tone="neutral">{progress.ornaments.blossoms} blossoms</Pill>
              )}
              {progress.ornaments.flowers > 0 && (
                <Pill tone="neutral">{progress.ornaments.flowers} letters</Pill>
              )}
            </div>

            {progress.next ? (
              <div className="mt-7">
                <div className="mb-2 flex justify-between text-[12px] font-bold tracking-[-0.01em] text-ink-muted">
                  <span>{progress.stage.name}</span>
                  <span>{progress.next.name}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-pill bg-surface-sunken">
                  <div
                    className="h-full rounded-pill transition-[width] duration-[900ms] ease-out"
                    style={{
                      width: `${Math.max(4, progress.toNext * 100)}%`,
                      backgroundImage: "linear-gradient(90deg, var(--mint-mid), var(--sky-mid))",
                    }}
                  />
                </div>
                <p className="t-caption mt-3 text-center">
                  {progress.next.threshold - progress.growth} more growth to reach{" "}
                  {progress.next.name}
                </p>
              </div>
            ) : (
              <p className="t-serif mt-6 text-center text-[18px] text-ink-muted">
                fully grown. genuinely impressive.
              </p>
            )}

            <details className="mt-6">
              <summary className="cursor-pointer text-[12.5px] font-bold text-ink-muted transition-colors hover:text-ink">
                All stages
              </summary>
              <ul className="mt-4 space-y-2">
                {TREE_STAGES.map((stage) => (
                  <li
                    key={stage.level}
                    className={cn(
                      "flex justify-between text-[12.5px]",
                      stage.level <= progress.stage.level ? "text-ink" : "text-ink-faint",
                    )}
                  >
                    <span className="font-semibold">{stage.name}</span>
                    <span className="t-num">{stage.threshold}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>

          <Card title="Letters">
            {letters.length === 0 ? (
              <Empty text="Write something today, sealed until a date you pick." href="/play/letters" cta="Write one" />
            ) : (
              <>
                <div className="flex gap-2">
                  <Pill>{sealedLetters.length} sealed</Pill>
                  <Pill tone="good">{openLetters.length} ready</Pill>
                </div>
                <div className="mt-3.5 space-y-2">
                  {letters.slice(0, 4).map((letter) => (
                    <div key={letter.id} className="rounded-2xl bg-surface-muted px-4 py-3">
                      <p className="truncate text-[13.5px] font-bold text-ink">{letter.subject}</p>
                      <p className="mt-0.5 text-[12px] text-ink-faint">
                        {isDeliverable(letter)
                          ? "Ready to open"
                          : `Opens ${relativeFromNow(letter.deliverOn)}`}
                      </p>
                    </div>
                  ))}
                </div>
                <ButtonLink href="/play/letters" variant="soft" block className="mt-3.5">
                  All letters
                </ButtonLink>
              </>
            )}
          </Card>

          <Card title="Scrapbook">
            {scrapbook.length === 0 ? (
              <Empty text="Four photos, one strip, about thirty seconds." href="/photobooth" cta="Make a strip" />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {scrapbook
                    .filter((item) => item.dataUrl)
                    .slice(0, 6)
                    .map((item) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={item.id}
                        src={item.dataUrl}
                        alt={item.title}
                        className="aspect-square w-full rounded-sm ring-1 ring-inset ring-line object-cover"
                      />
                    ))}
                </div>
                <ButtonLink href="/scrapbook" variant="soft" block className="mt-3.5">
                  Open the book
                </ButtonLink>
              </>
            )}
          </Card>
        </aside>
      </div>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Your profile"
        description="Only stored on this device."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (draft) saveCouple(draft);
                refreshCouple();
                setEditing(false);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="cname">What do you call yourselves?</Label>
              <TextField
                id="cname"
                value={draft.coupleName}
                onChange={(e) => setDraft({ ...draft, coupleName: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="p1">You</Label>
                <TextField
                  id="p1"
                  value={draft.partnerOneName}
                  onChange={(e) => setDraft({ ...draft, partnerOneName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="p2">Them</Label>
                <TextField
                  id="p2"
                  value={draft.partnerTwoName}
                  onChange={(e) => setDraft({ ...draft, partnerTwoName: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="since">Together since</Label>
              <TextField
                id="since"
                type="date"
                value={draft.since}
                onChange={(e) => setDraft({ ...draft, since: e.target.value })}
              />
            </div>
            <div>
              <Label>Badge</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setDraft({ ...draft, emoji })}
                    className={cn(
                      "grid h-10 w-10 place-items-center rounded-xl text-[19px] transition-colors",
                      draft.emoji === emoji ? "bg-ink" : "bg-surface-muted",
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="note">A note to yourselves</Label>
              <TextArea
                id="note"
                rows={3}
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </div>
          </div>
        )}
      </Modal>
    </PageShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-4xl ring-1 ring-inset ring-line bg-surface p-6 shadow-sm">
      <p className="mb-4 t-eyebrow">
        {title}
      </p>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[24px] bg-surface p-6 text-center shadow-sm ring-1 ring-inset ring-line">
      <p className="t-num text-[30px] font-extrabold tracking-[-0.04em] text-ink">{value}</p>
      <p className="t-caption mt-1.5">{label}</p>
    </div>
  );
}

function Empty({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="rounded-[22px] border-[1.5px] border-dashed border-line-strong p-8 text-center">
      <p className="t-body-sm mx-auto max-w-[34ch]">{text}</p>
      <ButtonLink href={href} size="sm" variant="secondary" className="mt-5">
        {cta}
      </ButtonLink>
    </div>
  );
}

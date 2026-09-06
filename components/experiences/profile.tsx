"use client";

import { useEffect, useState } from "react";
import { PageHeading, PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { Label, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { AuthPanel } from "@/components/auth/auth-panel";
import { IDENTITY_EMOJIS, getIdentity, updateIdentity } from "@/lib/rooms/identity";
import { realtimeBackendName } from "@/lib/realtime";
import { recentRooms } from "@/lib/rooms/api";
import type { PlayerIdentity } from "@/lib/rooms/types";
import { cn, formatDate } from "@/lib/utils";

/** The collections shown in the export and counted towards the usage figure. */
const STORAGE_KEYS = [
  "together:strips",
  "together:scrapbook",
  "together:letters",
  "together:gifts",
  "together:memories",
  "together:couple",
  "together:goals",
  "together:designs",
  "together:completions",
  "together:favourite-cards",
  "together:arcade",
  "together:recent-rooms",
];

/**
 * Everything this device holds, including the room documents.
 *
 * A room document carries the actual content of a session — answers, arguments,
 * drawings, chat — so listing keys by hand meant "Delete everything" quietly
 * left the most personal data behind. Enumerating the namespace can't drift.
 */
function allStoredKeys(storage: Storage) {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith("together:")) keys.push(key);
  }
  return keys;
}

export function Profile() {
  const [identity, setIdentity] = useState<PlayerIdentity | null>(null);
  const [backend, setBackend] = useState<string>("local");
  const [rooms, setRooms] = useState<ReturnType<typeof recentRooms>>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [usage, setUsage] = useState(0);

  useEffect(() => {
    setIdentity(getIdentity());
    setBackend(realtimeBackendName());
    setRooms(recentRooms());
    let bytes = 0;
    STORAGE_KEYS.forEach((key) => {
      bytes += (window.localStorage.getItem(key) ?? "").length;
    });
    setUsage(bytes);
  }, []);

  function exportData() {
    const dump: Record<string, unknown> = {};
    STORAGE_KEYS.forEach((key) => {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        try {
          dump[key] = JSON.parse(raw);
        } catch {
          dump[key] = raw;
        }
      }
    });
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `together-data-${new Date().toISOString().slice(0, 10)}.json`;
    // Firefox ignores a click on an anchor that is not in the document, and
    // both Firefox and Safari cancel the download if the blob is revoked before
    // they have taken it.
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function clearData() {
    allStoredKeys(window.localStorage).forEach((key) => window.localStorage.removeItem(key));
    try {
      allStoredKeys(window.sessionStorage).forEach((key) =>
        window.sessionStorage.removeItem(key),
      );
    } catch {
      /* private mode — nothing to clear */
    }
    setConfirmClear(false);
    window.location.reload();
  }

  if (!identity) {
    return (
      <PageShell width="narrow" className="py-28 text-center">
        <span className="mx-auto block h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-ink" />
      </PageShell>
    );
  }

  return (
    <PageShell width="narrow" className="pb-24 pt-10 sm:pt-14">
      <PageHeading
        eyebrow="Profile"
        title={
          <>
            How you <span className="t-serif">show up</span>
          </>
        }
        subtitle="This is the name and badge the other person sees when you join a room."
      />

      <div className="mt-9 space-y-5">
        <div className="rounded-4xl ring-1 ring-inset ring-line bg-surface p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-3xl bg-surface-muted text-[26px]">
              {identity.emoji}
            </span>
            <div>
              <p className="t-h3 text-ink">{identity.name}</p>
              <p className="text-[12.5px] text-ink-faint">Guest identity · stays on this device</p>
            </div>
          </div>

          <Label htmlFor="pname">Display name</Label>
          <TextField
            id="pname"
            value={identity.name}
            maxLength={18}
            onChange={(e) => setIdentity(updateIdentity({ name: e.target.value }))}
          />

          <Label className="mt-5">Badge</Label>
          <div className="flex flex-wrap gap-1.5">
            {IDENTITY_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`Choose ${emoji}`}
                onClick={() => setIdentity(updateIdentity({ emoji }))}
                className={cn(
                  "grid h-12 w-12 place-items-center rounded-[16px] text-[21px] transition-all duration-250 ease-spring",
                  identity.emoji === emoji
                    ? "bg-ink shadow-sm"
                    : "bg-surface-sunken hover:-translate-y-[2px] hover:bg-surface-muted",
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <AuthPanel />

        <div className="rounded-4xl ring-1 ring-inset ring-line bg-surface p-6 shadow-sm">
          <p className="mb-4 t-eyebrow">
            Connection
          </p>
          <div className="flex flex-wrap gap-2">
            <Pill tone={backend === "supabase" ? "good" : "info"}>
              Realtime: {backend === "supabase" ? "Supabase" : "this browser"}
            </Pill>
            <Pill>{Math.round(usage / 1024)} KB saved locally</Pill>
          </div>
          <p className="t-body-sm mt-4">
            {backend === "supabase"
              ? "Rooms sync through Supabase Realtime, so the two of you can be anywhere."
              : "No backend is configured, so rooms sync between tabs and windows on this machine. Add Supabase keys to play across devices — see .env.example."}
          </p>
        </div>

        {rooms.length > 0 && (
          <div className="rounded-4xl ring-1 ring-inset ring-line bg-surface p-6 shadow-sm">
            <p className="mb-4 t-eyebrow">
              Recent rooms
            </p>
            <div className="space-y-2">
              {rooms.map((room) => (
                <a
                  key={room.code}
                  href={`/room/${room.code}`}
                  className="flex items-center justify-between rounded-2xl bg-surface-muted px-4 py-3 transition-colors hover:bg-[#ecece8]"
                >
                  <span className="font-mono text-[13.5px] font-bold tracking-[0.16em] text-ink">
                    {room.code}
                  </span>
                  <span className="t-caption">{formatDate(room.at)}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-4xl ring-1 ring-inset ring-line bg-surface p-6 shadow-sm">
          <p className="mb-4 t-eyebrow">
            Your data
          </p>
          <p className="t-body-sm mb-6">
            Strips, scrapbook pages, letters, gifts, goals and scores are stored in this browser.
            Export takes a copy; clearing is permanent.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="secondary" onClick={exportData}>
              Export everything
            </Button>
            <Button variant="danger" onClick={() => setConfirmClear(true)}>
              Clear all data
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear everything?"
        description="This deletes every strip, letter, gift, goal and score stored in this browser, along with any rooms still open on this device and your name and emoji. It can't be undone."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={clearData}>
              Delete everything
            </Button>
          </>
        }
      />
    </PageShell>
  );
}

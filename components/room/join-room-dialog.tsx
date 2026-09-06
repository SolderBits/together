"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { roomExists } from "@/lib/rooms/api";
import { normalizeCode } from "@/lib/utils";

export function JoinRoomDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = normalizeCode(code);
    if (clean.length < 4) {
      setError("Room codes are six characters.");
      return;
    }
    setChecking(true);
    setError(null);
    const state = await roomExists(clean);
    setChecking(false);
    if (!state) {
      setError(`No room called ${clean}. Check it with them.`);
      return;
    }
    onClose();
    router.push(`/room/${clean}`);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Join their room"
      description="Type the six characters they read out, or just open the link they sent."
      size="sm"
    >
      <form onSubmit={submit} className="space-y-5">
        <TextField
          autoFocus
          value={code}
          onChange={(e) => {
            setCode(normalizeCode(e.target.value));
            setError(null);
          }}
          placeholder="ABC123"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label="Room code"
          className="py-5 text-center font-mono text-[30px] font-extrabold uppercase tracking-[0.28em]"
        />
        {error && (
          <p className="text-center text-[13.5px] font-semibold text-[#a5322a]">{error}</p>
        )}
        <Button type="submit" block size="xl" disabled={checking}>
          {checking ? "Looking…" : "Join room"}
        </Button>
      </form>
    </Modal>
  );
}

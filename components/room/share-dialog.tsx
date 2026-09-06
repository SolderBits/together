"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { QrCode } from "@/components/shared/qr-code";
import { RoomCode } from "./room-code";
import { copyText } from "@/lib/utils";

export function ShareDialog({
  open,
  onClose,
  code,
  link,
  title = "Bring them in",
  description = "Send the link, or read the six characters out loud. No account, no app.",
}: {
  open: boolean;
  onClose: () => void;
  code?: string;
  link: string;
  title?: string;
  description?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title, url: link });
        return;
      } catch {
        /* sheet dismissed — fall through to copy */
      }
    }
    if (await copyText(link)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm">
      <div className="flex flex-col items-center gap-7">
        <div className="relative">
          <span
            className="absolute -inset-6 -z-10 rounded-[50%] blur-2xl"
            style={{
              background:
                "radial-gradient(circle, var(--blush-tint), var(--sky-tint) 60%, transparent 72%)",
            }}
            aria-hidden="true"
          />
          <div className="rounded-[26px] bg-surface p-3.5 shadow-sm ring-1 ring-inset ring-line">
            <QrCode value={link} size={188} />
          </div>
        </div>

        {code && <RoomCode code={code} size="md" />}

        <div className="w-full space-y-2.5">
          <p className="truncate rounded-sm bg-surface-muted px-4 py-3 text-center text-[12.5px] font-medium text-ink-muted">
            {link}
          </p>
          <Button block size="lg" onClick={share}>
            {copied ? "Link copied" : "Copy invite link"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

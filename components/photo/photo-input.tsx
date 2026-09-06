"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { fileToDataUrl, useCamera } from "@/lib/media/use-camera";
import { cn } from "@/lib/utils";

/**
 * Camera-first photo capture with an upload fallback.
 *
 * A photo taken here is sent once, over the event channel, and kept on each
 * device — it never enters the replicated room document. A thousand pixels wide
 * is plenty for the cards it appears in and for keeping one in a scrapbook,
 * while staying small enough to cross a BroadcastChannel without a stutter.
 */
const CAPTURE_WIDTH = 1000;
const CAPTURE_QUALITY = 0.8;

/**
 * Phones produce very large files. Reading a 50 MB image into a base64 string
 * and then onto a canvas can take the tab down on mobile Safari, so it is
 * refused with an explanation rather than attempted and lost.
 */
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export function PhotoInput({
  onCapture,
  disabled,
  label = "Take the photo",
  className,
}: {
  onCapture: (dataUrl: string) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const camera = useCamera();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const live = camera.status === "ready";

  return (
    <div className={cn("space-y-4", className)}>
      <div className="group/cam relative overflow-hidden rounded-[28px] bg-[#17151a] shadow-card ring-1 ring-inset ring-line">
        <video
          ref={camera.videoRef}
          playsInline
          muted
          className={cn(
            "aspect-[4/3] w-full object-cover transition-opacity duration-500",
            live ? "opacity-100" : "opacity-0",
            camera.facingMode === "user" && "-scale-x-100",
          )}
        />

        {/* soft vignette so any label always reads */}
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.32) 0%, transparent 24%, transparent 76%, rgba(0,0,0,0.26) 100%)",
          }}
          aria-hidden="true"
        />

        {!live && (
          <div className="absolute inset-0 grid place-items-center p-7 text-center">
            <div>
              <span
                className="mx-auto mb-4 block h-10 w-10 rounded-pill ring-[1.5px] ring-inset ring-white/25"
                aria-hidden="true"
              />
              <p className="text-[14px] font-semibold text-white/85">
                {camera.status === "requesting"
                  ? "Asking for the camera…"
                  : camera.status === "idle"
                    ? "Camera is off"
                    : "Camera unavailable"}
              </p>
              {camera.error && (
                <p className="mx-auto mt-2.5 max-w-[30ch] text-[12.5px] leading-relaxed text-white/60">
                  {camera.error}
                </p>
              )}
            </div>
          </div>
        )}

        {live && (
          <span className="absolute left-3.5 top-3.5 flex items-center gap-2 rounded-pill bg-black/35 px-3 py-1.5 text-[12px] font-bold text-white backdrop-blur-md">
            Live
            <span className="h-1.5 w-1.5 rounded-full bg-[#6ee7a8]" />
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2.5">
        {live ? (
          <>
            <Button
              size="lg"
              disabled={disabled}
              onClick={() => {
                const shot = camera.capture({ width: CAPTURE_WIDTH, quality: CAPTURE_QUALITY });
                if (shot) onCapture(shot);
              }}
            >
              {label}
            </Button>
            {camera.hasMultipleCameras && (
              <Button size="lg" variant="secondary" onClick={camera.switchCamera}>
                Flip camera
              </Button>
            )}
            <Button size="lg" variant="ghost" onClick={camera.stop}>
              Stop camera
            </Button>
          </>
        ) : (
          <Button size="lg" variant="secondary" onClick={camera.start} disabled={disabled}>
            Use camera
          </Button>
        )}

        <Button
          size="lg"
          variant="soft"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
        >
          Upload instead
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
            setUploadError(null);

            if (!file.type.startsWith("image/")) {
              setUploadError("That needs to be an image.");
              return;
            }
            if (file.size > MAX_UPLOAD_BYTES) {
              setUploadError(
                `That photo is ${Math.round(file.size / 1_048_576)} MB — a little big. Try another, or take one here.`,
              );
              return;
            }

            try {
              onCapture(await fileToDataUrl(file, CAPTURE_WIDTH));
            } catch {
              setUploadError(
                "That image couldn't be read. iPhone HEIC photos sometimes need converting first.",
              );
            }
          }}
        />
      </div>

      {uploadError && (
        <p className="text-[13.5px] font-semibold text-[#a5322a]">{uploadError}</p>
      )}
    </div>
  );
}

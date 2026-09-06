"use client";

/**
 * Getting an image off the page and onto someone's device.
 *
 * `<a download>` looks universal and is not. iOS Safari ignores the attribute
 * on a `data:` URL entirely — the strip either opens as a raw blob in a new tab
 * or nothing happens at all — which on a product whose flagship output is a
 * photo strip, taken on a phone, is the whole feature failing silently on the
 * likeliest device.
 *
 * So there are three routes, tried in order, and the caller is told which one
 * actually happened. Nothing here reports success it did not achieve.
 */

export type ExportOutcome =
  /** The file is in the downloads folder. */
  | { kind: "downloaded" }
  /** Handed to the OS share sheet; the person chose what to do with it. */
  | { kind: "shared" }
  /** Opened full-size for a long-press save — the only route left on older iOS. */
  | { kind: "press-and-hold"; url: string }
  | { kind: "failed"; reason: string };

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, encoded] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "image/png";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** iOS Safari and every iPadOS browser, which are all Safari underneath. */
function isAppleMobile() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS reports itself as a Mac; the touch points give it away.
    (/Macintosh/.test(ua) && typeof document !== "undefined" && navigator.maxTouchPoints > 1)
  );
}

function canDownloadAnchor() {
  if (typeof document === "undefined") return false;
  return "download" in document.createElement("a") && !isAppleMobile();
}

/**
 * Saves an image, by whatever route this browser actually supports.
 *
 * `dataUrl` is used at full resolution throughout — nothing here resamples or
 * recompresses, so a 2400-wide strip is saved at 2400 wide.
 */
export async function exportImage(
  dataUrl: string,
  filename: string,
  options: { title?: string } = {},
): Promise<ExportOutcome> {
  let blob: Blob;
  try {
    blob = dataUrlToBlob(dataUrl);
  } catch {
    return { kind: "failed", reason: "That image couldn't be prepared for saving." };
  }

  const file = new File([blob], filename, { type: blob.type });

  // 1. The share sheet. On iOS this is the route that genuinely reaches the
  //    camera roll, and on Android it offers everything else besides.
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };
  if (isAppleMobile() && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: options.title ?? filename });
      return { kind: "shared" };
    } catch (error) {
      // A cancelled sheet is a choice, not a failure — don't fall through to
      // opening a tab they didn't ask for.
      if (error instanceof DOMException && error.name === "AbortError") {
        return { kind: "failed", reason: "" };
      }
    }
  }

  // 2. A real download, where the attribute is honoured.
  if (canDownloadAnchor()) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    // Firefox requires the element to be in the document before it is clicked.
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking straight away cancels the download in Safari and Firefox; one
    // turn of the event loop is enough for the browser to have taken the blob.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { kind: "downloaded" };
  }

  // 3. Nothing else left: show it full-size so it can be saved by hand.
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank");
  if (!opened) {
    URL.revokeObjectURL(url);
    return {
      kind: "failed",
      reason: "Your browser blocked the pop-up. Allow pop-ups for this site and try again.",
    };
  }
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
  return { kind: "press-and-hold", url };
}

/** What to tell someone after `exportImage`, in their words rather than ours. */
export function describeOutcome(outcome: ExportOutcome, noun = "image"): string | null {
  switch (outcome.kind) {
    case "downloaded":
      return `Saved — check your downloads for the ${noun}.`;
    case "shared":
      return "Sent to the share sheet.";
    case "press-and-hold":
      return `Opened the full-size ${noun} in a new tab. Press and hold it to save to your photos.`;
    case "failed":
      return outcome.reason || null;
  }
}

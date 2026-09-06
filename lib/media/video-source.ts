/**
 * Watch Together deliberately hosts nothing.
 *
 * We accept links the browser can play on its own — YouTube through its own
 * official embeddable player, or a direct video file the user already has a
 * public URL for. Nothing is downloaded, proxied or re-served by this app; all
 * we synchronise is playback position.
 */
export type VideoKind = "youtube" | "file";

export interface VideoSource {
  kind: VideoKind;
  /** YouTube video id, or the direct file URL. */
  ref: string;
  /** The original URL, kept so we can show it back to people. */
  url: string;
  label: string;
}

const YOUTUBE_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
];

const FILE_EXTENSIONS = [".mp4", ".webm", ".ogv", ".ogg", ".mov", ".m4v"];

export type ParseResult =
  | { ok: true; source: VideoSource }
  | { ok: false; reason: string };

export function parseVideoUrl(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "Paste a link to get started." };

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, reason: "That doesn't look like a web address." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only http and https links work here." };
  }

  const host = url.hostname.toLowerCase();

  // --- YouTube -------------------------------------------------------------
  if (YOUTUBE_HOSTS.includes(host)) {
    const id = youtubeIdFrom(url);
    if (!id) {
      return {
        ok: false,
        reason: "That's a YouTube link, but we couldn't find a video id in it.",
      };
    }
    return {
      ok: true,
      source: { kind: "youtube", ref: id, url: trimmed, label: "YouTube" },
    };
  }

  // --- direct video file ---------------------------------------------------
  const path = url.pathname.toLowerCase();
  if (FILE_EXTENSIONS.some((ext) => path.endsWith(ext))) {
    return {
      ok: true,
      source: {
        kind: "file",
        ref: url.toString(),
        url: trimmed,
        label: url.hostname,
      },
    };
  }

  return {
    ok: false,
    reason:
      "That link isn't supported. Use a YouTube link, or a direct link to a video file (.mp4, .webm, .mov).",
  };
}

function youtubeIdFrom(url: URL): string | null {
  const host = url.hostname.toLowerCase();

  if (host.endsWith("youtu.be")) {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return isYoutubeId(id) ? id : null;
  }

  const v = url.searchParams.get("v");
  if (v && isYoutubeId(v)) return v;

  const parts = url.pathname.split("/").filter(Boolean);
  const marker = parts.findIndex((p) => p === "embed" || p === "shorts" || p === "v" || p === "live");
  if (marker >= 0 && parts[marker + 1] && isYoutubeId(parts[marker + 1])) {
    return parts[marker + 1];
  }
  return null;
}

function isYoutubeId(value: string | undefined): value is string {
  return Boolean(value) && /^[\w-]{11}$/.test(value!);
}

/** Human-readable summary used in the "now watching" strip. */
export function describeSource(source: VideoSource) {
  return source.kind === "youtube" ? `YouTube · ${source.ref}` : source.label;
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

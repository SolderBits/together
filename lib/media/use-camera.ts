"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "requesting" | "ready" | "denied" | "unavailable" | "error";

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  error: string | null;
  facingMode: "user" | "environment";
  hasMultipleCameras: boolean;
  start: () => Promise<void>;
  stop: () => void;
  switchCamera: () => Promise<void>;
  /** Grabs a frame as a data URL, mirroring the front camera to match the preview. */
  capture: (options?: { width?: number; mirror?: boolean; quality?: number }) => string | null;
}

/**
 * Wraps getUserMedia with the states a real UI has to handle: permission
 * prompts, denial, no camera at all, and switching between front and rear.
 */
export function useCamera(options: { autoStart?: boolean } = {}): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  /**
   * `getUserMedia` resolves long after it is called — the permission prompt sits
   * in the middle of it — so a component that unmounts while that prompt is open
   * has nothing in `streamRef` for cleanup to stop, and the stream that arrives
   * afterwards would stay live with no UI left to turn it off. Every stop bumps
   * this counter; a request whose generation is stale releases its own stream
   * instead of storing it.
   */
  const generation = useRef(0);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const stop = useCallback(() => {
    generation.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const open = useCallback(
    async (mode: "user" | "environment") => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setStatus("unavailable");
        setError("This browser can't reach a camera. You can still upload a photo.");
        return;
      }
      setStatus("requesting");
      setError(null);
      stop();
      const mine = generation.current;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (mine !== generation.current) {
          // Stopped or unmounted while the prompt was open — never adopt it.
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {
            /* autoplay policies — the element is muted+playsInline so this is rare */
          });
        }
        setFacingMode(mode);
        setStatus("ready");

        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasMultipleCameras(devices.filter((d) => d.kind === "videoinput").length > 1);
      } catch (err) {
        if (mine !== generation.current) return;
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setStatus("denied");
          setError(
            "Camera access was blocked. Allow it in your browser's site settings, or upload a photo instead.",
          );
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setStatus("unavailable");
          setError("No camera found on this device. Uploading works just as well.");
        } else {
          setStatus("error");
          setError(err instanceof Error ? err.message : "The camera couldn't be started.");
        }
      }
    },
    [stop],
  );

  const start = useCallback(() => open(facingMode), [open, facingMode]);

  const switchCamera = useCallback(
    () => open(facingMode === "user" ? "environment" : "user"),
    [open, facingMode],
  );

  const capture = useCallback(
    (opts: { width?: number; mirror?: boolean; quality?: number } = {}) => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return null;
      const targetWidth = opts.width ?? video.videoWidth;
      const scale = targetWidth / video.videoWidth;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const mirror = opts.mirror ?? facingMode === "user";
      if (mirror) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", opts.quality ?? 0.92);
    },
    [facingMode],
  );

  useEffect(() => {
    if (options.autoStart) void open("user");
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    videoRef,
    status,
    error,
    facingMode,
    hasMultipleCameras,
    start,
    stop,
    switchCamera,
    capture,
  };
}

/** Reads a File into a downscaled JPEG data URL, so uploads don't blow up storage. */
export function fileToDataUrl(file: File, maxWidth = 1400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't an image we can read."));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable."));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

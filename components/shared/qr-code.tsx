"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Renders a QR for any URL, with an optional heart cut into the middle. */
export function QrCode({
  value,
  size = 220,
  heart = false,
  className,
  onReady,
}: {
  value: string;
  size?: number;
  heart?: boolean;
  className?: string;
  onReady?: (dataUrl: string) => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: "#111114", light: "#ffffff" },
    })
      .then((url) => {
        if (cancelled) return;
        setDataUrl(url);
        onReady?.(url);
      })
      .catch(() => setDataUrl(null));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <div className="h-full w-full animate-pulse rounded-2xl bg-surface-muted" />
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? ""}`} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={`QR code linking to ${value}`}
        width={size}
        height={size}
        className="rounded-2xl"
      />
      {heart && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span
            className="grid place-items-center rounded-2xl bg-white"
            style={{ width: size * 0.26, height: size * 0.26 }}
          >
            <svg viewBox="0 0 24 24" width={size * 0.17} height={size * 0.17} aria-hidden="true">
              <path
                d="M12 21S3.2 15.6 3.2 9.6A4.6 4.6 0 0 1 12 7.6a4.6 4.6 0 0 1 8.8 2c0 6-8.8 11.4-8.8 11.4Z"
                fill="#f95f9b"
              />
            </svg>
          </span>
        </span>
      )}
    </div>
  );
}

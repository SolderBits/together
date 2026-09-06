import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE.name} — ${SITE.tagline}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "88px",
          background: "linear-gradient(120deg,#ffe9f0 0%,#fbfbf9 45%,#e2effd 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 42 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              background: "linear-gradient(105deg,#ff9ec4,#b8a6f5,#8ec5f7)",
            }}
          />
          <div style={{ fontSize: 34, fontWeight: 800, color: "#111114", letterSpacing: -1 }}>
            {SITE.name}
          </div>
        </div>
        <div
          style={{
            fontSize: 88,
            fontWeight: 800,
            color: "#111114",
            letterSpacing: -3.6,
            lineHeight: 1.02,
            maxWidth: 900,
          }}
        >
          {SITE.tagline}
        </div>
        <div style={{ marginTop: 28, fontSize: 30, color: "#74747f", maxWidth: 820 }}>
          Quizzes, drawings, debates and photo strips — for two people, anywhere.
        </div>
      </div>
    ),
    size,
  );
}

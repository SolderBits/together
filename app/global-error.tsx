"use client";

/**
 * The last resort: a failure in the root layout itself, where no shared chrome
 * or design token is guaranteed to be available. Styles are inline for exactly
 * that reason.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#fbf9f6",
          color: "#111114",
          fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif',
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "420px", textAlign: "center" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>
            That came apart
          </h1>
          <p style={{ marginTop: "12px", fontSize: "15px", lineHeight: 1.6, color: "#5a5a63" }}>
            Something went wrong loading the page. Nothing you&rsquo;ve saved is affected.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "28px",
              border: 0,
              borderRadius: "999px",
              background: "#111114",
              color: "#fff",
              padding: "13px 26px",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

"use client";

import { useEffect } from "react";

/**
 * Catches an error thrown by the ROOT layout itself (e.g. a session/auth
 * lookup that runs on every page) — error.tsx alone can't catch that,
 * since it renders inside the layout it's meant to protect. Next.js
 * requires this file to render its own complete <html>/<body>, since it
 * fully replaces the root layout when it fires.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
          background: "#090D16",
          color: "#E7ECF5",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Something went wrong</h1>
        <p style={{ fontSize: "0.9rem", color: "#9AA5B8", maxWidth: 360, margin: 0 }}>
          This is usually a brief connection hiccup. Try again — if it keeps happening, let us know.
        </p>
        {error.digest && (
          <p style={{ fontSize: "0.75rem", color: "#5C6579", margin: 0 }}>Reference: {error.digest}</p>
        )}
        <button
          onClick={() => reset()}
          style={{
            padding: "0.6rem 1.4rem",
            borderRadius: 10,
            border: "none",
            background: "#2563EB",
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.9rem",
            cursor: "pointer",
            marginTop: "0.5rem",
          }}
        >
          Try Again
        </button>
      </body>
    </html>
  );
}

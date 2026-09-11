"use client";

import { useEffect } from "react";

/**
 * App-wide error boundary (Next.js App Router convention — catches any
 * uncaught error thrown while rendering a route below the root layout,
 * most commonly a transient DB hiccup in a Server Component). Without
 * this file, Next's own bare fallback ("Application error... Digest:
 * <n>") is the only thing a user ever sees, with no way back except a
 * manual reload — this gives them Retry (re-renders the segment in
 * place, no full page reload) and a way home, and logs the real error to
 * the browser console (still never a raw stack trace on screen).
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <main
      style={{
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
        fontFamily:
          "var(--font-inter), system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="Atomic Guru" width={72} height={72} style={{ borderRadius: 16 }} />
      <h1 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Something went wrong</h1>
      <p style={{ fontSize: "0.9rem", color: "#9AA5B8", maxWidth: 360, margin: 0 }}>
        This is usually a brief connection hiccup. Try again — if it keeps happening, let us know.
      </p>
      {error.digest && (
        <p style={{ fontSize: "0.75rem", color: "#5C6579", margin: 0 }}>Reference: {error.digest}</p>
      )}
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
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
          }}
        >
          Try Again
        </button>
        <a
          href="/"
          style={{
            padding: "0.6rem 1.4rem",
            borderRadius: 10,
            border: "1px solid #2A3244",
            color: "#E7ECF5",
            fontWeight: 600,
            fontSize: "0.9rem",
            textDecoration: "none",
          }}
        >
          Go Home
        </a>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { OfflineRetryButton } from "./retry-button";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

/**
 * Shown by the service worker when a navigation request fails and there is
 * no network. Deliberately static — no session, no data — so it can be
 * precached and never displays stale student information.
 */
export default function OfflinePage() {
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
      <img
        src="/icons/icon-192.png"
        alt="Atomic Pathshala"
        width={72}
        height={72}
        style={{ borderRadius: 16 }}
      />
      <h1 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
        You are offline. Please check your internet connection.
      </h1>
      <p style={{ fontSize: "0.9rem", opacity: 0.7, margin: 0, maxWidth: "22rem" }}>
        Atomic Pathshala needs a connection to load your classes, tests and doubts.
        This page will reconnect automatically once you&apos;re back online.
      </p>
      <OfflineRetryButton />
    </main>
  );
}

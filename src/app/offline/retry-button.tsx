"use client";

export function OfflineRetryButton() {
  return (
    <button
      type="button"
      onClick={() => location.reload()}
      style={{
        marginTop: "0.5rem",
        padding: "0.6rem 1.4rem",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.06)",
        color: "#E7ECF5",
        fontWeight: 600,
        fontSize: "0.9rem",
        cursor: "pointer",
      }}
    >
      Try again
    </button>
  );
}

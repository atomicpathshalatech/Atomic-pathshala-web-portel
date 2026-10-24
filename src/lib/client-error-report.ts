/**
 * Sends an error the error screen caught to /api/client-error (the server
 * log), once per message per page load.
 */
const sent = new Set<string>();

export function reportClientError(error: Error & { digest?: string }, where: string) {
  try {
    const key = `${where}:${error?.message}`;
    if (sent.has(key)) return;
    sent.add(key);
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        where,
        path: window.location.pathname + window.location.search,
        message: String(error?.message ?? error),
        digest: error?.digest,
        stack: String(error?.stack ?? ""),
      }),
    }).catch(() => {});
  } catch {
    // reporting must never throw
  }
}

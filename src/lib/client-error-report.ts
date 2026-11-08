/**
 * Sends an error the error screen caught to /api/client-error (the server
 * log), once per message per page load.
 */
const sent = new Set<string>();

/** A JS/CSS file of the page could not be loaded (usually: a new deploy replaced it). */
export function isChunkLoadError(error: unknown): boolean {
  const e = error as { name?: string; message?: string } | null;
  return e?.name === "ChunkLoadError" || /Loading (CSS )?chunk [\w-]+ failed/i.test(String(e?.message ?? ""));
}

/**
 * After a deploy, a page that is already open asks for files of the old
 * build, which no longer exist. A full reload fetches the new build. Once
 * per page per minute, so a real outage still ends on the error screen
 * instead of a reload loop. Returns true when it reloads.
 */
export function reloadForChunkError(error: unknown): boolean {
  if (!isChunkLoadError(error)) return false;
  try {
    const key = `chunk-reload:${window.location.pathname}`;
    const last = Number(window.sessionStorage.getItem(key) || 0);
    if (Date.now() - last < 60_000) return false;
    window.sessionStorage.setItem(key, String(Date.now()));
  } catch {
    // no storage: still reload once (this page load)
  }
  window.location.reload();
  return true;
}

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

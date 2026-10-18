/**
 * This device's backup copy of each slide's ink (localStorage), written by the
 * live room's save queue right before every save goes out.
 */

/** Which saved version of a slide the local backup copy was built on (see the save queue's send()). */
export function backupBaseKey(sessionId: string, pageId: string) {
  return `atomic_wb_backup_base_${sessionId}_${pageId}`;
}

/**
 * The slide's ink: the server copy, or this device's backup when it holds
 * ink the server never got (a reload while offline). With `serverVersion`
 * the backup is only used if it was built on that same server version — if
 * the slide was saved again since (e.g. from another device), the server
 * copy is newer and wins.
 */
// Slide objects are stored JSON, hence `any`.
export function getHydratedObjects<T = any>(sessionId?: string | null, pageId?: string | null, serverObjects?: T[] | null, serverVersion?: number): T[] {
  const fallback: T[] = Array.isArray(serverObjects) ? serverObjects : [];
  if (typeof window === "undefined" || !sessionId || !pageId) return fallback;
  try {
    const base = localStorage.getItem(backupBaseKey(sessionId, pageId));
    if (serverVersion !== undefined && base !== null && base !== String(serverVersion)) return fallback;
    const raw = localStorage.getItem(`atomic_wb_backup_${sessionId}_${pageId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as T[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (fallback.length === 0 || parsed.length >= fallback.length) {
          return parsed;
        }
      }
    }
  } catch {}
  return fallback;
}

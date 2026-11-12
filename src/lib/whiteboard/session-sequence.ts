/**
 * Server-side sequence fencing for Whiteboard slide transitions.
 * Tracks monotonically increasing page-switch sequence numbers per session.
 * Protects against out-of-order network requests from stale clients, retries, and network delays.
 */

const sessionSequenceMap = new Map<string, number>();

export function getSessionPageSwitchSeq(sessionId: string): number {
  return sessionSequenceMap.get(sessionId) ?? 0;
}

export function validateAndSetSessionPageSwitchSeq(
  sessionId: string,
  incomingSeq: number | undefined
): { ok: true; currentSeq: number } | { ok: false; currentSeq: number } {
  if (incomingSeq === undefined) {
    // Backward compatibility for calls without sequence: allow
    return { ok: true, currentSeq: getSessionPageSwitchSeq(sessionId) };
  }

  const currentSeq = getSessionPageSwitchSeq(sessionId);
  if (incomingSeq < currentSeq) {
    return { ok: false, currentSeq };
  }

  sessionSequenceMap.set(sessionId, incomingSeq);
  return { ok: true, currentSeq: incomingSeq };
}

export function resetSessionPageSwitchSeq(sessionId: string, initialSeq = 0): void {
  sessionSequenceMap.set(sessionId, initialSeq);
}

export function clearSessionPageSwitchSeq(sessionId: string): void {
  sessionSequenceMap.delete(sessionId);
}

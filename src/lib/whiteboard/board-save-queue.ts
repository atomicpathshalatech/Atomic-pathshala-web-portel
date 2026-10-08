/**
 * Saving the teacher's board, one request at a time.
 *
 * The canvas engine keeps ONE objects array per slide and pushes every new
 * stroke into it, so "is this the array I already saved?" can never tell
 * whether there is new ink — that check silently skipped every pen stroke
 * after the first one, and the server (students joining late, the notes PDF,
 * a reload on another device) was left without them. Here every change gets
 * a number instead, and a slide stays "unsaved" until the save that carried
 * its newest change has succeeded.
 *
 * - one request in flight; ink drawn meanwhile goes out in the next one
 * - flush() resolves only when nothing is left to send (or sending failed),
 *   so "save, then leave the slide" really has saved
 * - each slide is saved to ITSELF, whichever slide is on screen by then
 * - a failed save is retried by itself (2 s, 4 s, 8 s, then every 15 s)
 */

export type BoardSaveResult =
  | { ok: true; version: number }
  /** conflictVersion: the slide moved on elsewhere — adopt it and resend.
   *  gone: the slide no longer exists. Neither: the server refused the save. */
  | { ok: false; conflictVersion?: number; gone?: boolean };

export type BoardSaveState = "saving" | "saved" | "offline";

export interface BoardSaveQueueOptions<T> {
  /** Must serialise `objects` before its first await (the array is live). Throws when the network is down. */
  send: (pageId: string, objects: T[], baseVersion: number | undefined) => Promise<BoardSaveResult>;
  onSaved: (pageId: string, objects: T[], version: number) => void;
  onState: (state: BoardSaveState) => void;
  /** The version the slide was loaded with, until this queue has saved it once. */
  baseVersionOf: (pageId: string) => number | undefined;
}

export function boardSaveRetryDelayMs(failures: number): number {
  return Math.min(15_000, 1000 * 2 ** Math.min(Math.max(failures, 1), 4));
}

export class BoardSaveQueue<T> {
  private dirty = new Map<string, { objects: T[]; rev: number }>();
  private versions: Record<string, number> = {};
  private rev = 0;
  private running: Promise<void> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  private disposed = false;

  constructor(private readonly opts: BoardSaveQueueOptions<T>) {}

  markDirty(pageId: string, objects: T[]): void {
    this.dirty.set(pageId, { objects, rev: ++this.rev });
    this.opts.onState("saving");
  }

  get unsavedPageIds(): string[] {
    return Array.from(this.dirty.keys());
  }

  flush(): Promise<void> {
    if (!this.running) {
      this.running = this.drain().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  dispose(): void {
    this.disposed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private async drain(): Promise<void> {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    const refused = new Set<string>();
    let conflicts = 0;
    for (;;) {
      const next = Array.from(this.dirty.entries()).find(([id]) => !refused.has(id));
      if (!next) break;
      const [pageId, { objects, rev }] = next;
      let result: BoardSaveResult;
      try {
        result = await this.opts.send(pageId, objects, this.versions[pageId] ?? this.opts.baseVersionOf(pageId));
      } catch {
        return this.failed();
      }
      if (result.ok) {
        conflicts = 0;
        this.versions[pageId] = result.version;
        // Ink drawn while this request was in flight keeps the slide unsaved.
        if (this.dirty.get(pageId)?.rev === rev) this.dirty.delete(pageId);
        this.opts.onSaved(pageId, objects, result.version);
        continue;
      }
      if (result.gone) {
        this.dirty.delete(pageId);
        continue;
      }
      if (result.conflictVersion != null) {
        this.versions[pageId] = result.conflictVersion;
        if (conflicts < 3) {
          conflicts++;
          continue;
        }
      }
      conflicts = 0;
      refused.add(pageId); // the other slides still get saved
    }
    if (refused.size > 0) return this.failed();
    this.failures = 0;
    this.opts.onState("saved");
  }

  private failed(): void {
    this.opts.onState("offline");
    if (this.disposed) return;
    this.failures++;
    this.retryTimer = setTimeout(() => void this.flush(), boardSaveRetryDelayMs(this.failures));
  }
}

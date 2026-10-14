/**
 * One undo/redo history for the whole live board.
 *
 * Ctrl+Z steps back through everything the teacher did, one action per press
 * and in order: ink on any slide and slide changes — new, duplicated,
 * deleted, moved. The ink itself is undone by the canvas engine (each slide
 * keeps its own steps); this only remembers WHICH slide each ink step was on,
 * so undoing ink on another slide opens that slide first.
 *
 * A deleted slide comes back with a new id; the history points the old id at
 * the new one so earlier steps on that slide still find it.
 *
 * No React or DOM here: the live room passes in the actions (BoardHistoryOps).
 */

export type SlideSnapshot<O = unknown> = { pageNumber: number; background?: string; objects: O[] };

export type BoardStep<O = unknown> =
  | { kind: "ink"; pageId: string }
  | { kind: "slide-add"; pageId: string; snapshot?: SlideSnapshot<O> }
  | { kind: "slide-delete"; pageId: string; snapshot: SlideSnapshot<O> }
  | { kind: "slide-order"; before: string[]; after: string[] };

export interface BoardHistoryOps<O = unknown> {
  /** Opens the slide if needed and undoes/redoes one ink step there; false if there was none. */
  inkStep(pageId: string, dir: "undo" | "redo"): Promise<boolean>;
  /** Deletes the slide; returns what is needed to bring it back, or null if it cannot be deleted. */
  removeSlide(pageId: string): Promise<SlideSnapshot<O> | null>;
  /** Brings a slide back at its old place; returns the new slide's id. */
  restoreSlide(snapshot: SlideSnapshot<O>, oldId: string): Promise<string>;
  /** The slide ids in order right now. */
  currentOrder(): string[];
  applyOrder(ids: string[]): Promise<void>;
  hasSlide(pageId: string): boolean;
}

export const BOARD_HISTORY_LIMIT = 300;

export class BoardHistory<O = unknown> {
  undoSteps: BoardStep<O>[] = [];
  redoSteps: BoardStep<O>[] = [];
  private alias = new Map<string, string>();
  private busy = false;

  get canUndo(): boolean {
    return this.undoSteps.length > 0;
  }

  get canRedo(): boolean {
    return this.redoSteps.length > 0;
  }

  /** A new action: it can be undone, and anything that was undone can no longer be redone. */
  record(step: BoardStep<O>): void {
    this.undoSteps.push(step);
    if (this.undoSteps.length > BOARD_HISTORY_LIMIT) this.undoSteps.shift();
    this.redoSteps = [];
  }

  /** The slide's id now (after it was deleted and brought back, possibly more than once). */
  liveId(id: string): string {
    let cur = id;
    for (let i = 0; i < 50 && this.alias.has(cur); i++) cur = this.alias.get(cur)!;
    return cur;
  }

  clear(): void {
    this.undoSteps = [];
    this.redoSteps = [];
    this.alias.clear();
  }

  /**
   * Undoes (or redoes) one action. Steps that no longer apply (their slide is
   * gone, the engine dropped them) are skipped, so one press always does one
   * real thing when there is one. If the server refuses, the step stays and
   * the error is thrown. Returns false when another step is still running.
   */
  async step(dir: "undo" | "redo", ops: BoardHistoryOps<O>): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    const from = dir === "undo" ? this.undoSteps : this.redoSteps;
    const to = dir === "undo" ? this.redoSteps : this.undoSteps;
    try {
      let step: BoardStep<O> | undefined;
      while ((step = from.pop())) {
        let done: BoardStep<O> | null;
        try {
          done = await this.run(step, dir, ops);
        } catch (err) {
          from.push(step);
          throw err;
        }
        if (done) {
          to.push(done);
          return true;
        }
      }
      return true;
    } finally {
      this.busy = false;
    }
  }

  private async run(step: BoardStep<O>, dir: "undo" | "redo", ops: BoardHistoryOps<O>): Promise<BoardStep<O> | null> {
    switch (step.kind) {
      case "ink": {
        const pageId = this.liveId(step.pageId);
        if (!ops.hasSlide(pageId)) return null;
        return (await ops.inkStep(pageId, dir)) ? { kind: "ink", pageId } : null;
      }
      case "slide-add": {
        if (dir === "undo") {
          const pageId = this.liveId(step.pageId);
          if (!ops.hasSlide(pageId)) return null;
          const snapshot = await ops.removeSlide(pageId);
          return snapshot ? { kind: "slide-add", pageId, snapshot } : null;
        }
        if (!step.snapshot) return null;
        await this.restore(step.pageId, step.snapshot, ops);
        return { kind: "slide-add", pageId: step.pageId };
      }
      case "slide-delete": {
        if (dir === "undo") {
          await this.restore(step.pageId, step.snapshot, ops);
          return step;
        }
        const pageId = this.liveId(step.pageId);
        if (!ops.hasSlide(pageId)) return null;
        const snapshot = await ops.removeSlide(pageId);
        return snapshot ? { kind: "slide-delete", pageId, snapshot } : null;
      }
      case "slide-order": {
        const wanted = (dir === "undo" ? step.before : step.after).map((id) => this.liveId(id));
        const current = ops.currentOrder();
        const order = [...wanted.filter((id) => current.includes(id)), ...current.filter((id) => !wanted.includes(id))];
        await ops.applyOrder(order);
        return step;
      }
    }
  }

  private async restore(oldId: string, snapshot: SlideSnapshot<O>, ops: BoardHistoryOps<O>) {
    const deletedId = this.liveId(oldId);
    this.alias.set(deletedId, await ops.restoreSlide(snapshot, deletedId));
  }
}

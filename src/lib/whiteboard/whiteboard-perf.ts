/**
 * Whiteboard Drawing Pipeline Performance Instrumentation.
 *
 * Measures:
 * 1. FPS & Frame Times (average, p95, maximum)
 * 2. Pointer Event Frequency (events/sec)
 * 3. Pointer Event Processing Latency (ms)
 * 4. Active Stroke Rendering Duration (ms)
 * 5. Stroke & Point Counts
 * 6. React Render Count
 * 7. Autosave Execution Time & Queue Depth
 * 8. Memory Usage (where window.performance.memory is available)
 */

export interface WhiteboardPerfMetrics {
  fps: number;
  avgFrameTimeMs: number;
  p95FrameTimeMs: number;
  maxFrameTimeMs: number;
  pointerEventsPerSec: number;
  lastPointerProcessMs: number;
  lastRenderDurationMs: number;
  activeStrokesCount: number;
  activePointsCount: number;
  reactRenderCount: number;
  autosaveQueueSize: number;
  lastAutosaveDurationMs: number;
  memoryUsedMb: number | null;
  memoryLimitMb: number | null;
}

class WhiteboardPerformanceMonitor {
  private frameTimes: number[] = [];
  private lastFrameTimestamp = 0;
  private rafId: number | null = null;

  // Pointer event metrics
  private pointerEventTimes: number[] = [];
  private lastPointerProcessDuration = 0;

  // Render metrics
  private lastRenderDuration = 0;

  // Counts
  private activeStrokes = 0;
  private activePoints = 0;
  private reactRenders = 0;

  // Autosave
  private queueSize = 0;
  private lastAutosaveDuration = 0;

  // Listeners
  private listeners = new Set<(metrics: WhiteboardPerfMetrics) => void>();
  private notifyInterval: ReturnType<typeof setInterval> | null = null;

  private isRunning = false;

  public start(): void {
    if (this.isRunning || typeof window === "undefined") return;
    this.isRunning = true;
    this.lastFrameTimestamp = performance.now();

    const loop = (timestamp: number) => {
      if (!this.isRunning) return;
      const delta = timestamp - this.lastFrameTimestamp;
      this.lastFrameTimestamp = timestamp;

      if (delta > 0 && delta < 1000) {
        this.frameTimes.push(delta);
        if (this.frameTimes.length > 120) {
          this.frameTimes.shift();
        }
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);

    // Clean old pointer timestamps periodically and broadcast metrics
    this.notifyInterval = setInterval(() => {
      const now = performance.now();
      const oneSecAgo = now - 1000;
      this.pointerEventTimes = this.pointerEventTimes.filter((t) => t >= oneSecAgo);

      this.emitMetrics();
    }, 250);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.notifyInterval !== null) {
      clearInterval(this.notifyInterval);
      this.notifyInterval = null;
    }
  }

  public recordPointerEvent(durationMs: number): void {
    const now = performance.now();
    this.pointerEventTimes.push(now);
    this.lastPointerProcessDuration = durationMs;
  }

  public recordRenderDuration(durationMs: number): void {
    this.lastRenderDuration = durationMs;
  }

  public updateCounts(strokes: number, points: number): void {
    this.activeStrokes = strokes;
    this.activePoints = points;
  }

  public recordReactRender(): void {
    this.reactRenders++;
  }

  public updateAutosave(queueDepth: number, durationMs?: number): void {
    this.queueSize = queueDepth;
    if (durationMs !== undefined) {
      this.lastAutosaveDuration = durationMs;
    }
  }

  public subscribe(cb: (metrics: WhiteboardPerfMetrics) => void): () => void {
    this.listeners.add(cb);
    cb(this.getSnapshot());
    return () => {
      this.listeners.delete(cb);
    };
  }

  public getSnapshot(): WhiteboardPerfMetrics {
    const n = this.frameTimes.length;
    let avg = 0;
    let max = 0;
    let p95 = 0;
    let fps = 0;

    if (n > 0) {
      const sum = this.frameTimes.reduce((acc, t) => acc + t, 0);
      avg = sum / n;
      fps = avg > 0 ? Math.round(1000 / avg) : 0;
      const sorted = [...this.frameTimes].sort((a, b) => a - b);
      max = sorted[sorted.length - 1] ?? 0;
      const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
      p95 = sorted[p95Idx] ?? 0;
    }

    // Memory info
    let memUsed: number | null = null;
    let memLimit: number | null = null;
    if (typeof window !== "undefined" && (window.performance as any)?.memory) {
      const mem = (window.performance as any).memory;
      memUsed = Math.round(mem.usedJSHeapSize / (1024 * 1024));
      memLimit = Math.round(mem.jsHeapSizeLimit / (1024 * 1024));
    }

    return {
      fps,
      avgFrameTimeMs: Math.round(avg * 10) / 10,
      p95FrameTimeMs: Math.round(p95 * 10) / 10,
      maxFrameTimeMs: Math.round(max * 10) / 10,
      pointerEventsPerSec: this.pointerEventTimes.length,
      lastPointerProcessMs: Math.round(this.lastPointerProcessDuration * 100) / 100,
      lastRenderDurationMs: Math.round(this.lastRenderDuration * 100) / 100,
      activeStrokesCount: this.activeStrokes,
      activePointsCount: this.activePoints,
      reactRenderCount: this.reactRenders,
      autosaveQueueSize: this.queueSize,
      lastAutosaveDurationMs: Math.round(this.lastAutosaveDuration),
      memoryUsedMb: memUsed,
      memoryLimitMb: memLimit,
    };
  }

  private emitMetrics(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {}
    }
  }
}

export const whiteboardPerf = new WhiteboardPerformanceMonitor();

/**
 * ATOMIC PATHSHALA — PRIORITY REQUEST QUEUE & CONCURRENCY LIMITER
 * Ensures students are never blocked by heavy background PDF imports.
 */

import { AIRequestPriority } from "./types";

interface QueuedTask<T> {
  id: string;
  priority: AIRequestPriority;
  enqueuedAt: number;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (err: any) => void;
}

export class AIRequestQueue {
  private static instance: AIRequestQueue;
  private queue: QueuedTask<any>[] = [];
  private activeConcurrency = 0;
  private maxConcurrency = 6; // Bounded server-wide concurrency to preserve TPM/RPM

  private stats = {
    totalQueued: 0,
    totalProcessed: 0,
    peakQueueDepth: 0,
  };

  private constructor() {}

  public static getInstance(): AIRequestQueue {
    if (!AIRequestQueue.instance) {
      AIRequestQueue.instance = new AIRequestQueue();
    }
    return AIRequestQueue.instance;
  }

  public async schedule<T>(
    priority: AIRequestPriority,
    task: () => Promise<T>,
    taskId: string = Math.random().toString(36).substring(7)
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const item: QueuedTask<T> = {
        id: taskId,
        priority,
        enqueuedAt: Date.now(),
        execute: task,
        resolve,
        reject,
      };

      this.queue.push(item);
      // Sort: Priority 1 first, then by earliest arrival time
      this.queue.sort((a, b) => a.priority - b.priority || a.enqueuedAt - b.enqueuedAt);

      this.stats.totalQueued++;
      if (this.queue.length > this.stats.peakQueueDepth) {
        this.stats.peakQueueDepth = this.queue.length;
      }

      this.drain();
    });
  }

  private drain(): void {
    if (this.activeConcurrency >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.activeConcurrency++;

    task
      .execute()
      .then((res) => {
        task.resolve(res);
      })
      .catch((err) => {
        task.reject(err);
      })
      .finally(() => {
        this.activeConcurrency--;
        this.stats.totalProcessed++;
        this.drain();
      });
  }

  public getQueueStats() {
    return {
      pendingTasks: this.queue.length,
      activeConcurrency: this.activeConcurrency,
      maxConcurrency: this.maxConcurrency,
      ...this.stats,
    };
  }

  public setMaxConcurrency(n: number) {
    if (n >= 1 && n <= 20) {
      this.maxConcurrency = n;
      this.drain();
    }
  }
}

export const aiRequestQueue = AIRequestQueue.getInstance();

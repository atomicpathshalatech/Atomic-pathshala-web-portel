/**
 * Browser side of the recorded-lecture upload: the file goes straight from
 * the browser to the recorded-lecture R2 bucket in parts, through short-lived
 * signed URLs from /api/team/recorded-lectures/[id]/upload. Only one part
 * at a time per worker is in memory (File.slice), never the whole video.
 *
 * - 3 parts in flight; a failed part is retried 4 times with backoff
 * - pause() stops after the parts in flight; resume() continues
 * - a page refresh / new tab resumes: init with the same file returns the
 *   parts R2 already has, and only the rest are sent
 * - cancel() aborts the upload on the server (its parts are discarded)
 *
 * Needs the bucket's CORS policy to allow PUT from the site and expose ETag.
 */

export type UploadProgress = {
  phase: "preparing" | "uploading" | "paused" | "finishing" | "done" | "failed" | "cancelled";
  uploadedBytes: number;
  totalBytes: number;
  partsDone: number;
  partsTotal: number;
  message?: string;
};

type Part = { partNumber: number; etag: string };

async function api<T>(lectureId: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/team/recorded-lectures/${lectureId}/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(typeof json.error === "string" ? json.error : `Request failed (${res.status})`);
  return json.data as T;
}

/** Reads the video's length in the browser (seconds), or null. */
export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    const done = (d: number | null) => {
      URL.revokeObjectURL(url);
      resolve(d && Number.isFinite(d) && d > 0 ? Math.round(d) : null);
    };
    v.onloadedmetadata = () => done(v.duration);
    v.onerror = () => done(null);
    setTimeout(() => done(null), 15000);
    v.src = url;
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class RecordedVideoUploader {
  private paused = false;
  private cancelled = false;
  private done = new Map<number, Part>();
  private inFlightBytes = new Map<number, number>();
  private partSize = 0;
  private partCount = 0;

  constructor(
    private lectureId: string,
    private file: File,
    private onProgress: (p: UploadProgress) => void
  ) {}

  private report(phase: UploadProgress["phase"], message?: string) {
    let uploaded = 0;
    for (const n of this.done.keys()) uploaded += this.partBytes(n);
    for (const b of this.inFlightBytes.values()) uploaded += b;
    this.onProgress({
      phase,
      uploadedBytes: Math.min(uploaded, this.file.size),
      totalBytes: this.file.size,
      partsDone: this.done.size,
      partsTotal: this.partCount,
      message,
    });
  }

  private partBytes(n: number) {
    const start = (n - 1) * this.partSize;
    return Math.max(0, Math.min(this.partSize, this.file.size - start));
  }

  /** Starts (or resumes) the upload; resolves when the video is verified. */
  async start(): Promise<boolean> {
    this.paused = false;
    this.cancelled = false;
    this.report("preparing", "Checking the file…");
    try {
      const durationSec = await readVideoDuration(this.file);
      const init = await api<{ partSize: number; partCount: number; uploadedParts: Part[]; resumed: boolean }>(this.lectureId, {
        action: "init",
        fileName: this.file.name,
        size: this.file.size,
        type: this.file.type,
        durationSec,
      });
      this.partSize = init.partSize;
      this.partCount = init.partCount;
      this.done = new Map(init.uploadedParts.map((p) => [p.partNumber, p]));
      return await this.run(init.resumed ? "Resuming the earlier upload…" : undefined);
    } catch (err) {
      this.report("failed", (err as Error).message);
      return false;
    }
  }

  /** Continues after pause() or a network failure (only missing parts are sent). */
  async resume(): Promise<boolean> {
    if (!this.partCount) return this.start();
    this.paused = false;
    try {
      const { parts } = await api<{ parts: Part[] }>(this.lectureId, { action: "parts" });
      for (const p of parts) this.done.set(p.partNumber, p);
      return await this.run();
    } catch (err) {
      this.report("failed", (err as Error).message);
      return false;
    }
  }

  pause() {
    this.paused = true;
  }

  async cancel() {
    this.cancelled = true;
    this.paused = true;
    await api(this.lectureId, { action: "abort" }).catch(() => null);
    this.report("cancelled", "Upload cancelled.");
  }

  private async run(message?: string): Promise<boolean> {
    this.report("uploading", message);
    const queue = Array.from({ length: this.partCount }, (_, i) => i + 1).filter((n) => !this.done.has(n));
    let failure: Error | null = null;

    const worker = async () => {
      while (queue.length && !this.paused && !failure) {
        const batch = queue.splice(0, 1);
        const partNumber = batch[0]!;
        try {
          await this.uploadPart(partNumber);
        } catch (err) {
          failure = err as Error;
          queue.unshift(partNumber);
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);

    if (this.cancelled) return false;
    if (failure) {
      this.report("failed", `${(failure as Error).message} — press Resume to continue; finished parts are kept.`);
      return false;
    }
    if (this.paused) {
      this.report("paused", "Paused. Finished parts are kept.");
      return false;
    }

    this.report("finishing", "Checking the uploaded video…");
    try {
      await api(this.lectureId, {
        action: "complete",
        parts: Array.from(this.done.values()).sort((a, b) => a.partNumber - b.partNumber),
      });
      this.report("done", "Uploaded and verified.");
      return true;
    } catch (err) {
      this.report("failed", (err as Error).message);
      return false;
    }
  }

  private async uploadPart(partNumber: number) {
    const start = (partNumber - 1) * this.partSize;
    const blob = this.file.slice(start, Math.min(start + this.partSize, this.file.size));
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (this.paused) throw new Error("Paused");
      try {
        // A fresh signed URL each attempt — an old one may have expired.
        const { urls } = await api<{ urls: { partNumber: number; url: string }[] }>(this.lectureId, { action: "sign", partNumbers: [partNumber] });
        const etag = await this.put(urls[0]!.url, blob, partNumber);
        this.done.set(partNumber, { partNumber, etag });
        this.inFlightBytes.delete(partNumber);
        this.report("uploading");
        return;
      } catch (err) {
        lastError = err;
        this.inFlightBytes.delete(partNumber);
        await sleep(Math.min(15000, 1000 * 2 ** attempt));
      }
    }
    throw new Error(`Part ${partNumber} could not be uploaded (${(lastError as Error)?.message ?? "network error"})`);
  }

  private put(url: string, blob: Blob, partNumber: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.upload.onprogress = (e) => {
        this.inFlightBytes.set(partNumber, e.loaded);
        this.report("uploading");
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader("ETag");
          if (!etag) reject(new Error("Storage did not return the part's ETag (bucket CORS must expose ETag)"));
          else resolve(etag);
        } else reject(new Error(`Storage refused the part (HTTP ${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.ontimeout = () => reject(new Error("Timed out"));
      xhr.timeout = 10 * 60 * 1000;
      xhr.send(blob);
    });
  }
}

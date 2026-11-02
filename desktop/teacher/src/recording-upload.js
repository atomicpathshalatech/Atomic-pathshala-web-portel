"use strict";

/**
 * Class recordings: while streaming, the encoder also writes the class to
 * part files (encoder.js, recordPath — one per FFmpeg run). After the class
 * this module joins the parts, makes a lighter 720p MP4 (fast start, plays
 * while downloading) and uploads it to the class on the Atomic site in 16 MB
 * parts (/api/team/live-class/<id>/recording-upload). Students' "Play Class"
 * then plays it in Atomic's own player instead of YouTube.
 *
 * Jobs are kept in <userData>/recordings/pending.json, so an upload that the
 * app was closed in the middle of carries on (from the last finished part)
 * the next time the app opens. Local files are deleted once the class has
 * the recording.
 */

const { app, session, BrowserWindow } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { appUrl, isTrustedUrl } = require("./config");
const { buildArchiveArgs } = require("./encoder");

const PART_BYTES = 16 * 1024 * 1024;
let working = false;
let ffmpegBin = null;

const recordingsRoot = () => path.join(app.getPath("userData"), "recordings");
const jobsFile = () => path.join(recordingsRoot(), "pending.json");

function log(line) {
  try {
    const dir = path.join(app.getPath("userData"), "logs");
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, `recording-${new Date().toISOString().slice(0, 10)}.log`), `${new Date().toISOString()} ${line}\n`);
  } catch {
    // logging never breaks the upload
  }
}

function status(payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    const wc = win.webContents;
    if (!wc.isDestroyed() && isTrustedUrl(wc.getURL())) wc.send("recording:status", payload);
  }
}

function readJobs() {
  try {
    return JSON.parse(fs.readFileSync(jobsFile(), "utf8"));
  } catch {
    return [];
  }
}
function writeJobs(jobs) {
  fs.mkdirSync(recordingsRoot(), { recursive: true });
  fs.writeFileSync(jobsFile(), JSON.stringify(jobs, null, 2));
}
function updateJob(dir, patch) {
  const jobs = readJobs().map((j) => (j.dir === dir ? { ...j, ...patch } : j));
  writeJobs(jobs);
  return jobs.find((j) => j.dir === dir);
}

/** A fresh folder for one class run's part files. */
function newRecordingDir(scheduleId, runId) {
  const dir = path.join(recordingsRoot(), String(scheduleId).replace(/[^a-zA-Z0-9_-]/g, ""), runId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** After the class: queue its recording for joining + upload (and start if idle). */
function queueRecording({ scheduleId, dir, encoder }) {
  if (!scheduleId || !dir || !fs.existsSync(dir)) return;
  const jobs = readJobs();
  if (!jobs.some((j) => j.dir === dir)) jobs.push({ scheduleId, dir, encoder: encoder || "libopenh264", stage: "JOIN", createdAt: new Date().toISOString() });
  writeJobs(jobs);
  void work();
}

function run(args) {
  return new Promise((resolve) => {
    const p = spawn(ffmpegBin, args, { windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => {
      err = (err + d.toString()).slice(-4000);
    });
    p.on("exit", (code) => resolve({ code, err }));
    p.on("error", (e) => resolve({ code: -1, err: String(e) }));
  });
}

async function durationOf(file) {
  const { err } = await run(["-hide_banner", "-i", file]);
  const m = err.match(/Duration:\s*(\d+):(\d+):(\d+)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

/** fetch with the signed-in teacher's cookies (the app's own session). */
async function siteFetch(pathname, body) {
  const base = appUrl();
  const cookies = await session.defaultSession.cookies.get({ url: base.origin });
  const res = await fetch(new URL(pathname, base).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; ") },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data;
}

async function processJob(job) {
  const parts = fs.readdirSync(job.dir).filter((f) => /^part-\d+\.mkv$/.test(f)).sort();
  const joined = path.join(job.dir, "joined.mkv");
  const out = path.join(job.dir, "class.mp4");

  if (job.stage === "JOIN") {
    const total = parts.reduce((s, f) => s + fs.statSync(path.join(job.dir, f)).size, 0);
    if (parts.length === 0 || total < 512 * 1024) {
      log(`skip ${job.scheduleId}: nothing recorded`);
      return "DONE";
    }
    status({ scheduleId: job.scheduleId, state: "PREPARING" });
    fs.writeFileSync(path.join(job.dir, "list.txt"), parts.map((f) => `file '${path.join(job.dir, f).replace(/\\/g, "/")}'`).join("\n"));
    const j = await run(["-hide_banner", "-y", "-f", "concat", "-safe", "0", "-i", path.join(job.dir, "list.txt"), "-c", "copy", joined]);
    if (j.code !== 0) throw new Error(`join failed: ${j.err.slice(-300)}`);
    const t = await run(["-hide_banner", "-y", "-i", joined, ...buildArchiveArgs({ encoder: job.encoder || "libopenh264" }), out]);
    if (t.code !== 0) throw new Error(`720p failed: ${t.err.slice(-300)}`);
    job = updateJob(job.dir, { stage: "UPLOAD", durationSeconds: await durationOf(out), uploaded: [] });
  }

  if (job.stage === "UPLOAD") {
    if (!job.uploadId) job = updateJob(job.dir, await siteFetch(`/api/team/live-class/${job.scheduleId}/recording-upload`, { action: "init" }));
    const size = fs.statSync(out).size;
    const count = Math.ceil(size / PART_BYTES);
    const done = new Map((job.uploaded || []).map((p) => [p.PartNumber, p.ETag]));
    const fd = fs.openSync(out, "r");
    try {
      for (let n = 1; n <= count; n++) {
        if (done.has(n)) continue;
        const length = Math.min(PART_BYTES, size - (n - 1) * PART_BYTES);
        const buf = Buffer.alloc(length);
        fs.readSync(fd, buf, 0, length, (n - 1) * PART_BYTES);
        let etag = null;
        for (let attempt = 1; attempt <= 4 && !etag; attempt++) {
          try {
            const { url } = await siteFetch(`/api/team/live-class/${job.scheduleId}/recording-upload`, { action: "part", key: job.key, uploadId: job.uploadId, partNumber: n });
            const res = await fetch(url, { method: "PUT", body: buf });
            if (!res.ok) throw new Error(`part ${n}: HTTP ${res.status}`);
            etag = res.headers.get("etag");
          } catch (e) {
            log(`part ${n} attempt ${attempt} failed: ${e.message}`);
            await new Promise((r) => setTimeout(r, attempt * 5000));
          }
        }
        if (!etag) throw new Error(`part ${n} could not be uploaded`);
        done.set(n, etag);
        updateJob(job.dir, { uploaded: Array.from(done, ([PartNumber, ETag]) => ({ PartNumber, ETag })) });
        status({ scheduleId: job.scheduleId, state: "UPLOADING", percent: Math.round((done.size / count) * 100) });
      }
    } finally {
      fs.closeSync(fd);
    }
    await siteFetch(`/api/team/live-class/${job.scheduleId}/recording-upload`, {
      action: "complete",
      key: job.key,
      uploadId: job.uploadId,
      parts: Array.from(done, ([PartNumber, ETag]) => ({ PartNumber, ETag })),
      durationSeconds: job.durationSeconds || undefined,
    });
    log(`uploaded ${job.scheduleId} (${Math.round(size / 1048576)} MB)`);
    status({ scheduleId: job.scheduleId, state: "READY" });
    return "DONE";
  }
  return "DONE";
}

async function work() {
  if (working || !ffmpegBin) return;
  working = true;
  try {
    for (;;) {
      const job = readJobs().find((j) => !j.failedAt || Date.now() - Date.parse(j.failedAt) > 10 * 60_000);
      if (!job) break;
      try {
        await processJob(job);
        writeJobs(readJobs().filter((j) => j.dir !== job.dir));
        fs.rmSync(job.dir, { recursive: true, force: true });
      } catch (e) {
        log(`job ${job.scheduleId} failed: ${e.message}`);
        status({ scheduleId: job.scheduleId, state: "FAILED" });
        updateJob(job.dir, { failedAt: new Date().toISOString(), error: String(e.message).slice(0, 300) });
        break; // retried later (next app start, or 10 minutes on)
      }
    }
  } finally {
    working = false;
  }
}

/** Called once at app start: remembers FFmpeg, resumes unfinished uploads. */
function initRecordingUploads({ ffmpegPath }) {
  ffmpegBin = ffmpegPath;
  setTimeout(() => void work(), 15_000);
  setInterval(() => void work(), 10 * 60_000).unref?.();
}

module.exports = { newRecordingDir, queueRecording, initRecordingUploads };

# Recorded lectures — setup

Recorded lectures (Team → Teaching → **Recorded Lectures**) are stored in a
**separate Cloudflare account and R2 bucket**. The main storage (`R2_*`,
`CLOUDFLARE_ACCOUNT_ID`) is never used for them, and the app refuses a
configuration that points at the main account, key or bucket.

## 1. Database

Run the migration once (new tables only — existing tables are not changed):

```
npx prisma migrate deploy
```

It applies `prisma/migrations/20261029120000_recorded_lectures`
(`recorded_lecture_media`, `lecture_abouts`, `lecture_summaries` and two enums).

## 2. The new Cloudflare account

1. Create the new Cloudflare account and an R2 bucket in it (e.g.
   `atomic-recorded-lectures`). Leave **public access off** — videos are
   served only through short-lived signed URLs.
2. R2 → Manage API tokens → create a token with **Object Read & Write**
   for that bucket only.
3. Set on Vercel (Production + Preview):

| Variable | Value |
|---|---|
| `RECORDED_R2_ACCOUNT_ID` | the new account's id |
| `RECORDED_R2_ACCESS_KEY_ID` | the token's access key id |
| `RECORDED_R2_SECRET_ACCESS_KEY` | the token's secret |
| `RECORDED_R2_BUCKET_NAME` | the bucket name |
| `RECORDED_R2_ENDPOINT` | optional (default `https://<account>.r2.cloudflarestorage.com`) |
| `RECORDED_LECTURE_MAX_BYTES` | optional upload limit (default 10 GiB) |

Until these are set, the Recorded Lectures page shows exactly which setting is
missing and uploads stay off.

## 3. Bucket CORS (needed for browser uploads and playback)

R2 → bucket → Settings → CORS policy:

```json
[
  {
    "AllowedOrigins": ["https://ap.atomicpathshala.in"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["content-type", "range"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"],
    "MaxAgeSeconds": 3600
  }
]
```

`ETag` must be exposed — the uploader needs it to finish a multipart upload.
Add other origins (preview deployments, localhost) if you upload from them.

## 4. Abandoned uploads

The daily cron `/api/cron/recorded-lectures/reconcile` aborts uploads left
unfinished for 24 h and finishes uploads whose last step was interrupted.
As a second safety net, add an R2 lifecycle rule on the bucket:
**Abort incomplete multipart uploads after 1 day**.

## 5. Permissions

- Upload / publish / archive: Admin and Super Admin (they hold every
  permission). Others can be given `recorded_lecture.manage` in Roles &
  Permissions.
- About + lecture summary: the lecture's own teacher, or an admin.
- Students: only published lectures with a verified video, of a batch they
  are actively enrolled in.

## 6. Video format

MP4 (H.264/AAC) plays everywhere. For quick start of playback, export with the
"fast start" / "web optimised" option (moov atom at the start). Uploaded files
are played as they are — there is no transcoding or HLS.

## AI audio (हिंदी / English), subtitles and summary from the video

On a lecture's page (team portal), **Process with AI** (Admin / Super Admin) runs a background pass:

1. The video is copied from the recorded-lecture bucket to the Gemini Files API (max 2 GB).
2. Gemini writes down what the teacher says (timed) and what is written on the board, 10 minutes at a time.
3. The transcript is translated in NCERT terms: English lecture → Hindi, Hindi lecture → English, mixed → both.
4. An AI voice (Gemini TTS) is recorded in ~25-second clips, stored next to the video under `<lecture>/ai/<attempt>/<lang>/`.

Students then get **Audio: Original / हिंदी (AI) / English (AI)** and **Subtitles** in the player. The voice is
an AI voice, synced sentence by sentence (each clip starts at its sentence's time, 0.9–1.35× speed to fit).

The pass resumes itself (hand-over between invocations, the status poll on the lecture page, the daily
reconcile cron) and waits out AI quota limits. A 1-hour lecture takes roughly 15–40 minutes and needs paid
Gemini quota for TTS.

Summaries: **Create summary from video** (speech + board, unlocks after the transcript is ready),
**Summary from About** (as before), and **Translate to हिंदी / English** (NCERT terms; every heading, point and
formula must survive or the translation is refused). Each language has its own approve → publish line;
publishing a Hindi summary does not hide the English one.

Database: migration `20261030120000_lecture_ai` (new `lecture_ai_jobs` table, `lecture_summaries.source` column).
Run it **before** deploying this code.

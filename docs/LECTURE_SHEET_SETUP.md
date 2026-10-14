# Lecture ↔ YouTube Google Sheet

One row per scheduled class. The app writes the class details; a person types
the YouTube link; the app checks the link and links the video to that class.

| Columns | Written by |
|---|---|
| A `lecture_id` … M `class_mode`, S `recording_status`, T `sync_status`, U `last_synced_at` | the app (overwritten on every sync) |
| N `youtube_video_id`, O `youtube_video_url`, P `youtube_live_url`, Q `youtube_channel`, R `video_visibility`, V `notes` | a person (the app only fills them while empty, from the class's own video) |

`lecture_id` is the class id in Atomic Pathshala — never match by title.

## How it syncs (not instant)

* **App → Sheet:** every 30 minutes (the Sheet's Apps Script timer `syncEvery30Minutes`, plus a once-a-day Vercel cron `/api/cron/lecture-sheet` as a backup — this Vercel plan allows only daily crons) new and edited
  classes (last 90 days and future) are written; a row is found again by
  `lecture_id`, so an edit updates the same row. Failed rows are retried.
  Team users can also run it at once: `POST /api/team/lecture-sheet`.
* **Sheet → App:** the Apps Script sends a row as soon as someone edits N–P
  (a few seconds). The 30-minute sync also reads N–P, so an edit the script
  missed is still applied.
* A link is applied only when: the `lecture_id` is a class, the text is a
  YouTube video link/id, id and links in the row name the same video, the
  video exists and allows embedding (checked with YouTube oEmbed — no quota),
  and it does not replace the class's own live video. Otherwise nothing changes
  and `sync_status` says `REJECTED: <reason>`. Every attempt is logged
  (`lecture_video_mappings`).
* `recording_status`: `SCHEDULED` / `LIVE` / `NO_VIDEO` / `CANCELLED` /
  `VIDEO_LINKED` (the class's own video, not re-checked) / `READY` (a linked
  video that was checked playable when it was linked). oEmbed cannot tell a
  finished recording from one still processing.

## Setup

1. **Sheet:** use the Sheet, add an empty tab named `Lectures` (or set
   `LECTURE_SHEET_TAB`). The app writes the header row itself.
2. **Google Cloud:** a project → APIs & Services → enable **Google Sheets API**
   → IAM & Admin → Service Accounts → create one → Keys → Add key → JSON.
3. **Share** the Sheet with the service account's `client_email` as **Editor**
   (the team page `GET /api/team/lecture-sheet` shows the email once the key is set).
4. **Vercel → Environment Variables (Production):**
   * `GOOGLE_SERVICE_ACCOUNT_JSON` — the whole JSON key file content
   * `LECTURE_SHEET_ID` — the id in the Sheet URL (between `/d/` and `/edit`)
   * `LECTURE_SHEET_WEBHOOK_SECRET` — a long random string (e.g. `openssl rand -hex 32`)
   * optional `LECTURE_SHEET_TAB` (default `Lectures`)
   Redeploy after adding them.
5. **Apps Script:** in the Sheet, Extensions → Apps Script → paste
   `docs/lecture-sheet/apps-script.gs` → Project Settings → Script properties →
   `LECTURE_SHEET_WEBHOOK_SECRET` = the same value → Triggers → Add trigger →
   `onLectureEdit`, From spreadsheet, On edit → add a second trigger: `syncEvery30Minutes`, Time-driven, Minutes timer, Every 30 minutes → allow the permissions it asks for.
6. **Test both directions:**
   * App → Sheet: create or edit a class, then `POST /api/team/lecture-sheet`
     (or wait for the cron); its row appears / updates, no duplicate.
   * Sheet → App: paste a YouTube link in O of that row; T shows `LINKED <id>`
     within seconds; the class's Play button plays that video. Paste a non-YouTube
     link: T shows `REJECTED: …` and the class is unchanged.

Secrets stay on the server (Vercel env, Script properties). Never put the
service-account key or the webhook secret in the Sheet, in front-end code or in git.

## Limits

* An unlisted YouTube video can be watched by anyone who has its link; the app
  controls who sees the link, YouTube does not enforce it. This is not DRM.
* A class's own live video (an App class broadcast) is never replaced from the
  Sheet; change it in the class itself.

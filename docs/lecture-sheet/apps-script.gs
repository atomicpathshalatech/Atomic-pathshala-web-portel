/**
 * Atomic Pathshala — lecture Sheet → app.
 *
 * When someone types a YouTube link or id in a row (columns N–P), this sends
 * the row to Atomic Pathshala, which checks it and links the video to that
 * class. The answer is written to the row's sync_status (T) and last_synced_at (U).
 *
 * Setup (docs/LECTURE_SHEET_SETUP.md, step 5):
 *   Extensions → Apps Script → paste this file → Project Settings → Script
 *   properties → add LECTURE_SHEET_WEBHOOK_SECRET (the same value as on the server)
 *   → Triggers → Add trigger: onLectureEdit, From spreadsheet, On edit.
 *   (An installable trigger is needed: a simple onEdit cannot call the internet.)
 */
const ENDPOINT = "https://ap.atomicpathshala.in/api/integrations/lecture-sheet";
const TAB = "Lectures";
const FIRST_VIDEO_COL = 14; // N youtube_video_id
const LAST_VIDEO_COL = 16; // P youtube_live_url

function onLectureEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== TAB) return;
  const lastCol = e.range.getColumn() + e.range.getNumColumns() - 1;
  if (e.range.getColumn() > LAST_VIDEO_COL || lastCol < FIRST_VIDEO_COL) return;

  const firstRow = Math.max(2, e.range.getRow());
  const lastRow = e.range.getRow() + e.range.getNumRows() - 1;
  for (let row = firstRow; row <= lastRow; row++) sendRow(sheet, row);
}

function sendRow(sheet, row) {
  const v = sheet.getRange(row, 1, 1, 22).getDisplayValues()[0];
  if (!v[0]) return;
  const body = JSON.stringify({
    lecture_id: v[0],
    youtube_video_id: v[13],
    youtube_video_url: v[14],
    youtube_live_url: v[15],
  });
  const secret = PropertiesService.getScriptProperties().getProperty("LECTURE_SHEET_WEBHOOK_SECRET");
  if (!secret) {
    sheet.getRange(row, 20).setValue("NOT SENT: LECTURE_SHEET_WEBHOOK_SECRET is not set in Script properties");
    return;
  }
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = Utilities.computeHmacSha256Signature(ts + "." + body, secret)
    .map(function (b) { return ("0" + (b & 0xff).toString(16)).slice(-2); })
    .join("");
  let message;
  try {
    const res = UrlFetchApp.fetch(ENDPOINT, {
      method: "post",
      contentType: "application/json",
      payload: body,
      headers: { "x-atomic-timestamp": ts, "x-atomic-signature": sig },
      muteHttpExceptions: true,
    });
    const json = JSON.parse(res.getContentText() || "{}");
    message = json.message || json.error || "HTTP " + res.getResponseCode();
  } catch (err) {
    message = "NOT SENT: " + err + " (the 30-minute sync will pick it up)";
  }
  sheet.getRange(row, 20).setValue(message);
  sheet.getRange(row, 21).setValue(new Date());
}

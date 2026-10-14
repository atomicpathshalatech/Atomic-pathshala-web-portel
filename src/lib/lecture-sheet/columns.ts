/**
 * The lecture-mapping Google Sheet: one row per scheduled class.
 *
 * Columns the APP writes (it overwrites them on every sync): A–M and S–U.
 * Columns a PERSON fills (the app never overwrites a value typed there, it
 * only fills them while empty): N–R and V.
 */
export const LECTURE_SHEET_COLUMNS = [
  "lecture_id", // A — the class's id in Atomic Pathshala (stable; never a title)
  "batch_id", // B
  "batch_name", // C
  "subject", // D
  "chapter_id", // E
  "chapter_name", // F
  "lecture_number", // G
  "lecture_title", // H
  "teacher_id", // I
  "teacher_name", // J
  "scheduled_date", // K (IST)
  "scheduled_time", // L (IST)
  "class_mode", // M — APP_ONLY | APP_AND_YOUTUBE | (empty: not decided yet)
  "youtube_video_id", // N — person
  "youtube_video_url", // O — person
  "youtube_live_url", // P — person
  "youtube_channel", // Q — person
  "video_visibility", // R — person
  "recording_status", // S — app
  "sync_status", // T — app
  "last_synced_at", // U — app
  "notes", // V — person
] as const;

export type LectureSheetColumn = (typeof LECTURE_SHEET_COLUMNS)[number];

export const col = (name: LectureSheetColumn) => LECTURE_SHEET_COLUMNS.indexOf(name);
export const letter = (index: number) => String.fromCharCode(65 + index);
export const LAST_COLUMN = letter(LECTURE_SHEET_COLUMNS.length - 1); // "V"

/** App-owned blocks, written as two ranges so person columns in between are never touched. */
export const APP_BLOCKS: [LectureSheetColumn, LectureSheetColumn][] = [
  ["lecture_id", "class_mode"],
  ["recording_status", "last_synced_at"],
];

export const sheetTab = () => (process.env.LECTURE_SHEET_TAB || "Lectures").trim();
export const sheetId = () => (process.env.LECTURE_SHEET_ID || "").trim();

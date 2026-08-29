import { google } from "googleapis";
import { existsSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";

// SETUP (one-time) — unchanged from the source app, still reads a
// service-account.json placed at the atomic-ops project root (gitignored,
// never read or committed by this integration) or the GOOGLE_SERVICE_ACCOUNT_JSON
// env var:
// 1. Google Cloud Console -> new project -> enable "Google Sheets API"
// 2. IAM & Admin -> Service Accounts -> create -> Keys -> Add Key -> JSON -> download
// 3. Save as service-account.json in project root, add to .gitignore
// 4. Open your Sheet -> Share -> add the service account's client_email as Editor
// 5. .env me: GOOGLE_SHEET_ID=<sheet URL ke /d/ aur /edit ke beech wala part>
// 6. Sheet me tab "Students" banao, header row:
//    Atomic ID | Name | Email | Phone | Batch | Role | Plan | Access Status | Expires At | Last Login At | Synced At
// 7. Sheet me tab "Schedule" banao. Compact header row supported:
//    Batch | Class Date | Time | Subject | Teacher Name | Topic | YouTube Link | Notes
//    Batch cell can contain comma/newline-separated batch names.
//    Checkbox columns named after batch codes/labels are also supported.
//    Legacy 16-column layout is still supported:
//    Date | Day | Teacher | Start Time | Lecture Name | Lecture No. | Class Type | Subject |
//    Stream key | Batch | Platform | Status | Recording | Chapter | Topic | Remarks

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const STUDENTS_SHEET_RANGE = "Students!A:K";
const SCHEDULE_SHEET_RANGE = process.env.GOOGLE_SCHEDULE_SHEET_RANGE ?? "Schedule!A:P";

const SCHEDULE_BATCHES = [
  {
    code: "SELECTION_PRO",
    aliases: ["SELECTION_PRO", "Selection Pro", "Selection Pro Batch"],
  },
  {
    code: "SELECTION_1_0",
    aliases: ["SELECTION_1_0", "Selection 1.0", "Selection 1.0 Batch", "Selection 1 0"],
  },
  {
    code: "ARAMBH",
    aliases: ["ARAMBH", "Arambh", "Arambh Batch"],
  },
  {
    code: "MANZIL",
    aliases: ["MANZIL", "Manzil", "Manzil Batch"],
  },
  {
    code: "UDAAN",
    aliases: ["UDAAN", "Udaan", "Udaan Batch", "Udaan Batch Class 10th"],
  },
  {
    code: "NO_BATCH",
    aliases: ["NO_BATCH", "No Batch"],
  },
] as const;

function ensureSheetId() {
  if (!SHEET_ID) {
    throw new Error("GOOGLE_SHEET_ID is not configured.");
  }
  return SHEET_ID;
}

async function getSheetsClient() {
  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const auth = credentialsJson
    ? new google.auth.GoogleAuth({
        credentials: JSON.parse(credentialsJson),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      })
    : new google.auth.GoogleAuth({
        keyFile: "./service-account.json",
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client as Parameters<typeof google.sheets>[0]["auth"] });
}

type SheetableStudent = {
  atomicId: string;
  name: string | null;
  email: string;
  phone?: string | null;
  atomicBatch?: string | null;
  role: string;
  plan?: string;
  accessStatus?: string;
  expiresAt?: Date | null;
  lastLoginAt?: Date | null;
};

export async function syncStudentToSheet(student: SheetableStudent) {
  try {
    const sheets = await getSheetsClient();
    const row = [
      student.atomicId,
      student.name || "",
      student.email,
      student.phone || "",
      student.atomicBatch || "NO_BATCH",
      student.role,
      student.plan || "FREE",
      student.accessStatus || "ACTIVE",
      student.expiresAt ? new Date(student.expiresAt).toISOString() : "",
      student.lastLoginAt ? new Date(student.lastLoginAt).toISOString() : "",
      new Date().toISOString(),
    ];
    const spreadsheetId = ensureSheetId();

    const existingRows = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: STUDENTS_SHEET_RANGE,
    });
    const rows = existingRows.data.values ?? [];
    const existingRowIndex = rows.findIndex((existingRow, index) => {
      if (index === 0) return false;
      const atomicId = String(existingRow[0] ?? "").trim();
      const email = String(existingRow[2] ?? "").trim().toLowerCase();
      return atomicId === student.atomicId || email === student.email.toLowerCase();
    });

    if (existingRowIndex >= 0) {
      const sheetRowNumber = existingRowIndex + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Students!A${sheetRowNumber}:K${sheetRowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] },
      });
      return;
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: STUDENTS_SHEET_RANGE,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  } catch (err: unknown) {
    // never let a sheet-sync failure break registration/login for the user
    console.error("Google Sheets sync failed:", err instanceof Error ? err.message : String(err));
  }
}

/**
 * Adapted from the source's syncUserToStudentSheet: atomic-ops's User has
 * no atomicId/role(string)/isPro/isSuspended fields (see the schema's AI
 * Chat integration comment), and the profile/access relations are named
 * aiChatProfile/aiChatAccess here (renamed to avoid colliding with the
 * Student/Course "profile" concepts already in the schema). "Atomic ID"
 * falls back to the real User.id since no human-readable id was carried
 * over; "Role" reads the real RBAC role name; Pro/suspended status comes
 * from the AI Chat UserAccess record and atomic-ops's own User.status.
 */
export async function syncUserToStudentSheet(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { aiChatProfile: true, aiChatAccess: true, role: true },
  });
  if (!user) return;

  await syncStudentToSheet({
    atomicId: user.id,
    name: user.name,
    email: user.email,
    phone: user.aiChatProfile?.phone,
    atomicBatch: user.aiChatProfile?.atomicBatch,
    role: user.role?.name ?? "STUDENT",
    plan: user.aiChatAccess?.plan ?? "FREE",
    accessStatus:
      user.aiChatAccess?.status ?? (user.status !== "ACTIVE" ? "SUSPENDED" : "ACTIVE"),
    expiresAt: user.aiChatAccess?.expiresAt,
    lastLoginAt: user.lastLoginAt,
  });
}

// Normalized row shape used by schedule sync. The reader accepts both compact
// schedule sheets and the older 16-column layout.
// No parsing/validation here — that happens in the sync route.
export interface SheetScheduleRow {
  date: string;
  day: string;
  teacherName: string;
  startTimeRaw: string;
  lectureName: string;
  lectureNo: string;
  classType: string;
  subject: string;
  streamKey: string;
  batch: string;
  platform: string;
  status: string;
  recording: string;
  chapter: string;
  topic: string;
  remarks: string;
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .replace(/^`+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildHeaderIndex(headerRow: unknown[]) {
  const index = new Map<string, number>();
  headerRow.forEach((value, columnIndex) => {
    const normalized = normalizeHeader(String(value ?? ""));
    if (normalized && !index.has(normalized)) {
      index.set(normalized, columnIndex);
    }
  });
  return index;
}

function findColumn(headers: Map<string, number>, aliases: string[]) {
  for (const alias of aliases) {
    const column = headers.get(normalizeHeader(alias));
    if (column !== undefined) return column;
  }
  return undefined;
}

function looksLikeBatch(value: string) {
  return /^(SELECTION_PRO|SELECTION_1_0|ARAMBH|MANZIL|UDAAN|NO_BATCH)$/i.test(value.trim());
}

function compactBatchLabel(value: string) {
  return normalizeHeader(value).replace(/\bbatch\b/g, "").replace(/\s+/g, " ").trim();
}

function batchCodeFromLabel(value: string) {
  const compact = compactBatchLabel(value);
  for (const batch of SCHEDULE_BATCHES) {
    if (compact === compactBatchLabel(batch.code)) return batch.code;
    if (batch.aliases.some((alias) => compact === compactBatchLabel(alias))) {
      return batch.code;
    }
  }
  return null;
}

function isChecked(value: string) {
  return /^(true|yes|y|1|checked|x|☑|✓|✔|✅)$/i.test(value.trim());
}

function parseBatchCell(value: string) {
  const selected = new Set<string>();
  const tokens = value
    .split(/[,;\n|/]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const normalized = normalizeHeader(token);
    if (normalized === "all" || normalized === "all batches") {
      SCHEDULE_BATCHES.filter((batch) => batch.code !== "NO_BATCH").forEach((batch) => selected.add(batch.code));
      continue;
    }

    const code = batchCodeFromLabel(token);
    if (code) selected.add(code);
  }

  return Array.from(selected);
}

function getBatchCheckboxColumns(headers: Map<string, number>) {
  const columns = new Map<string, number>();
  for (const batch of SCHEDULE_BATCHES) {
    const column = findColumn(headers, [batch.code, ...batch.aliases]);
    if (column !== undefined) {
      columns.set(batch.code, column);
    }
  }
  return columns;
}

function extractBatches(row: unknown[], batchColumn: number | undefined, checkboxColumns: Map<string, number>) {
  const cell = (index: number) => String(row[index] ?? "").trim();
  const selected = new Set<string>();

  if (batchColumn !== undefined) {
    parseBatchCell(cell(batchColumn)).forEach((batch) => selected.add(batch));
  }

  for (const [batch, column] of checkboxColumns) {
    if (column !== batchColumn && isChecked(cell(column))) {
      selected.add(batch);
    }
  }

  return Array.from(selected);
}

export async function readScheduleSheet(): Promise<SheetScheduleRow[]> {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: ensureSheetId(),
    range: SCHEDULE_SHEET_RANGE,
  });

  const rows = response.data.values ?? [];
  const headers = buildHeaderIndex(rows[0] ?? []);
  const cell = (row: unknown[], index: number) => String(row[index] ?? "").trim();
  const at = (row: unknown[], index: number | undefined) =>
    index === undefined ? "" : cell(row, index);

  const batchColumn = findColumn(headers, ["Batch", "Batch Name", "Batch Code"]);
  const classDateColumn = findColumn(headers, ["Class Date", "Date"]);
  const timeColumn = findColumn(headers, ["Start Time", "Time"]);
  const teacherColumn = findColumn(headers, ["Teacher Name", "Teacher"]);
  const subjectColumn = findColumn(headers, ["Subject"]);
  const lectureNameColumn = findColumn(headers, ["Lecture Name"]);
  const lectureNoColumn = findColumn(headers, ["Lecture No", "Lecture No."]);
  const classTypeColumn = findColumn(headers, ["Class Type"]);
  const streamKeyColumn = findColumn(headers, ["Stream Key"]);
  const platformColumn = findColumn(headers, ["Platform"]);
  const statusColumn = findColumn(headers, ["Status"]);
  const recordingColumn = findColumn(headers, [
    "YouTube Link",
    "Youtube Link",
    "YouTube URL",
    "Recording",
  ]);
  const chapterColumn = findColumn(headers, ["Chapter"]);
  const topicColumn = findColumn(headers, ["Topic"]);
  const remarksColumn = findColumn(headers, ["Notes", "Note", "Remarks"]);
  const batchCheckboxColumns = getBatchCheckboxColumns(headers);

  return rows
    .slice(1) // skip header row
    .map((row) => ({
      date: at(row, classDateColumn) || (looksLikeBatch(cell(row, 0)) ? cell(row, 1) : cell(row, 0)),
      day: "",
      teacherName: at(row, teacherColumn) || (looksLikeBatch(cell(row, 0)) ? cell(row, 4) : cell(row, 2)),
      startTimeRaw: at(row, timeColumn) || (looksLikeBatch(cell(row, 0)) ? cell(row, 2) : cell(row, 3)),
      lectureName: at(row, lectureNameColumn),
      lectureNo: at(row, lectureNoColumn),
      classType: at(row, classTypeColumn),
      subject: at(row, subjectColumn) || (looksLikeBatch(cell(row, 0)) ? cell(row, 3) : cell(row, 7)),
      streamKey: at(row, streamKeyColumn),
      batch:
        extractBatches(row, batchColumn, batchCheckboxColumns).join(",") ||
        (looksLikeBatch(cell(row, 0)) ? cell(row, 0) : cell(row, 9)),
      platform: at(row, platformColumn),
      status: at(row, statusColumn),
      recording: at(row, recordingColumn) || (looksLikeBatch(cell(row, 0)) ? cell(row, 6) : cell(row, 12)),
      chapter: at(row, chapterColumn),
      topic: at(row, topicColumn) || (looksLikeBatch(cell(row, 0)) ? cell(row, 5) : cell(row, 14)),
      remarks: at(row, remarksColumn) || (looksLikeBatch(cell(row, 0)) ? cell(row, 7) : cell(row, 15)),
    }))
    .filter((row) => row.date || row.startTimeRaw || row.subject || row.teacherName || row.topic || row.batch);
}

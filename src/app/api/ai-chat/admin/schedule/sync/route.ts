import { NextResponse } from "next/server";
import { requireScheduleManager, UnauthorizedError, ForbiddenError } from "@/lib/ai-chat/auth";
import { readScheduleSheet, type SheetScheduleRow } from "@/lib/ai-chat/googleSheets";
import { getPrisma } from "@/lib/ai-chat/prisma";

export const runtime = "nodejs";

const VALID_BATCHES = new Set([
  "SELECTION_PRO",
  "SELECTION_1_0",
  "ARAMBH",
  "MANZIL",
  "UDAAN",
  "NO_BATCH",
]);

const BATCH_ALIASES = new Map(
  [
    ["SELECTION_PRO", "SELECTION_PRO"],
    ["SELECTION_PRO_BATCH", "SELECTION_PRO"],
    ["SELECTION_1_0", "SELECTION_1_0"],
    ["SELECTION_1_0_BATCH", "SELECTION_1_0"],
    ["SELECTION_10", "SELECTION_1_0"],
    ["SELECTION_10_BATCH", "SELECTION_1_0"],
    ["ARAMBH", "ARAMBH"],
    ["ARAMBH_BATCH", "ARAMBH"],
    ["MANZIL", "MANZIL"],
    ["MANZIL_BATCH", "MANZIL"],
    ["UDAAN", "UDAAN"],
    ["UDAAN_BATCH", "UDAAN"],
    ["NO_BATCH", "NO_BATCH"],
  ].map(([alias, batch]) => [alias, batch] as const)
);

function accessError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "Admin or faculty access is required." }, { status: 403 });
  }
  return null;
}

// "6 : 00 PM", "11 : 00 Am", "18:00", "2 : 15 pm" -> "18:00" (24hr HH:MM)
// Entries without AM/PM are assumed to already be 24-hour time.
function parseStartTime(raw: string): string | null {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  const match = /^(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*\d{2})?\s*(am|pm)?$/i.exec(cleaned);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = match[2];
  const suffix = match[3]?.toLowerCase();

  if (suffix === "pm" && hours < 12) hours += 12;
  if (suffix === "am" && hours === 12) hours = 0;
  if (hours > 23 || hours < 0) return null;

  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

function normalizeBatch(raw: string) {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseBatches(raw: string) {
  const batches = new Set<string>();
  const tokens = raw
    .split(/[,;\n|/]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const normalized = normalizeBatch(token);
    if (normalized === "ALL" || normalized === "ALL_BATCHES") {
      for (const batch of VALID_BATCHES) {
        if (batch !== "NO_BATCH") batches.add(batch);
      }
      continue;
    }

    const batch = BATCH_ALIASES.get(normalized) ?? normalized;
    if (VALID_BATCHES.has(batch)) {
      batches.add(batch);
    }
  }

  return Array.from(batches);
}

function buildUtcDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

// "2026-08-03" or "01/08/2026" (dd/mm/yyyy) -> Date
function parseSheetDate(raw: string): Date | null {
  const cleaned = raw.trim();
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(cleaned);
  if (isoMatch) {
    return buildUtcDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const slashMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(cleaned);
  if (slashMatch) {
    return buildUtcDate(Number(slashMatch[3]), Number(slashMatch[2]), Number(slashMatch[1]));
  }

  return null;
}

function buildNotes(row: SheetScheduleRow): string | null {
  const parts = [
    row.lectureNo && `Lecture: ${row.lectureNo}`,
    row.classType && `Type: ${row.classType}`,
    row.chapter && `Chapter: ${row.chapter}`,
    row.platform && `Platform: ${row.platform}`,
    row.status && `Status: ${row.status}`,
    row.streamKey && `Stream key: ${row.streamKey}`,
    row.remarks && `Remarks: ${row.remarks}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" | ") : null;
}

export async function POST() {
  try {
    await requireScheduleManager();
    const rows = await readScheduleSheet();
    const prisma = getPrisma();

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const batches = parseBatches(row.batch);
      const classDate = parseSheetDate(row.date);
      const startTime = parseStartTime(row.startTimeRaw);
      const subject = row.subject.trim();

      if (batches.length === 0 || !classDate || !startTime || !subject) {
        skipped += 1;
        continue;
      }

      const topic = row.topic.trim() || row.lectureName.trim() || "General";
      const teacherName = row.teacherName.trim() || null;
      const youtubeLink = /^https?:\/\//i.test(row.recording.trim()) ? row.recording.trim() : null;
      const notes = buildNotes(row);

      for (const batch of batches) {
        const existing = await prisma.classSchedule.findFirst({
          where: {
            batch: batch as never,
            classDate,
            startTime,
            subject,
          },
        });

        if (existing) {
          await prisma.classSchedule.update({
            where: { id: existing.id },
            data: {
              teacherName,
              topic: topic || existing.topic,
              youtubeLink,
              notes,
            },
          });
          updated += 1;
        } else {
          await prisma.classSchedule.create({
            data: {
              batch: batch as never,
              classDate,
              startTime,
              subject,
              teacherName,
              topic,
              youtubeLink,
              notes,
            },
          });
          created += 1;
        }
      }
    }

    return NextResponse.json({ created, updated, skipped, total: rows.length });
  } catch (error) {
    const response = accessError(error);
    if (response) return response;
    console.error("[Schedule Sync API]", error);
    const message =
      error instanceof Error && error.message.includes("configured")
        ? error.message
        : "Could not sync schedule from Google Sheet.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

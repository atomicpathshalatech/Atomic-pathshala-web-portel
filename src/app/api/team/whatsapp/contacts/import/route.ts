import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { sanitizeIndianPhoneNumber } from "@/lib/whatsapp/provider";

export const dynamic = "force-dynamic";

interface ImportRow {
  name?: string;
  phone: string;
  email?: string;
  tags?: string[];
  batchId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHATSAPP_CONTACT_MANAGE);

    const body = await req.json();
    const { rows, dryRun = false, defaultTags = [], defaultBatchId = null } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return apiError("No contact rows provided for import", 400);
    }

    if (rows.length > 5000) {
      return apiError("Maximum 5,000 contacts per batch import", 400);
    }

    // Step 1: Validate and deduplicate inputs within the submitted payload
    const validRows: Array<{
      name: string;
      phone: string;
      cleanPhone: string;
      email: string | null;
      tags: string[];
      batchId: string | null;
    }> = [];

    const invalidRows: Array<{ row: any; reason: string }> = [];
    const seenPhonesInBatch = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row: ImportRow = rows[i];
      const rawPhone = String(row.phone || "").trim();

      if (!rawPhone) {
        invalidRows.push({ row, reason: "Missing phone number" });
        continue;
      }

      const { isValid, cleanPhone, formattedE164 } = sanitizeIndianPhoneNumber(rawPhone);
      if (!isValid) {
        invalidRows.push({ row, reason: `Invalid Indian phone number: ${rawPhone}` });
        continue;
      }

      if (seenPhonesInBatch.has(formattedE164)) {
        invalidRows.push({ row, reason: `Duplicate phone number in import batch: ${formattedE164}` });
        continue;
      }

      seenPhonesInBatch.add(formattedE164);

      const combinedTags = Array.from(
        new Set([...(Array.isArray(row.tags) ? row.tags : []), ...(Array.isArray(defaultTags) ? defaultTags : [])])
      )
        .map((t) => String(t).trim())
        .filter(Boolean);

      validRows.push({
        name: (row.name || "Contact").trim(),
        phone: formattedE164,
        cleanPhone,
        email: row.email?.trim() || null,
        tags: combinedTags,
        batchId: row.batchId || defaultBatchId || null,
      });
    }

    // Step 2: Query DB for existing phones among valid rows
    const candidatePhones = validRows.map((r) => r.phone);
    const existingContacts = await prisma.whatsAppContact.findMany({
      where: { phone: { in: candidatePhones } },
      select: { phone: true, name: true },
    });

    const existingPhonesSet = new Set(existingContacts.map((c) => c.phone));
    const newContactsToInsert = validRows.filter((r) => !existingPhonesSet.has(r.phone));
    const duplicateCount = existingContacts.length;

    // If dryRun mode (Preview), return summary without writing
    if (dryRun) {
      return apiSuccess({
        preview: true,
        totalRows: rows.length,
        validCount: validRows.length,
        newCount: newContactsToInsert.length,
        duplicateCount,
        invalidCount: invalidRows.length,
        sampleNew: newContactsToInsert.slice(0, 10),
        invalidRows: invalidRows.slice(0, 20),
      });
    }

    // Step 3: Insert new contacts in chunks of 500
    let insertedCount = 0;
    const CHUNK_SIZE = 500;

    for (let i = 0; i < newContactsToInsert.length; i += CHUNK_SIZE) {
      const chunk = newContactsToInsert.slice(i, i + CHUNK_SIZE);
      await prisma.whatsAppContact.createMany({
        data: chunk.map((r) => ({
          name: r.name,
          phone: r.phone,
          cleanPhone: r.cleanPhone,
          email: r.email,
          tags: r.tags,
          batchId: r.batchId,
          source: "CSV_IMPORT",
        })),
        skipDuplicates: true,
      });
      insertedCount += chunk.length;
    }

    return apiSuccess({
      success: true,
      totalRows: rows.length,
      insertedCount,
      duplicateCount,
      invalidCount: invalidRows.length,
      message: `Successfully imported ${insertedCount} contacts (${duplicateCount} existing skipped, ${invalidRows.length} invalid)`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
